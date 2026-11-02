package main

import (
	"encoding/json"
	"encoding/xml"
	"html/template"
	"imigi/config"
	"imigi/infra"
	"log"
	"net/http"
	"os"
	"runtime/debug"
	"time"

	"github.com/julienschmidt/httprouter"
)

var tmpl = template.Must(template.ParseGlob("templates/*.html"))

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

type PageData struct {
	Metadata     Metadata
	App          *infra.Deps
	TemplateName string
}

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

func main() {
	cfg := config.New()
	app := infra.New()

	fileBytes, err := os.ReadFile("routes.json")
	if err != nil {
		panic("Failed to read routes.json: " + err.Error())
	}

	var routes RouteMap
	if err := json.Unmarshal(fileBytes, &routes); err != nil {
		panic("Failed to parse routes.json: " + err.Error())
	}

	router := httprouter.New()

	// 1. Serve Static Assets (CSS, JS, Images)
	// Any request starting with /static/ will look inside the local "static" directory
	router.ServeFiles("/static/*filepath", http.Dir("static"))

	// 2. Custom Panic Recovery Handler (500 Error)
	router.PanicHandler = func(w http.ResponseWriter, r *http.Request, err interface{}) {
		log.Printf("PANIC RECOVERED: %v\n%s", err, debug.Stack())
		w.WriteHeader(http.StatusInternalServerError)

		meta := Metadata{
			Title:       "Internal Server Error",
			Description: "An unexpected error occurred.",
		}
		data := PageData{Metadata: meta, App: app, TemplateName: "content"}
		_ = tmpl.ExecuteTemplate(w, "layout", data)
	}

	// 3. Custom 404 Not Found Handler
	router.NotFound = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		meta := Metadata{
			Title:       "Page Not Found",
			Description: "The requested page could not be found.",
		}
		data := PageData{Metadata: meta, App: app, TemplateName: "content"}
		_ = tmpl.ExecuteTemplate(w, "layout", data)
	})

	// 4. Register XML Sitemap Endpoint
	router.HandlerFunc(http.MethodGet, "/sitemap.xml", SitemapHandler(routes, "https://example.com"))

	// 5. Dynamically register all routes from routes.json
	for _, route := range routes {
		router.Handler(
			http.MethodGet,
			route.Path,
			PageHandler(tmpl, app, route.Template, route.Metadata),
		)
	}

	log.Printf("Server starting on port %s...", cfg.SERVER_HTTP_PORT)
	http.ListenAndServe(cfg.SERVER_HTTP_PORT, router)
}

func PageHandler(t *template.Template, app *infra.Deps, templateName string, meta Metadata) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if templateName == "" {
			templateName = "content"
		}

		data := PageData{
			Metadata:     meta,
			App:          app,
			TemplateName: templateName,
		}

		err := t.ExecuteTemplate(w, "layout", data)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	}
}

func SitemapHandler(routes RouteMap, baseURL string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var urlSet URLSet
		currentDate := time.Now().Format("2006-01-02")

		for _, route := range routes {
			if route.Metadata.Robots != "" && contains(route.Metadata.Robots, "noindex") {
				continue
			}

			loc := route.Metadata.Canonical
			if loc == "" {
				loc = baseURL + route.Path
			}

			urlSet.URLs = append(urlSet.URLs, SitemapURL{
				Loc:        loc,
				LastMod:    currentDate,
				ChangeFreq: "weekly",
				Priority:   "0.8",
			})
		}

		w.Header().Set("Content-Type", "application/xml; charset=utf-8")
		w.Write([]byte(xml.Header))

		encoder := xml.NewEncoder(w)
		encoder.Indent("", "  ")
		_ = encoder.Encode(urlSet)
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
