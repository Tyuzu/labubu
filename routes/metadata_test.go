package routes

import "testing"

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
