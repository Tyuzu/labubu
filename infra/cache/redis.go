// File: infra/cache/redis.go

package cache

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisCache struct {
	client *redis.Client
}

func NewRedisCache(client *redis.Client) *RedisCache {
	return &RedisCache{
		client: client,
	}
}

// NewCache returns a Cache backed by Redis.
func NewCache(client *redis.Client) Cache {
	return NewRedisCache(client)
}

func (r *RedisCache) Ping(ctx context.Context) ([]byte, error) {
	val, err := r.client.Ping(ctx).Result()
	if err != nil {
		return nil, err
	}

	return []byte(val), nil
}

/* -------------------- Basic KV -------------------- */

func (r *RedisCache) Get(
	ctx context.Context,
	key string,
) ([]byte, error) {
	val, err := r.client.Get(ctx, key).Bytes()

	if err == redis.Nil {
		return []byte{}, nil
	}

	return val, err
}

func (r *RedisCache) Set(
	ctx context.Context,
	key string,
	value []byte,
	ttl time.Duration,
) error {
	return r.client.Set(
		ctx,
		key,
		value,
		ttl,
	).Err()
}

func (r *RedisCache) SetNX(
	ctx context.Context,
	key string,
	value []byte,
	ttl time.Duration,
) (bool, error) {
	return r.client.SetNX(
		ctx,
		key,
		value,
		ttl,
	).Result()
}

func (r *RedisCache) SetWithExpiry(
	ctx context.Context,
	key string,
	value []byte,
	ttl time.Duration,
) error {
	return r.client.Set(
		ctx,
		key,
		value,
		ttl,
	).Err()
}

func (r *RedisCache) Exists(
	ctx context.Context,
	key string,
) (bool, error) {
	n, err := r.client.Exists(
		ctx,
		key,
	).Result()

	if err != nil {
		return false, err
	}

	return n > 0, nil
}

func (r *RedisCache) Del(
	ctx context.Context,
	key string,
) error {
	return r.client.Del(ctx, key).Err()
}

// FlushPattern safely deletes all keys matching a pattern using SCAN.
// Unlike KEYS, SCAN does not block Redis while iterating through the keyspace.
func (r *RedisCache) FlushPattern(
	ctx context.Context,
	pattern string,
) error {
	var cursor uint64

	for {
		keys, nextCursor, err := r.client.Scan(
			ctx,
			cursor,
			pattern,
			100,
		).Result()

		if err != nil {
			return err
		}

		if len(keys) > 0 {
			if err := r.client.Del(ctx, keys...).Err(); err != nil {
				return err
			}
		}

		cursor = nextCursor

		if cursor == 0 {
			break
		}
	}

	return nil
}

/* -------------------- Hash -------------------- */

func (r *RedisCache) HSet(
	ctx context.Context,
	key string,
	field string,
	value []byte,
) error {
	return r.client.HSet(
		ctx,
		key,
		field,
		value,
	).Err()
}

func (r *RedisCache) HGet(
	ctx context.Context,
	key string,
	field string,
) ([]byte, error) {
	val, err := r.client.HGet(
		ctx,
		key,
		field,
	).Bytes()

	if err == redis.Nil {
		return []byte{}, nil
	}

	return val, err
}

func (r *RedisCache) HDel(
	ctx context.Context,
	key string,
	field string,
) (bool, error) {
	n, err := r.client.HDel(
		ctx,
		key,
		field,
	).Result()

	if err != nil {
		return false, err
	}

	return n > 0, nil
}

func (r *RedisCache) HGetAll(
	ctx context.Context,
	key string,
) (map[string]string, error) {
	return r.client.HGetAll(
		ctx,
		key,
	).Result()
}

/* -------------------- Counters -------------------- */

func (r *RedisCache) Incr(
	ctx context.Context,
	key string,
) (int64, error) {
	return r.client.Incr(ctx, key).Result()
}

func (r *RedisCache) Decr(
	ctx context.Context,
	key string,
) (int64, error) {
	return r.client.Decr(ctx, key).Result()
}

func (r *RedisCache) IncrBy(
	ctx context.Context,
	key string,
	value int64,
) (int64, error) {
	return r.client.IncrBy(
		ctx,
		key,
		value,
	).Result()
}

func (r *RedisCache) DecrBy(
	ctx context.Context,
	key string,
	value int64,
) (int64, error) {
	return r.client.DecrBy(
		ctx,
		key,
		value,
	).Result()
}

/* -------------------- Pub/Sub -------------------- */

func (r *RedisCache) Subscribe(
	ctx context.Context,
	channel string,
) *redis.PubSub {
	return r.client.Subscribe(
		ctx,
		channel,
	)
}

func (r *RedisCache) Publish(
	ctx context.Context,
	channel string,
	message any,
) error {
	return r.client.Publish(
		ctx,
		channel,
		message,
	).Err()
}

/* -------------------- Helpers -------------------- */

func IsRedisNil(err error) bool {
	return err == redis.Nil
}
