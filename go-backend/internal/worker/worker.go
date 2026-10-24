package worker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"

	"ScholarPilot/internal/dto"
	"ScholarPilot/internal/queue"
	"ScholarPilot/internal/tinyfish"
)

func Run(ctx context.Context, rdb *redis.Client) {
	log.Println("[worker] started")
	defer log.Println("[worker] stopped")

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		job, err := queue.Pop(ctx, rdb, 5*time.Second)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			log.Printf("[worker] pop error: %v", err)
			time.Sleep(time.Second)
			continue
		}
		if job == nil {
			continue
		}

		process(ctx, rdb, job)
	}
}

func process(ctx context.Context, rdb *redis.Client, job *queue.Job) {
	log.Printf("[job] received %s with %d urls", job.JobID, len(job.URLs))

	allScholarships := make(dto.ScholarshipList, 0)
	totalURLs := len(job.URLs)

	if totalURLs == 0 {
		_ = queue.SetStatus(ctx, rdb, job.JobID, queue.Status{State: "failed", Error: "no urls provided"})
		return
	}

	goal := job.Goal
	if goal == "" {
		goal = `TASK: Extract ALL scholarships listed on this page. 
Even if there is only ONE scholarship on the page, you MUST return a JSON array containing that single object.

Do not include any conversational text. Do not use markdown blocks. Return ONLY a valid JSON array matching this exact structure:
[
  {
    "sourcePortal": "string",
    "schemeName": "string",
    "provider": "string",
    "awardAmount": 0,
    "deadline": "YYYY-MM-DD",
    "applyLink": "string",
    "rawEligibilityText": "string",
    "llmSummary": "string",
    "requiredDocuments": ["string"],
    "confidenceScore": 0.0
  }
]`
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	completedCount := 0

	for i, targetURL := range job.URLs {
		wg.Add(1)
		go func(index int, url string) {
			defer wg.Done()

			mu.Lock()
			progress := int((float64(completedCount) / float64(totalURLs)) * 100)
			_ = queue.SetStatus(ctx, rdb, job.JobID, queue.Status{
				State:    "crawling",
				Progress: progress,
				Attempts: 0,
			})
			mu.Unlock()

			log.Printf("[job] %s processing url %d/%d: %s", job.JobID, index+1, totalURLs, url)

			const maxAttempts = 3
			var success bool
			var localScholarships dto.ScholarshipList

			for attempt := 1; attempt <= maxAttempts; attempt++ {
				if ctx.Err() != nil {
					return
				}

				res, err := tinyfish.RunCrawl(ctx, url, goal)
				if err == nil && res.Error == "" {
					trimmedData := strings.TrimSpace(string(res.Data))

					if strings.HasPrefix(trimmedData, "{") {
						var single dto.Scholarship
						if errSingle := json.Unmarshal(res.Data, &single); errSingle == nil {
							localScholarships = append(localScholarships, single)
							success = true
						}
					} else {
						if errArray := json.Unmarshal(res.Data, &localScholarships); errArray == nil {
							success = true
						}
					}
					if success {
						break
					}
				}

				if err != nil {
					log.Printf("[job] %s attempt %d failed for %s: %v", job.JobID, attempt, url, err)
				} else {
					log.Printf("[job] %s attempt %d tinyfish error for %s: %s", job.JobID, attempt, url, res.Error)
				}

				backoff := time.Duration(attempt*attempt) * time.Second
				select {
				case <-time.After(backoff):
				case <-ctx.Done():
					return
				}
			}

			mu.Lock()
			completedCount++

			if success && len(localScholarships) > 0 {
				for j := range localScholarships {
					localScholarships[j].ID = fmt.Sprintf("%s-%d-%d", job.JobID, index, j)
					if localScholarships[j].SourcePortal == "" {
						localScholarships[j].SourcePortal = url
					}
				}
				allScholarships = append(allScholarships, localScholarships...)
			} else {
				log.Printf("[job] %s permanently failed or empty on URL: %s", job.JobID, url)
			}

			progress = int((float64(completedCount) / float64(totalURLs)) * 100)
			_ = queue.SetStatus(ctx, rdb, job.JobID, queue.Status{
				State:    "crawling",
				Progress: progress,
				Attempts: 0,
			})

			mu.Unlock() // Explicit unlock here prevents the deadlock

		}(i, targetURL)
	}

	wg.Wait()

	cleanData, _ := json.Marshal(allScholarships)

	// Using Background context here to ensure it saves even if the request context times out
	bgCtx := context.Background()
	_ = queue.SetResult(bgCtx, rdb, job.JobID, cleanData)
	_ = queue.SetStatus(bgCtx, rdb, job.JobID, queue.Status{
		State:    "completed",
		Progress: 100,
		Attempts: 1,
	})
	log.Printf("[job] completed %s - Extracted %d total scholarships across %d URLs", job.JobID, len(allScholarships), totalURLs)

	go func() {
		javaURL := os.Getenv("JAVA_BACKEND_URL")
		if javaURL == "" {
			javaURL = "http://localhost:8080/api/schemes/save-from-go"
		}
		payload := map[string]any{
			"job_id":  job.JobID,
			"schemes": json.RawMessage(cleanData),
		}

		bodyBytes, _ := json.Marshal(payload)

		req, err := http.NewRequest("POST", javaURL, bytes.NewBuffer(bodyBytes))
		if err != nil {
			log.Printf("[callback] failed to create request: %v", err)
			return
		}

		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("ngrok-skip-browser-warning", "true")

		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			log.Printf("[callback] failed to notify Java: %v", err)
			return
		}
		defer resp.Body.Close()
		log.Printf("[callback] successfully sent data to Java, status: %d", resp.StatusCode)
	}()
}
