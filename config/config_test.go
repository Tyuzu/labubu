package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadEnvReadsDotEnv(t *testing.T) {
	tempDir := t.TempDir()
	dotenvPath := filepath.Join(tempDir, ".env")
	if err := os.WriteFile(dotenvPath, []byte("SERVER_HTTP_PORT=:9090\nREDIS_ADDR=redis:6380\n"), 0o600); err != nil {
		t.Fatalf("write .env: %v", err)
	}

	oldWd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	defer func() { _ = os.Chdir(oldWd) }()

	if err := os.Chdir(tempDir); err != nil {
		t.Fatalf("chdir: %v", err)
	}

	if err := LoadEnv(); err != nil {
		t.Fatalf("LoadEnv() returned error: %v", err)
	}

	if got := os.Getenv("SERVER_HTTP_PORT"); got != ":9090" {
		t.Fatalf("SERVER_HTTP_PORT = %q, want %q", got, ":9090")
	}
	if got := os.Getenv("REDIS_ADDR"); got != "redis:6380" {
		t.Fatalf("REDIS_ADDR = %q, want %q", got, "redis:6380")
	}
}
