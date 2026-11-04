package main

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
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
