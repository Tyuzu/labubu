package routes

import (
	"encoding/xml"
	"os"
	"strings"
)

type Metadata struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Keywords    string `json:"keywords"`
	OgImage     string `json:"og_image"`
	Robots      string `json:"robots"`
	Canonical   string `json:"canonical"`
}

type RouteConfig struct {
	Path     string   `json:"path"`
	Template string   `json:"template"`
	Metadata Metadata `json:"metadata"`
}

type RouteMap map[string]RouteConfig

type SitemapURL struct {
	Loc        string `xml:"loc"`
	LastMod    string `xml:"lastmod,omitempty"`
	ChangeFreq string `xml:"changefreq,omitempty"`
	Priority   string `xml:"priority,omitempty"`
}

type URLSet struct {
	XMLName xml.Name     `xml:"http://www.sitemaps.org/schemas/sitemap/0.9 urlset"`
	URLs    []SitemapURL `xml:"url"`
}

func DefaultBaseURL() string {
	if value := strings.TrimSpace(os.Getenv("PUBLIC_BASE_URL")); value != "" {
		return strings.TrimRight(value, "/")
	}
	if value := strings.TrimSpace(os.Getenv("APP_BASE_URL")); value != "" {
		return strings.TrimRight(value, "/")
	}
	return "https://allok.com"
}

func NormalizeRoutes(routes RouteMap) RouteMap {
	baseURL := DefaultBaseURL()
	for key, route := range routes {
		route.Metadata = NormalizeRouteMetadata(baseURL, route.Path, route.Metadata)
		routes[key] = route
	}
	return routes
}

func NormalizeRouteMetadata(baseURL, routePath string, meta Metadata) Metadata {
	meta.Canonical = NormalizeCanonicalURL(baseURL, routePath, meta.Canonical)
	if strings.HasPrefix(meta.OgImage, "/") {
		meta.OgImage = strings.TrimRight(baseURL, "/") + meta.OgImage
	}
	return meta
}

func NormalizeCanonicalURL(baseURL, routePath, raw string) string {
	if strings.TrimSpace(raw) == "" {
		return strings.TrimRight(baseURL, "/") + routePath
	}
	trimmed := strings.TrimSpace(raw)
	if strings.Contains(strings.ToLower(trimmed), "example.com") {
		return strings.TrimRight(baseURL, "/") + routePath
	}
	return strings.TrimRight(trimmed, "/")
}
