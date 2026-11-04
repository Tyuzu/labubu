package handlers

import (
	"encoding/xml"
	"html/template"
	"log"
	"mime"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"imigi/infra"
	rts "imigi/routes"
	"imigi/services"
)

type PageData struct {
	Metadata       rts.Metadata
	App            *infra.Deps
	TemplateName   string
	BackendStatus  services.BackendStatus
	BackendWarning bool
	CurrentYear    int
}

func PageHandler(t *template.Template, app *infra.Deps, templateName string, meta rts.Metadata) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if templateName == "" {
			templateName = "content"
		}

		backendStatus := services.CheckBackendHealth()
		data := PageData{
			Metadata:       meta,
			App:            app,
			TemplateName:   templateName,
			BackendStatus:  backendStatus,
			BackendWarning: backendStatus.ServerUnavailable(),
			CurrentYear:    time.Now().Year(),
		}

		w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
		if err := t.ExecuteTemplate(w, "layout", data); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	}
}

func PanicHandler(app *infra.Deps, t *template.Template) func(http.ResponseWriter, *http.Request, interface{}) {
	return func(w http.ResponseWriter, r *http.Request, err interface{}) {
		log.Printf("PANIC RECOVERED: %v\n", err)
		w.WriteHeader(http.StatusInternalServerError)

		meta := rts.Metadata{
			Title:       "Internal Server Error",
			Description: "An unexpected error occurred.",
		}
		backendStatus := services.CheckBackendHealth()
		data := PageData{Metadata: meta, App: app, TemplateName: "content", BackendStatus: backendStatus, BackendWarning: backendStatus.ServerUnavailable(), CurrentYear: time.Now().Year()}
		_ = t.ExecuteTemplate(w, "layout", data)
	}
}

func NotFoundHandler(app *infra.Deps, t *template.Template) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		meta := rts.Metadata{
			Title:       "Page Not Found",
			Description: "The requested page could not be found.",
		}
		backendStatus := services.CheckBackendHealth()
		data := PageData{Metadata: meta, App: app, TemplateName: "content", BackendStatus: backendStatus, BackendWarning: backendStatus.ServerUnavailable(), CurrentYear: time.Now().Year()}
		_ = t.ExecuteTemplate(w, "layout", data)
	}
}

func StaticHandler() http.Handler {
	return withCacheHeaders(http.StripPrefix("/static", http.FileServer(http.Dir("static"))))
}

func withCacheHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/static/") {
			w.Header().Set("Cache-Control", "public, max-age=86400, immutable")
			if contentType := staticContentType(r.URL.Path); contentType != "" {
				w.Header().Set("Content-Type", contentType)
			}
		} else {
			w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
		}
		next.ServeHTTP(w, r)
	})
}

func staticContentType(path string) string {
	if strings.HasSuffix(strings.ToLower(path), ".css") {
		return "text/css; charset=utf-8"
	}
	if strings.HasSuffix(strings.ToLower(path), ".js") {
		return "application/javascript; charset=utf-8"
	}
	if strings.HasSuffix(strings.ToLower(path), ".json") {
		return "application/json; charset=utf-8"
	}
	if strings.HasSuffix(strings.ToLower(path), ".svg") {
		return "image/svg+xml; charset=utf-8"
	}
	if strings.HasSuffix(strings.ToLower(path), ".webmanifest") {
		return "application/manifest+json; charset=utf-8"
	}
	if strings.HasSuffix(strings.ToLower(path), ".png") {
		return "image/png"
	}
	if strings.HasSuffix(strings.ToLower(path), ".jpg") || strings.HasSuffix(strings.ToLower(path), ".jpeg") {
		return "image/jpeg"
	}
	if strings.HasSuffix(strings.ToLower(path), ".webp") {
		return "image/webp"
	}
	if detected := mime.TypeByExtension(filepath.Ext(path)); detected != "" {
		return detected
	}
	return ""
}

func SitemapHandler(routeMap rts.RouteMap, baseURL string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var urlSet rts.URLSet
		currentDate := time.Now().Format("2006-01-02")

		for _, route := range routeMap {
			if route.Metadata.Robots != "" && strings.Contains(strings.ToLower(route.Metadata.Robots), "noindex") {
				continue
			}
			loc := route.Metadata.Canonical
			if loc == "" {
				loc = baseURL + route.Path
			}
			urlSet.URLs = append(urlSet.URLs, rts.SitemapURL{
				Loc:        loc,
				LastMod:    currentDate,
				ChangeFreq: "weekly",
				Priority:   "0.8",
			})
		}

		w.Header().Set("Content-Type", "application/xml; charset=utf-8")
		_, _ = w.Write([]byte(xml.Header))
		encoder := xml.NewEncoder(w)
		encoder.Indent("", "  ")
		_ = encoder.Encode(urlSet)
	}
}
