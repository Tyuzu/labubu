// File: infra/cache/cache.go

package cache

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

type Cache interface {
	Ping(ctx context.Context) ([]byte, error)

	/* -------------------- KV -------------------- */

	Get(
		ctx context.Context,
		key string,
	) ([]byte, error)

	Set(
		ctx context.Context,
		key string,
		value []byte,
		ttl time.Duration,
	) error

	SetNX(
		ctx context.Context,
		key string,
		value []byte,
		ttl time.Duration,
	) (bool, error)

	SetWithExpiry(
		ctx context.Context,
		key string,
		value []byte,
		ttl time.Duration,
	) error

	Exists(
		ctx context.Context,
		key string,
	) (bool, error)

	Del(
		ctx context.Context,
		key string,
	) error

	FlushPattern(
		ctx context.Context,
		pattern string,
	) error

	/* -------------------- Hash -------------------- */

	HSet(
		ctx context.Context,
		key string,
		field string,
		value []byte,
	) error

	HGet(
		ctx context.Context,
		key string,
		field string,
	) ([]byte, error)

	HDel(
		ctx context.Context,
		key string,
		field string,
	) (bool, error)

	HGetAll(
		ctx context.Context,
		key string,
	) (map[string]string, error)

	/* -------------------- Counters -------------------- */

	Incr(
		ctx context.Context,
		key string,
	) (int64, error)

	Decr(
		ctx context.Context,
		key string,
	) (int64, error)

	IncrBy(
		ctx context.Context,
		key string,
		value int64,
	) (int64, error)

	DecrBy(
		ctx context.Context,
		key string,
		value int64,
	) (int64, error)

	/* -------------------- Pub/Sub -------------------- */

	Subscribe(
		ctx context.Context,
		channel string,
	) *redis.PubSub

	Publish(
		ctx context.Context,
		channel string,
		message any,
	) error
}
