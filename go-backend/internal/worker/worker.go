package worker

import (
	"ScholarPilot/internal/dto"
	"ScholarPilot/internal/queue"
	"ScholarPilot/internal/tinyfish"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
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
	log.Printf("[job] received %s url=%s", job.JobID, job.URL)
	_ = queue.SetStatus(ctx, rdb, job.JobID, queue.Status{State: "processing", Attempts: 0})

	goal := job.Goal
	if goal == "" {
		goal = `TASK: Extract the scholarship details from this page and return them as JSON.
	
Do not include any conversational text. Do not use markdown blocks. Return ONLY valid JSON matching this exact structure:
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
}`
	}

	const maxAttempts = 3
	var lastErr error

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		if ctx.Err() != nil {
			_ = queue.SetStatus(ctx, rdb, job.JobID, queue.Status{
				State: "failed", Attempts: attempt - 1, Error: "shutdown",
			})
			return
		}

		res, err := tinyfish.RunCrawl(ctx, job.URL, goal)
		if err == nil && res.Error == "" {
			var scholarship dto.Scholarship
			if err := json.Unmarshal(res.Data, &scholarship); err != nil {
				lastErr := fmt.Errorf("LLM returned invalid JSON schema: %w", err)
				log.Printf("[job] %s failed schema validation: %v", job.JobID, lastErr)
				break
			}

			scholarship.ID = job.JobID
			cleanData, _ := json.Marshal(scholarship)

			_ = queue.SetResult(ctx, rdb, job.JobID, cleanData)
			_ = queue.SetStatus(ctx, rdb, job.JobID, queue.Status{
				State: "completed", Attempts: attempt,
			})
			log.Printf("[job] completed %s (attempt %d)", job.JobID, attempt)
			return
		}

		if err != nil {
			lastErr = err
		} else {
			lastErr = fmt.Errorf("tinyfish goal failed: %s", res.Error)
		}

		if strings.Contains(lastErr.Error(), "429") || strings.Contains(lastErr.Error(), "rate limit") {
			backoff := time.Duration(attempt*attempt) * time.Second
			log.Printf("[job] %s rate limited, retry in %v (attempt %d/%d)", job.JobID, backoff, attempt, maxAttempts)
			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				return
			}
			continue
		}

		log.Printf("[job] %s failed: %v", job.JobID, lastErr)
		break
	}

	_ = queue.SetStatus(ctx, rdb, job.JobID, queue.Status{
		State: "failed", Attempts: maxAttempts, Error: lastErr.Error(),
	})
}
