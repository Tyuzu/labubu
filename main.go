package main

import (
	"encoding/json"
	"html/template"
	"log"
	"net/http"
	"os"

	"imigi/config"
	"imigi/handlers"
	"imigi/infra"
	rts "imigi/routes"

	"github.com/julienschmidt/httprouter"
)

func slice(values ...interface{}) []interface{} {
	return values
}

func feature(icon, title, description string) map[string]string {
	return map[string]string{
		"Icon":        icon,
		"Title":       title,
		"Description": description,
	}
}

func toolTile(href, label, meta string) map[string]string {
	return map[string]string{
		"Href":  href,
		"Label": label,
		"Meta":  meta,
	}
}

func toolSection(eyebrow, title string, items []interface{}) map[string]interface{} {
	return map[string]interface{}{
		"Eyebrow": eyebrow,
		"Title":   title,
		"Items":   items,
	}
}

func toolPage(eyebrow, title, description string, features []interface{}, section map[string]interface{}) map[string]interface{} {
	return map[string]interface{}{
		"Eyebrow":     eyebrow,
		"Title":       title,
		"Description": description,
		"Features":    features,
		"ToolSection": section,
	}
}

func pageHeaderData(eyebrow, title, description string) map[string]string {
	return map[string]string{
		"Eyebrow":     eyebrow,
		"Title":       title,
		"Description": description,
	}
}

var tmpl = template.Must(template.New("").Funcs(template.FuncMap{
	"slice":          slice,
	"feature":        feature,
	"toolTile":       toolTile,
	"toolSection":    toolSection,
	"toolPage":       toolPage,
	"pageHeaderData": pageHeaderData,
}).ParseGlob("templates/*.html"))

func main() {
	cfg := config.New()
	app := infra.New()

	fileBytes, err := os.ReadFile("routes.json")
	if err != nil {
		panic("Failed to read routes.json: " + err.Error())
	}

	var routeMap rts.RouteMap
	if err := json.Unmarshal(fileBytes, &routeMap); err != nil {
		panic("Failed to parse routes.json: " + err.Error())
	}

	routeMap = rts.NormalizeRoutes(routeMap)

	router := httprouter.New()
	router.Handler(http.MethodGet, "/static/*filepath", handlers.StaticHandler())
	router.PanicHandler = handlers.PanicHandler(app, tmpl)
	router.NotFound = handlers.NotFoundHandler(app, tmpl)

	baseURL := rts.DefaultBaseURL()
	router.HandlerFunc(http.MethodGet, "/sitemap.xml", handlers.SitemapHandler(routeMap, baseURL))
	router.HandlerFunc(http.MethodGet, "/api/health", handlers.HealthHandler())
	router.POST("/api/video/process", handlers.VideoProcessHandler)
	router.POST("/api/pdf/process", handlers.PdfProcessHandler)

	for _, route := range routeMap {
		router.Handler(http.MethodGet, route.Path, handlers.PageHandler(tmpl, app, route.Template, route.Metadata))
	}

	log.Printf("Server starting on port %s...", cfg.SERVER_HTTP_PORT)
	if err := http.ListenAndServe(cfg.SERVER_HTTP_PORT, router); err != nil {
		log.Fatal(err)
	}
}
