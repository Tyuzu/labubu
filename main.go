package main

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"html/template"
	"imigi/config"
	"imigi/infra"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime/debug"
	"strconv"
	"strings"
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

	// 5. Self-hosted video processing endpoint using native FFmpeg
	router.POST("/api/video/process", VideoProcessHandler)

	// 6. Dynamically register all routes from routes.json
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

func VideoProcessHandler(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	if err := r.ParseMultipartForm(200 << 20); err != nil {
		http.Error(w, "Unable to parse upload", http.StatusBadRequest)
		return
	}

	action := r.FormValue("action")
	file, header, err := r.FormFile("video")
	if err != nil {
		http.Error(w, "Video file is required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	ffmpegPath, err := exec.LookPath("ffmpeg")
	if err != nil {
		http.Error(w, "Self-hosted FFmpeg is not available on this server. Choose the CDN option instead.", http.StatusServiceUnavailable)
		return
	}

	tempDir, err := os.MkdirTemp("", "imigi-video-")
	if err != nil {
		http.Error(w, "Unable to create working directory", http.StatusInternalServerError)
		return
	}
	defer os.RemoveAll(tempDir)

	inputExt := filepath.Ext(header.Filename)
	if inputExt == "" {
		inputExt = ".mp4"
	}
	inputPath := filepath.Join(tempDir, "input"+inputExt)
	outputPath := filepath.Join(tempDir, "output.mp4")

	outFile, err := os.Create(inputPath)
	if err != nil {
		http.Error(w, "Unable to save uploaded video", http.StatusInternalServerError)
		return
	}
	if _, err = io.Copy(outFile, file); err != nil {
		outFile.Close()
		http.Error(w, "Unable to read uploaded video", http.StatusInternalServerError)
		return
	}
	outFile.Close()

	args := []string{"-y", "-i", inputPath}
	switch action {
	case "crop":
		widthValue, heightValue := r.FormValue("width"), r.FormValue("height")
		xValue, yValue := r.FormValue("x"), r.FormValue("y")
		if widthValue == "" || heightValue == "" {
			http.Error(w, "Crop width and height are required", http.StatusBadRequest)
			return
		}
		args = append(args, "-vf", fmt.Sprintf("crop=%s:%s:%s:%s", widthValue, heightValue, xValue, yValue), "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-movflags", "+faststart", outputPath)
	case "trim":
		start := r.FormValue("start")
		end := r.FormValue("end")
		if start == "" || end == "" {
			http.Error(w, "Trim start and end values are required", http.StatusBadRequest)
			return
		}
		args = append(args, "-ss", start, "-to", end, "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-movflags", "+faststart", outputPath)
	case "filter":
		filter := r.FormValue("filter")
		if filter == "" {
			filter = "cinematic"
		}
		filterMap := map[string]string{
			"cinematic": "eq=contrast=1.15:saturation=1.35:brightness=0.04",
			"warm":      "eq=contrast=1.1:saturation=1.4:brightness=0.08",
			"cool":      "eq=contrast=1.2:saturation=0.95:brightness=-0.03",
			"vintage":   "eq=contrast=1.35:saturation=0.8:brightness=0.06",
			"contrast":  "eq=contrast=1.6:saturation=1.2:brightness=0.02",
		}
		args = append(args, "-vf", filterMap[filter], "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-movflags", "+faststart", outputPath)
	default:
		http.Error(w, "Unsupported video action", http.StatusBadRequest)
		return
	}

	cmd := exec.Command(ffmpegPath, args...)
	cmd.Dir = tempDir
	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("FFmpeg error: %v\n%s", err, string(output))
		http.Error(w, fmt.Sprintf("The self-hosted FFmpeg job failed: %s", strings.TrimSpace(string(output))), http.StatusInternalServerError)
		return
	}

	resultBytes, err := os.ReadFile(outputPath)
	if err != nil {
		http.Error(w, "Unable to read processed video", http.StatusInternalServerError)
		return
	}

	fileName := "processed-video.mp4"
	if strings.TrimSpace(header.Filename) != "" {
		fileName = strings.TrimSuffix(filepath.Base(header.Filename), filepath.Ext(header.Filename)) + "-processed.mp4"
	}

	w.Header().Set("Content-Type", "video/mp4")
	w.Header().Set("Content-Disposition", "attachment; filename=\""+fileName+"\"")
	w.Header().Set("Content-Length", strconv.Itoa(len(resultBytes)))
	_, _ = w.Write(resultBytes)
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
