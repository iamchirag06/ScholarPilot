package worker

import (
	"ScholarPilot/internal/queue"
	"ScholarPilot/internal/tinyfish"
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// Run is the background consumer loop. Blocks until ctx is cancelled.
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
		goal = "Extract the main content of this page. Return as JSON."
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
			_ = queue.SetResult(ctx, rdb, job.JobID, res.Data)
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
