// File: infra/cache/cache_test.go

package cache

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func setupTestRedis(t *testing.T) (*RedisCache, *miniredis.Miniredis) {
	t.Helper()
	mr := miniredis.RunT(t)

	client := redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	})

	return NewRedisCache(client), mr
}

func TestRedisCache_KV(t *testing.T) {
	cache, _ := setupTestRedis(t)
	ctx := context.Background()

	t.Run("Set and Get key", func(t *testing.T) {
		key := "test:key:1"
		val := []byte("hello world")

		err := cache.Set(ctx, key, val, time.Minute)
		if err != nil {
			t.Fatalf("unexpected error setting key: %v", err)
		}

		got, err := cache.Get(ctx, key)
		if err != nil {
			t.Fatalf("unexpected error getting key: %v", err)
		}
		if string(got) != string(val) {
			t.Errorf("got %s, want %s", got, val)
		}
	})

	t.Run("Get missing key returns empty slice without error", func(t *testing.T) {
		got, err := cache.Get(ctx, "nonexistent")
		if err != nil {
			t.Fatalf("expected no error, got: %v", err)
		}
		if len(got) != 0 {
			t.Errorf("expected empty byte slice, got %v", got)
		}
	})

	t.Run("SetNX behavior", func(t *testing.T) {
		key := "test:setnx"
		ok, err := cache.SetNX(ctx, key, []byte("first"), time.Minute)
		if err != nil || !ok {
			t.Fatalf("expected SetNX to succeed, ok=%v, err=%v", ok, err)
		}

		ok, err = cache.SetNX(ctx, key, []byte("second"), time.Minute)
		if err != nil || ok {
			t.Fatalf("expected SetNX to fail on existing key, ok=%v, err=%v", ok, err)
		}
	})

	t.Run("Exists and Del", func(t *testing.T) {
		key := "test:del"
		_ = cache.Set(ctx, key, []byte("data"), time.Minute)

		exists, err := cache.Exists(ctx, key)
		if err != nil || !exists {
			t.Fatalf("expected key to exist")
		}

		if err := cache.Del(ctx, key); err != nil {
			t.Fatalf("failed to delete key: %v", err)
		}

		exists, _ = cache.Exists(ctx, key)
		if exists {
			t.Errorf("expected key to be deleted")
		}
	})
}

func TestRedisCache_FlushPattern(t *testing.T) {
	cache, _ := setupTestRedis(t)
	ctx := context.Background()

	t.Run("FlushPattern removes matching keys and leaves non-matching intact", func(t *testing.T) {
		// Seed matching and non-matching keys
		_ = cache.Set(ctx, "ads:home:top", []byte("1"), time.Minute)
		_ = cache.Set(ctx, "ads:recipes:sidebar", []byte("2"), time.Minute)
		_ = cache.Set(ctx, "ads:user:123", []byte("3"), time.Minute)
		_ = cache.Set(ctx, "users:profile:123", []byte("keep_me"), time.Minute)

		err := cache.FlushPattern(ctx, "ads:*")
		if err != nil {
			t.Fatalf("FlushPattern failed: %v", err)
		}

		// Verify matching keys were deleted
		for _, key := range []string{"ads:home:top", "ads:recipes:sidebar", "ads:user:123"} {
			exists, _ := cache.Exists(ctx, key)
			if exists {
				t.Errorf("expected key %s to be deleted by FlushPattern", key)
			}
		}

		// Verify non-matching key is still present
		exists, _ := cache.Exists(ctx, "users:profile:123")
		if !exists {
			t.Errorf("expected non-matching key users:profile:123 to remain")
		}
	})
}

func TestRedisCache_HashAndCounters(t *testing.T) {
	cache, _ := setupTestRedis(t)
	ctx := context.Background()

	t.Run("HSet, HGet, HDel, and HGetAll", func(t *testing.T) {
		hashKey := "ad:stats:1"
		_ = cache.HSet(ctx, hashKey, "impressions", []byte("100"))
		_ = cache.HSet(ctx, hashKey, "clicks", []byte("10"))

		val, err := cache.HGet(ctx, hashKey, "impressions")
		if err != nil || string(val) != "100" {
			t.Fatalf("HGet failed, got: %s, err: %v", val, err)
		}

		all, err := cache.HGetAll(ctx, hashKey)
		if err != nil || len(all) != 2 {
			t.Fatalf("HGetAll failed, got: %v", all)
		}

		deleted, err := cache.HDel(ctx, hashKey, "clicks")
		if err != nil || !deleted {
			t.Fatalf("HDel failed, deleted=%v", deleted)
		}
	})

	t.Run("Incr counter", func(t *testing.T) {
		key := "ad:impressions:test_id"
		val1, err := cache.Incr(ctx, key)
		if err != nil || val1 != 1 {
			t.Fatalf("expected 1, got %d, err: %v", val1, err)
		}

		val2, _ := cache.Incr(ctx, key)
		if val2 != 2 {
			t.Fatalf("expected 2, got %d", val2)
		}
	})
}
