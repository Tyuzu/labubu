// File: infra/mq/mq.go

package mq

import "context"

// Message represents a message received from the message queue.
type Message struct {
	Subject string
	Data    []byte
}

// MessageHandler handles a received message.
//
// Return nil:
//     Message processed successfully -> ACK
//
// Return error:
//     Message processing failed -> NACK / retry
type MessageHandler func(
	ctx context.Context,
	msg Message,
) error

// Subscription represents an active MQ subscription.
type Subscription interface {
	Unsubscribe() error
}

// MQ is the application-level message queue interface.
type MQ interface {
	// Publish publishes a message to a subject.
	Publish(
		ctx context.Context,
		subject string,
		data []byte,
	) error

	// Ping checks whether the MQ is available.
	Ping(ctx context.Context) error

	// Subscribe creates a normal subscription.
	//
	// Every subscriber receives matching messages.
	Subscribe(
		ctx context.Context,
		subject string,
		handler MessageHandler,
	) (Subscription, error)

	// QueueSubscribe creates a queue subscription.
	//
	// Multiple application instances using the same queue name
	// share the messages between them.
	QueueSubscribe(
		ctx context.Context,
		subject string,
		queue string,
		handler MessageHandler,
	) (Subscription, error)
}
