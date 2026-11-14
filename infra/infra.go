// File: infra/infra.go
package infra

import (
	"context"
	"errors"
	"fmt"
	"imigi/config"
	"imigi/infra/cache"
	"imigi/infra/logger"
	"imigi/infra/mq"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

type Deps struct {
	Cache  cache.Cache
	MQ     mq.MQ
	Config config.Config
	Log    *zap.Logger

	// Underlying raw client for graceful shutdown (Redis MQ relies on it).
	RedisClient *redis.Client
}

/* -------------------- Constructor -------------------- */

func New(cfg *config.Config) (*Deps, error) {
	if cfg == nil {
		return nil, errors.New("nil config provided")
	}

	d := &Deps{
		Config: *cfg,
	}

	// Initialize logging early so components can use it.
	if err := logger.Init(); err != nil {
		return nil, fmt.Errorf("logger init: %w", err)
	}
	d.Log = logger.L

	// Helper to clean up partially initialized resources on error.
	cleanup := func() {
		_ = d.Close(context.Background())
	}

	/* -------- Redis -------- */

	redisAddr := strings.TrimSpace(env("REDIS_ADDR", ""))
	if redisAddr == "" {
		cleanup()
		return nil, errors.New("REDIS_ADDR is not set")
	}

	redisPassword := env("REDIS_PASSWORD", "")
	redisDB := 0
	if raw := strings.TrimSpace(env("REDIS_DB", "")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil {
			cleanup()
			return nil, fmt.Errorf("REDIS_DB is invalid: %w", err)
		}
		redisDB = parsed
	}

	redisClient, err := NewRedis(redisAddr, redisPassword, redisDB)
	if err != nil {
		cleanup()
		return nil, fmt.Errorf("redis setup: %w", err)
	}

	d.RedisClient = redisClient
	d.Cache = cache.NewCache(redisClient)

	d.MQ = mq.NewRedisMQ(redisClient)
	if d.MQ == nil {
		cleanup()
		return nil, errors.New("redis MQ initialization returned nil")
	}

	return d, nil
}

/* -------------------- Graceful Shutdown -------------------- */

func (d *Deps) Close(ctx context.Context) error {
	if d == nil {
		return nil
	}

	if ctx == nil {
		ctx = context.Background()
	}

	var errs []string

	/*
		2. Close Redis.
	*/
	if d.RedisClient != nil {
		if err := d.RedisClient.Close(); err != nil && !errors.Is(err, redis.ErrClosed) {
			errs = append(errs, fmt.Sprintf("redis close: %v", err))
		}
		d.RedisClient = nil
	}

	if len(errs) > 0 {
		return fmt.Errorf("close errors: %s", strings.Join(errs, "; "))
	}

	return nil
}

/* -------------------- Redis -------------------- */

func NewRedis(addr string, password string, dbIndex int) (*redis.Client, error) {
	if strings.TrimSpace(addr) == "" {
		return nil, errors.New("redis address is empty")
	}

	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       dbIndex,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		_ = client.Close()
		return nil, err
	}

	return client, nil
}

/* -------------------- Helpers -------------------- */

func env(key string, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
