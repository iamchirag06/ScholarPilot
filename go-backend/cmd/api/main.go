package main

import (
	"ScholarPilot/internal/router"
	"ScholarPilot/internal/worker"
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("[boot] .env file not found, relying on environment variables")
	}

	port := getEnv("PORT", "8082")
	redisAddr := getEnv("REDIS_ADDR", "localhost:6380")

	var opt *redis.Options
	var err error
	if len(redisAddr) > 8 && redisAddr[:8] == "redis://" {
		opt, err = redis.ParseURL(redisAddr)
	} else {
		opt, err = redis.ParseURL("redis://" + redisAddr)
	}

	if err != nil {
		log.Fatalf("[boot] invalid redis config: %v", err)
	}

	rdb := redis.NewClient(opt)

	pingCtx, pingCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer pingCancel()

	if err := rdb.Ping(pingCtx).Err(); err != nil {
		log.Fatalf("[boot] redis ping failed at %s: %v", redisAddr, err)
	}
	log.Printf("[boot] redis connected at %s", redisAddr)

	workerCtx, workerCancel := context.WithCancel(context.Background())
	defer workerCancel()
	go worker.Run(workerCtx, rdb)

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           router.New(rdb),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	serverErr := make(chan error, 1)
	go func() {
		log.Printf("[boot] server listening on :%s", port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-serverErr:
		log.Fatalf("[fatal] server error: %v", err)
	case sig := <-stop:
		log.Printf("[shutdown] received signal: %v", sig)
	}

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("[shutdown] http shutdown error: %v", err)
	}
	if err := rdb.Close(); err != nil {
		log.Printf("[shutdown] redis close error: %v", err)
	}
	log.Println("[shutdown] bye bye")
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}

	return fallback
}
