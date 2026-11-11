// File: infra/mq/publishWithMeta.go
package mq

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type ctxKey string

const (
	traceIDKey     ctxKey = "trace_id"
	serviceNameKey ctxKey = "service_name"
)

// Helper functions for context keys to ensure type safety outside the package.
func WithTraceID(ctx context.Context, traceID string) context.Context {
	return context.WithValue(ctx, traceIDKey, traceID)
}

func WithServiceName(ctx context.Context, name string) context.Context {
	return context.WithValue(ctx, serviceNameKey, name)
}

func TraceIDFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(traceIDKey).(string); ok {
		return v
	}
	return ""
}

func ServiceNameFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(serviceNameKey).(string); ok {
		return v
	}
	return ""
}

// EventEnvelope is a standardized wrapper for all published events.
type EventEnvelope struct {
	ID            string          `json:"id"`
	Type          string          `json:"type"`
	Version       int             `json:"version"`
	Timestamp     time.Time       `json:"timestamp"`
	Source        string          `json:"source,omitempty"`
	TraceID       string          `json:"trace_id,omitempty"`
	CorrelationID string          `json:"correlation_id,omitempty"`
	Payload       json.RawMessage `json:"payload"`
}

// RetryConfig configures retry behavior for publishing messages.
type RetryConfig struct {
	MaxAttempts int
	InitialWait time.Duration
}

var DefaultRetryConfig = RetryConfig{
	MaxAttempts: 4,
	InitialWait: 100 * time.Millisecond,
}

// PublishWithMeta marshals payload into an EventEnvelope, attaches metadata, and publishes using MQ with retries.
func PublishWithMeta(ctx context.Context, m MQ, subject string, payload any, retry ...RetryConfig) error {
	if m == nil {
		return errors.New("mq client is nil")
	}

	cfg := DefaultRetryConfig
	if len(retry) > 0 {
		cfg = retry[0]
	}

	// 1. Marshal payload into json.RawMessage to prevent double-encoding base64 strings in json.Marshal(env)
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	env := EventEnvelope{
		ID:        uuid.NewString(),
		Type:      subject,
		Version:   1,
		Timestamp: time.Now().UTC(),
		Payload:   json.RawMessage(payloadBytes),
	}

	if v := TraceIDFromContext(ctx); v != "" {
		env.TraceID = v
	}
	if v := ServiceNameFromContext(ctx); v != "" {
		env.Source = v
	}

	// 2. Marshal the full envelope
	data, err := json.Marshal(env)
	if err != nil {
		return fmt.Errorf("marshal envelope: %w", err)
	}

	// ------------------------------------------------------------------
	// FIRE AND FORGET: Dispatches request to Flask asynchronously
	// ------------------------------------------------------------------
	// python.SendToFlaskServerAsync(data)
	// ------------------------------------------------------------------

	backoff := cfg.InitialWait

	for attempt := 0; attempt < cfg.MaxAttempts; attempt++ {
		err := m.Publish(ctx, subject, data)
		if err == nil {
			return nil
		}

		if attempt == cfg.MaxAttempts-1 {
			return fmt.Errorf("publish failed after %d attempts: %w", cfg.MaxAttempts, err)
		}

		timer := time.NewTimer(backoff)
		select {
		case <-ctx.Done():
			timer.Stop()
			return fmt.Errorf("publish canceled: %w", ctx.Err())
		case <-timer.C:
		}

		backoff *= 2
	}

	return nil
}

// UnpackEnvelope unmarshals raw payload bytes into an EventEnvelope.
func UnpackEnvelope(data []byte) (*EventEnvelope, error) {
	var env EventEnvelope
	if err := json.Unmarshal(data, &env); err != nil {
		return nil, fmt.Errorf("unmarshal envelope: %w", err)
	}
	return &env, nil
}
