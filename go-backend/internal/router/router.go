package router

import (
	"github.com/gorilla/mux"
	"github.com/redis/go-redis/v9"

	"ScholarPilot/internal/handler"
)

func New(rdb *redis.Client) *mux.Router {
	r := mux.NewRouter()

	crawlHandler := handler.NewCrawlHandler(rdb)

	r.HandleFunc("/health", crawlHandler.Health).Methods("GET")
	r.HandleFunc("/api/crawl", crawlHandler.CreateCrawl).Methods("POST")
	r.HandleFunc("/api/crawl/status/{jobID}", crawlHandler.GetCrawlStatus).Methods("GET")

	return r
}
