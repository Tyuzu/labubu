package routes

import (
	"encoding/json"
	"os"
	"testing"
)

func TestPageTemplatesHaveRegisteredRoutes(t *testing.T) {
	required := map[string]string{
		"404.html":             "/404",
		"500.html":             "/500",
		"default-content.html": "/default-content",
		"tool-list.html":       "/tool-list",
	}

	data, err := os.ReadFile("../routes.json")
	if err != nil {
		t.Fatalf("read routes.json: %v", err)
	}

	var routeMap RouteMap
	if err := json.Unmarshal(data, &routeMap); err != nil {
		t.Fatalf("decode routes.json: %v", err)
	}

	seen := map[string]bool{}
	for _, route := range routeMap {
		seen[route.Template] = true
	}

	for templateName, routePath := range required {
		if !seen[templateName] {
			t.Fatalf("missing route for template %q at %q", templateName, routePath)
		}
	}
}

func TestNormalizeCanonicalURLUsesBaseURL(t *testing.T) {
	got := NormalizeCanonicalURL("https://allok.com", "/about", "https://example.com/about")
	want := "https://allok.com/about"
	if got != want {
		t.Fatalf("NormalizeCanonicalURL() = %q, want %q", got, want)
	}
}

func TestNormalizeRouteMetadataUsesAbsoluteImageAndCanonical(t *testing.T) {
	meta := Metadata{
		Canonical: "https://example.com/about",
		OgImage:   "/static/icons/imigi-icon.svg",
	}

	got := NormalizeRouteMetadata("https://allok.com", "/about", meta)
	if got.Canonical != "https://allok.com/about" {
		t.Fatalf("Canonical = %q, want %q", got.Canonical, "https://allok.com/about")
	}
	if got.OgImage != "https://allok.com/static/icons/imigi-icon.svg" {
		t.Fatalf("OgImage = %q, want %q", got.OgImage, "https://allok.com/static/icons/imigi-icon.svg")
	}
}
