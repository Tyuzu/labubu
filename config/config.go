package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	SERVER_HTTP_PORT  string
	ReadTimeout       time.Duration
	WriteTimeout      time.Duration
	IdleTimeout       time.Duration
	ReadHeaderTimeout time.Duration
	MaxHeaderBytes    int
	ShutdownTimeout   time.Duration
}

func envString(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func envDuration(key string, fallback time.Duration) time.Duration {
	if raw := strings.TrimSpace(os.Getenv(key)); raw != "" {
		if value, err := time.ParseDuration(raw); err == nil {
			return value
		}
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if raw := strings.TrimSpace(os.Getenv(key)); raw != "" {
		if value, err := strconv.Atoi(raw); err == nil {
			return value
		}
	}
	return fallback
}

func New() *Config {
	port := envString("SERVER_HTTP_PORT", envString("PORT", "0.0.0.0:4000"))
	return &Config{
		SERVER_HTTP_PORT:  port,
		ReadTimeout:       envDuration("HTTP_READ_TIMEOUT", 5*time.Second),
		WriteTimeout:      envDuration("HTTP_WRITE_TIMEOUT", 15*time.Second),
		IdleTimeout:       envDuration("HTTP_IDLE_TIMEOUT", 30*time.Second),
		ReadHeaderTimeout: envDuration("HTTP_READ_HEADER_TIMEOUT", 5*time.Second),
		MaxHeaderBytes:    envInt("HTTP_MAX_HEADER_BYTES", 1<<20),
		ShutdownTimeout:   envDuration("HTTP_SHUTDOWN_TIMEOUT", 10*time.Second),
	}
}
