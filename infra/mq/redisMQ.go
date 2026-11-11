package mq

import (
	"context"
	"errors"
	"fmt"
	"imigi/infra/logger"

	"github.com/redis/go-redis/v9"
)

type redisMQ struct {
	client *redis.Client
}

type redisSubscription struct {
	pubsub *redis.PubSub
}

func (s *redisSubscription) Unsubscribe() error {
	if s == nil || s.pubsub == nil {
		return nil
	}

	if err := s.pubsub.Close(); err != nil && !errors.Is(err, redis.ErrClosed) {
		return fmt.Errorf("redis pubsub close: %w", err)
	}

	return nil
}

// NewRedisMQ creates an MQ implementation backed by Redis Pub/Sub.
func NewRedisMQ(client *redis.Client) MQ {
	if client == nil {
		return nil
	}

	return &redisMQ{
		client: client,
	}
}

func (r *redisMQ) Publish(
	ctx context.Context,
	subject string,
	data []byte,
) error {
	if r == nil || r.client == nil {
		return errors.New("redis client is nil")
	}

	if ctx == nil {
		ctx = context.Background()
	}

	if subject == "" {
		return errors.New("publish subject is empty")
	}

	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	if err := r.client.Publish(
		ctx,
		subject,
		data,
	).Err(); err != nil {
		return fmt.Errorf(
			"redis publish subject=%q: %w",
			subject,
			err,
		)
	}

	return nil
}

func (r *redisMQ) Ping(
	ctx context.Context,
) error {
	if r == nil || r.client == nil {
		return errors.New("redis client is nil")
	}

	if ctx == nil {
		ctx = context.Background()
	}

	if err := r.client.Ping(ctx).Err(); err != nil {
		return fmt.Errorf(
			"redis mq ping failed: %w",
			err,
		)
	}

	return nil
}

func (r *redisMQ) Subscribe(
	ctx context.Context,
	subject string,
	handler MessageHandler,
) (Subscription, error) {
	if r == nil || r.client == nil {
		return nil, errors.New("redis client is nil")
	}

	if ctx == nil {
		return nil, errors.New("subscription context is nil")
	}

	if subject == "" {
		return nil, errors.New("subscription subject is empty")
	}

	if handler == nil {
		return nil, fmt.Errorf(
			"subscription handler is nil for subject=%q",
			subject,
		)
	}

	pubsub := r.client.Subscribe(
		ctx,
		subject,
	)

	if _, err := pubsub.Receive(ctx); err != nil {
		_ = pubsub.Close()

		return nil, fmt.Errorf(
			"redis subscribe subject=%q: %w",
			subject,
			err,
		)
	}

	go r.consume(
		ctx,
		pubsub,
		handler,
	)

	return &redisSubscription{
		pubsub: pubsub,
	}, nil
}

// QueueSubscribe provides worker-style consumption.
//
// Redis Pub/Sub itself does not have JetStream-style durable
// consumer semantics. This implementation uses a Redis channel
// subscription and therefore every subscriber receives published
// messages. The queue parameter is retained to satisfy the MQ
// abstraction.
func (r *redisMQ) QueueSubscribe(
	ctx context.Context,
	subject string,
	queue string,
	handler MessageHandler,
) (Subscription, error) {
	if queue == "" {
		return nil, errors.New(
			"subscription queue is empty",
		)
	}

	/*
		Redis Pub/Sub does not provide queue groups like NATS.

		Use the queue name as a separate channel so that callers
		can explicitly publish/subscribe to that channel if they
		need isolated consumers.
	*/
	queueSubject := fmt.Sprintf(
		"%s:%s",
		queue,
		subject,
	)

	return r.Subscribe(
		ctx,
		queueSubject,
		handler,
	)
}

func (r *redisMQ) consume(
	ctx context.Context,
	pubsub *redis.PubSub,
	handler MessageHandler,
) {
	if pubsub == nil {
		return
	}

	for {
		msg, err := pubsub.ReceiveMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return
			}

			logger.L.Sugar().Errorw(
				"redis pubsub receive failed",
				"error", err,
			)

			return
		}

		if msg == nil {
			continue
		}

		message := Message{
			Subject: msg.Channel,
			Data:    []byte(msg.Payload),
		}

		handlerCtx, cancel := context.WithCancel(ctx)

		err = handler(
			handlerCtx,
			message,
		)

		cancel()

		if err != nil {
			logger.L.Sugar().Warnw(
				"Redis MQ message processing failed",
				"subject", msg.Channel,
				"error", err,
			)

			/*
				Redis Pub/Sub has no ACK/NACK mechanism.

				The message is already gone once received.
			*/
			continue
		}

		logger.L.Sugar().Debugw(
			"Redis MQ message processed",
			"subject", msg.Channel,
		)
	}
}
