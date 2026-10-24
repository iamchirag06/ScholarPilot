package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/redis/go-redis/v9"

	"ScholarPilot/internal/queue"
)

type CrawlHandler struct {
	rdb *redis.Client
}

func NewCrawlHandler(rdb *redis.Client) *CrawlHandler {
	return &CrawlHandler{rdb: rdb}
}

// Health is a simple liveness check.
func (h *CrawlHandler) Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, `{"status":"ok"}`)
}

func (h *CrawlHandler) CreateCrawl(w http.ResponseWriter, r *http.Request) {
	var body struct {
		URL  string `json:"url"`
		Goal string `json:"goal"`
	}

	r.Body = http.MaxBytesReader(w, r.Body, 1048576)
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.URL == "" {
		http.Error(w, `{"error":"url required"}`, http.StatusBadRequest)
		return
	}

	jobID := uuid.NewString()
	job := queue.Job{
		JobID: jobID,
		URL:   body.URL,
		Goal:  body.Goal,
	}

	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	if err := queue.Push(ctx, h.rdb, job); err != nil {
		log.Printf("enqueue fail: %v", err)
		http.Error(w, `{"error":"enqueue failed"}`, http.StatusInternalServerError)
		return
	}
	_ = queue.SetStatus(ctx, h.rdb, jobID, queue.Status{State: "queued"})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	fmt.Fprintf(w, `{"job_id":"%s","status":"queued"}`, jobID)
}

func (h *CrawlHandler) GetCrawlStatus(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	jobID := vars["jobID"]

	if jobID == "" {
		http.Error(w, `{"error":"job_id required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	st, err := queue.GetStatus(ctx, h.rdb, jobID)
	if err != nil || st == nil {
		http.Error(w, `{"error":"job not found"}`, http.StatusNotFound)
		return
	}

	resp := map[string]any{"job_id": jobID, "status": st.State, "attempts": st.Attempts}
	if st.Error != "" {
		resp["error"] = st.Error
	}
	if st.State == "completed" {
		data, _ := queue.GetResult(ctx, h.rdb, jobID)
		resp["data"] = json.RawMessage(data)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
