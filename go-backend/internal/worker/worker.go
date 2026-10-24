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

	var allScholarships dto.ScholarshipList
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
    "source_portal": "string",
    "scheme_name": "string",
    "provider": "string",
    "award_amount": 0,
    "deadline": "YYYY-MM-DD",
    "apply_link": "string",
    "raw_eligibility_text": "string",
    "llm_summary": "string",
    "required_documents": ["string"],
    "confidence_score": 0.0
  }
]`
	}

	for i, targetURL := range job.URLs {
		progress := int((float64(i) / float64(totalURLs)) * 100)

		_ = queue.SetStatus(ctx, rdb, job.JobID, queue.Status{
			State:    "crawling",
			Progress: progress,
			Attempts: 0,
		})

		log.Printf("[job] %s processing url %d/%d: %s", job.JobID, i+1, totalURLs, targetURL)

		const maxAttempts = 3
		var success bool

		for attempt := 1; attempt <= maxAttempts; attempt++ {
			if ctx.Err() != nil {
				return
			}

			res, err := tinyfish.RunCrawl(ctx, targetURL, goal)
			if err == nil && res.Error == "" {
				var scholarshipList dto.ScholarshipList
				trimmedData := strings.TrimSpace(string(res.Data))

				if strings.HasPrefix(trimmedData, "{") {
					var single dto.Scholarship
					if errSingle := json.Unmarshal(res.Data, &single); errSingle != nil {
						log.Printf("[job] %s schema error on %s: %v", job.JobID, targetURL, errSingle)
						break
					}
					scholarshipList = append(scholarshipList, single)
				} else {
					if errArray := json.Unmarshal(res.Data, &scholarshipList); errArray != nil {
						log.Printf("[job] %s schema error on %s: %v", job.JobID, targetURL, errArray)
						break
					}
				}

				for j := range scholarshipList {
					scholarshipList[j].ID = fmt.Sprintf("%s-%d-%d", job.JobID, i, j)
					if scholarshipList[j].SourcePortal == "" {
						scholarshipList[j].SourcePortal = targetURL
					}
				}

				allScholarships = append(allScholarships, scholarshipList...)
				success = true
				break
			}

			if err != nil {
				log.Printf("[job] %s attempt %d failed for %s: %v", job.JobID, attempt, targetURL, err)
			} else {
				log.Printf("[job] %s attempt %d tinyfish error for %s: %s", job.JobID, attempt, targetURL, res.Error)
			}

			backoff := time.Duration(attempt*attempt) * time.Second
			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				return
			}
		}

		if !success {
			log.Printf("[job] %s permanently failed on URL: %s", job.JobID, targetURL)
		}
	}

	cleanData, _ := json.Marshal(allScholarships)
	_ = queue.SetResult(ctx, rdb, job.JobID, cleanData)
	_ = queue.SetStatus(ctx, rdb, job.JobID, queue.Status{
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

		resp, err := http.Post(javaURL, "application/json", bytes.NewBuffer(bodyBytes))
		if err != nil {
			log.Printf("[callback] failed to notify Java: %v", err)
			return
		}
		defer resp.Body.Close()
		log.Printf("[callback] successfully sent data to Java, status: %d", resp.StatusCode)
	}()
}
