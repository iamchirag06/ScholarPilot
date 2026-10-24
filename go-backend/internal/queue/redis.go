package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	JobQueueKey  = "crawl:jobs"
	JobStatusKey = "crawl:status:"
	JobResultKey = "crawl:result:"
	JobStatusTTL = time.Hour
)

type Job struct {
	JobID string   `json:"job_id"`
	URLs  []string `json:"url"`
	Goal  string   `json:"goal"`
}

type Status struct {
	State    string `json:"state"`
	Attempts int    `json:"attempts"`
	Progress int    `json:"progress"`
	Error    string `json:"error,omitempty"`
}

func Push(ctx context.Context, rdb *redis.Client, job Job) error {
	payload, err := json.Marshal(job)
	if err != nil {
		return err
	}
	return rdb.LPush(ctx, JobQueueKey, payload).Err()
}

func Pop(ctx context.Context, rdb *redis.Client, timeout time.Duration) (*Job, error) {
	val, err := rdb.BRPop(ctx, timeout, JobQueueKey).Result()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if len(val) < 2 {
		return nil, fmt.Errorf("unexpected BRPOP result: %v", val)
	}
	var job Job
	if err := json.Unmarshal([]byte(val[1]), &job); err != nil {
		return nil, fmt.Errorf("unmarshal job: %w", err)
	}
	return &job, nil
}

func SetStatus(ctx context.Context, rdb *redis.Client, jobID string, s Status) error {
	payload, _ := json.Marshal(s)
	return rdb.Set(ctx, JobStatusKey+jobID, payload, JobStatusTTL).Err()
}

func GetStatus(ctx context.Context, rdb *redis.Client, jobID string) (*Status, error) {
	raw, err := rdb.Get(ctx, JobStatusKey+jobID).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var s Status
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil, err
	}
	return &s, nil
}

func SetResult(ctx context.Context, rdb *redis.Client, jobID string, data json.RawMessage) error {
	return rdb.Set(ctx, JobResultKey+jobID, data, JobStatusTTL).Err()
}

func GetResult(ctx context.Context, rdb *redis.Client, jobID string) (json.RawMessage, error) {
	raw, err := rdb.Get(ctx, JobResultKey+jobID).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	return raw, err
}
