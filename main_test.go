package main

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"imigi/config"
)

func TestLoadTemplatesIncludesNestedTemplates(t *testing.T) {
	dir := t.TempDir()

	if err := os.MkdirAll(filepath.Join(dir, "templates", "ui"), 0o755); err != nil {
		t.Fatalf("mkdir ui: %v", err)
	}
	if err := os.MkdirAll(filepath.Join(dir, "templates", "components"), 0o755); err != nil {
		t.Fatalf("mkdir components: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "templates", "ui", "button.html"), []byte(`{{define "uiButton"}}<button>{{.}}</button>{{end}}`), 0o644); err != nil {
		t.Fatalf("write button template: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "templates", "components", "card.html"), []byte(`{{define "card"}}<article>{{template "uiButton" .}}</article>{{end}}`), 0o644); err != nil {
		t.Fatalf("write card template: %v", err)
	}

	tmpl, err := loadTemplates(filepath.Join(dir, "templates"))
	if err != nil {
		t.Fatalf("loadTemplates returned error: %v", err)
	}

	var buf bytes.Buffer
	if err := tmpl.ExecuteTemplate(&buf, "card", "Click me"); err != nil {
		t.Fatalf("execute nested template: %v", err)
	}

	if got, want := buf.String(), "<article><button>Click me</button></article>"; got != want {
		t.Fatalf("rendered template mismatch: got %q, want %q", got, want)
	}
}

func TestWithSecurityHeadersSetsHardenedDefaults(t *testing.T) {
	handler := withSecurityHeaders(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	res := httptest.NewRecorder()

	handler.ServeHTTP(res, req)

	if got, want := res.Header().Get("X-Content-Type-Options"), "nosniff"; got != want {
		t.Fatalf("X-Content-Type-Options mismatch: got %q, want %q", got, want)
	}
	if got, want := res.Header().Get("X-Frame-Options"), "DENY"; got != want {
		t.Fatalf("X-Frame-Options mismatch: got %q, want %q", got, want)
	}
	if got, want := res.Header().Get("Referrer-Policy"), "strict-origin-when-cross-origin"; got != want {
		t.Fatalf("Referrer-Policy mismatch: got %q, want %q", got, want)
	}
	if got, want := res.Header().Get("Content-Security-Policy"), "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"; got != want {
		t.Fatalf("Content-Security-Policy mismatch: got %q, want %q", got, want)
	}
}

func TestNewHTTPServerUsesSafeTimeouts(t *testing.T) {
	cfg := &config.Config{
		SERVER_HTTP_PORT:  "127.0.0.1:0",
		ReadTimeout:       5 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       30 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		MaxHeaderBytes:    1048576,
	}

	srv := newHTTPServer(cfg, http.NewServeMux())
	if srv.Addr != cfg.SERVER_HTTP_PORT {
		t.Fatalf("server address mismatch: got %q, want %q", srv.Addr, cfg.SERVER_HTTP_PORT)
	}
	if srv.ReadTimeout != cfg.ReadTimeout || srv.WriteTimeout != cfg.WriteTimeout || srv.IdleTimeout != cfg.IdleTimeout || srv.ReadHeaderTimeout != cfg.ReadHeaderTimeout || srv.MaxHeaderBytes != cfg.MaxHeaderBytes {
		t.Fatalf("server timeout configuration not applied: %+v", srv)
	}
}
