package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html/template"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

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

func dict(values ...interface{}) map[string]interface{} {
	if len(values)%2 != 0 {
		panic("dict requires an even number of key/value arguments")
	}
	result := make(map[string]interface{}, len(values)/2)
	for i := 0; i < len(values); i += 2 {
		key, ok := values[i].(string)
		if !ok {
			key = fmt.Sprint(values[i])
		}
		result[key] = values[i+1]
	}
	return result
}

var templateRenderer = func(name string, data interface{}) template.HTML {
	return template.HTML("")
}

func renderPage(data interface{}) template.HTML {
	name := "content"
	payload := data

	switch v := data.(type) {
	case handlers.PageData:
		if v.TemplateName != "" {
			name = v.TemplateName
		}
		payload = v
	case map[string]interface{}:
		if templateName, ok := v["TemplateName"].(string); ok && templateName != "" {
			name = templateName
		}
		payload = v
	case map[string]string:
		if templateName, ok := v["TemplateName"]; ok && templateName != "" {
			name = templateName
		}
		payload = v
	}

	return templateRenderer(name, payload)
}

func templateFuncMap() template.FuncMap {
	return template.FuncMap{
		"slice":          slice,
		"feature":        feature,
		"toolTile":       toolTile,
		"toolSection":    toolSection,
		"toolPage":       toolPage,
		"pageHeaderData": pageHeaderData,
		"dict":           dict,
		"renderPage":     renderPage,
	}
}

func loadTemplates(dir string) (*template.Template, error) {
	root := filepath.Clean(dir)
	tmpl := template.New("").Funcs(templateFuncMap())

	var matches []string
	if err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() || !strings.EqualFold(filepath.Ext(path), ".html") {
			return nil
		}
		matches = append(matches, path)
		return nil
	}); err != nil {
		return nil, err
	}

	sort.Strings(matches)
	for _, match := range matches {
		parsed, err := tmpl.ParseFiles(match)
		if err != nil {
			return nil, fmt.Errorf("parse template %s: %w", match, err)
		}
		tmpl = parsed
	}

	return tmpl, nil
}

var tmpl = mustLoadTemplates("templates")

func init() {
	templateRenderer = func(name string, data interface{}) template.HTML {
		var buf bytes.Buffer
		if err := tmpl.ExecuteTemplate(&buf, name, data); err != nil {
			_ = tmpl.ExecuteTemplate(&buf, "content", data)
		}
		return template.HTML(buf.String())
	}
}

func mustLoadTemplates(dir string) *template.Template {
	parsed, err := loadTemplates(dir)
	if err != nil {
		panic("Failed to load templates: " + err.Error())
	}
	return parsed
}

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
