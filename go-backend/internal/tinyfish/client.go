package tinyfish

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

const baseURL = "https://agent.tinyfish.ai/v1/automation/run-sse"

type Request struct {
	URL  string `json:"url"`
	Goal string `json:"goal"`
}

type Result struct {
	Status string          `json:"status"`
	Data   json.RawMessage `json:"data,omitempty"`
	Error  string          `json:"error,omitempty"`
}

// RunCrawl calls TinyFish and blocks until the COMPLETE event arrives.
func RunCrawl(ctx context.Context, targetURL, goal string) (*Result, error) {
	apiKey := os.Getenv("TINYFISH_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("TINYFISH_API_KEY not set")
	}

	payload, _ := json.Marshal(Request{URL: targetURL, Goal: goal})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", apiKey)
	req.Header.Set("Accept", "text/event-stream")

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("tinyfish request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, fmt.Errorf("rate limited (429)")
	}
	if resp.StatusCode >= 500 {
		return nil, fmt.Errorf("tinyfish server error: %d", resp.StatusCode)
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("tinyfish %d: %s", resp.StatusCode, string(body))
	}

	return parseSSE(resp.Body)
}

func parseSSE(r io.Reader) (*Result, error) {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	var eventType string
	var dataLines []string

	for scanner.Scan() {
		line := scanner.Text()

		if line == "" {
			if eventType == "COMPLETE" {
				return handleComplete(dataLines)
			}
			eventType = ""
			dataLines = nil
			continue
		}

		if strings.HasPrefix(line, "event:") {
			eventType = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
			continue
		}

		if strings.HasPrefix(line, "data:") {
			dataLines = append(dataLines, strings.TrimPrefix(line, "data:"))
			continue
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("read sse stream: %w", err)
	}

	return nil, fmt.Errorf("stream ended before COMPLETE event")
}

func handleComplete(dataLines []string) (*Result, error) {
	raw := strings.TrimSpace(strings.Join(dataLines, "\n"))
	if raw == "" {
		return nil, fmt.Errorf("COMPLETE event had no data")
	}

	var payload struct {
		Status string          `json:"status"`
		Result json.RawMessage `json:"result"`
		Error  *struct {
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return nil, fmt.Errorf("parse COMPLETE json: %w", err)
	}

	if payload.Status != "COMPLETED" {
		errMsg := "unknown failure"
		if payload.Error != nil {
			errMsg = payload.Error.Message
		}
		return &Result{Status: payload.Status, Error: errMsg}, nil
	}

	return &Result{Status: payload.Status, Data: payload.Result}, nil
}
