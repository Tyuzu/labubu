package handlers

import (
	"bytes"
	"fmt"
	"html/template"
	"testing"
	"time"
)

func TestPageDataIncludesCurrentYear(t *testing.T) {
	currentYear := time.Now().Year()
	tmpl := template.Must(template.New("footer").Parse(`{{define "footer"}}&copy; {{.CurrentYear}} Imigi App. All rights reserved.{{end}}`))

	var buf bytes.Buffer
	if err := tmpl.ExecuteTemplate(&buf, "footer", PageData{CurrentYear: currentYear}); err != nil {
		t.Fatalf("render footer: %v", err)
	}

	want := fmt.Sprintf("&copy; %d Imigi App. All rights reserved.", currentYear)
	if got := buf.String(); got != want {
		t.Fatalf("footer rendered unexpectedly: got %q, want %q", got, want)
	}
}
