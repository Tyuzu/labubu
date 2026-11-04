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
	"mime"
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

	routes = normalizeRoutes(routes)

	router := httprouter.New()

	staticHandler := withCacheHeaders(http.StripPrefix("/static", http.FileServer(http.Dir("static"))))
	// 1. Serve Static Assets (CSS, JS, Images)
	// Any request starting with /static/ will look inside the local "static" directory
	router.Handler(http.MethodGet, "/static/*filepath", staticHandler)

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
	baseURL := defaultBaseURL()
	router.HandlerFunc(http.MethodGet, "/sitemap.xml", SitemapHandler(routes, baseURL))

	// 5. Self-hosted video processing endpoint using native FFmpeg
	router.POST("/api/video/process", VideoProcessHandler)

	// 6. Self-hosted PDF processing endpoint with browser fallback support
	router.POST("/api/pdf/process", PdfProcessHandler)

	// 7. Dynamically register all routes from routes.json
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

		w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
		err := t.ExecuteTemplate(w, "layout", data)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	}
}

func defaultBaseURL() string {
	if value := strings.TrimSpace(os.Getenv("PUBLIC_BASE_URL")); value != "" {
		return strings.TrimRight(value, "/")
	}
	if value := strings.TrimSpace(os.Getenv("APP_BASE_URL")); value != "" {
		return strings.TrimRight(value, "/")
	}
	return "https://imigi.app"
}

func normalizeRoutes(routes RouteMap) RouteMap {
	baseURL := defaultBaseURL()
	for key, route := range routes {
		route.Metadata = normalizeRouteMetadata(baseURL, route.Path, route.Metadata)
		routes[key] = route
	}
	return routes
}

func normalizeRouteMetadata(baseURL, routePath string, meta Metadata) Metadata {
	meta.Canonical = normalizeCanonicalURL(baseURL, routePath, meta.Canonical)
	if strings.HasPrefix(meta.OgImage, "/") {
		meta.OgImage = strings.TrimRight(baseURL, "/") + meta.OgImage
	}
	return meta
}

func normalizeCanonicalURL(baseURL, routePath, raw string) string {
	if strings.TrimSpace(raw) == "" {
		return strings.TrimRight(baseURL, "/") + routePath
	}
	trimmed := strings.TrimSpace(raw)
	if strings.Contains(strings.ToLower(trimmed), "example.com") {
		return strings.TrimRight(baseURL, "/") + routePath
	}
	return strings.TrimRight(trimmed, "/")
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
	outputFormat := strings.ToLower(r.FormValue("format"))
	if outputFormat == "" {
		outputFormat = "mp4"
	}
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
	outputExt := ".mp4"
	if outputFormat == "webm" {
		outputExt = ".webm"
	} else if outputFormat == "mov" {
		outputExt = ".mov"
	}
	outputPath := filepath.Join(tempDir, "output"+outputExt)

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
	codecName := "libx264"
	audioCodec := "aac"
	if outputFormat == "webm" {
		codecName = "libvpx-vp9"
		audioCodec = "libopus"
	}
	switch action {
	case "crop":
		widthValue, heightValue := r.FormValue("width"), r.FormValue("height")
		xValue, yValue := r.FormValue("x"), r.FormValue("y")
		if widthValue == "" || heightValue == "" {
			http.Error(w, "Crop width and height are required", http.StatusBadRequest)
			return
		}
		args = append(args, "-vf", fmt.Sprintf("crop=%s:%s:%s:%s", widthValue, heightValue, xValue, yValue), "-c:v", codecName, "-preset", "veryfast", "-c:a", audioCodec, outputPath)
	case "trim":
		start := r.FormValue("start")
		end := r.FormValue("end")
		if start == "" || end == "" {
			http.Error(w, "Trim start and end values are required", http.StatusBadRequest)
			return
		}
		args = append(args, "-ss", start, "-to", end, "-c:v", codecName, "-preset", "veryfast", "-c:a", audioCodec, outputPath)
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
			"grayscale": "eq=contrast=1.12:saturation=0.1:brightness=0.02",
			"sepia":     "eq=contrast=1.18:saturation=0.8:brightness=0.05,colorchannelmixer=rr=1.2:gg=0.8:bb=0.6",
			"noir":      "curves=r='0.2':0.4:1.0/0.0:1.0,curves=g='0.2':0.4:1.0/0.0:1.0,curves=b='0.2':0.4:1.0/0.0:1.0",
			"sharp":     "unsharp=5:5:1.2:5:5:0.8",
			"sunset":    "eq=contrast=1.25:saturation=1.5:brightness=0.09",
			"dreamy":    "eq=contrast=1.08:saturation=1.1:brightness=0.08",
		}
		args = append(args, "-vf", filterMap[filter], "-c:v", codecName, "-preset", "veryfast", "-c:a", audioCodec, outputPath)
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
		fileName = strings.TrimSuffix(filepath.Base(header.Filename), filepath.Ext(header.Filename)) + "-processed" + outputExt
	}
	if outputFormat == "webm" {
		fileName = strings.TrimSuffix(fileName, filepath.Ext(fileName)) + ".webm"
	}
	if outputFormat == "mov" {
		fileName = strings.TrimSuffix(fileName, filepath.Ext(fileName)) + ".mov"
	}

	contentType := "video/mp4"
	switch outputFormat {
	case "webm":
		contentType = "video/webm"
	case "mov":
		contentType = "video/quicktime"
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", "attachment; filename=\""+fileName+"\"")
	w.Header().Set("Content-Length", strconv.Itoa(len(resultBytes)))
	_, _ = w.Write(resultBytes)
}

func PdfProcessHandler(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	if err := r.ParseMultipartForm(50 << 20); err != nil {
		http.Error(w, "Unable to parse upload", http.StatusBadRequest)
		return
	}

	action := r.FormValue("action")
	if action == "" {
		http.Error(w, "PDF action is required", http.StatusBadRequest)
		return
	}

	files := r.MultipartForm.File["pdfs"]
	if len(files) == 0 {
		files = r.MultipartForm.File["pdf"]
	}

	tempDir, err := os.MkdirTemp("", "imigi-pdf-")
	if err != nil {
		http.Error(w, "Unable to create working directory", http.StatusInternalServerError)
		return
	}
	defer os.RemoveAll(tempDir)

	inputPaths := make([]string, 0, len(files))
	for _, fh := range files {
		f, err := fh.Open()
		if err != nil {
			http.Error(w, "Unable to read uploaded PDF", http.StatusBadRequest)
			return
		}
		defer f.Close()

		inputPath := filepath.Join(tempDir, fh.Filename)
		out, err := os.Create(inputPath)
		if err != nil {
			http.Error(w, "Unable to save uploaded PDF", http.StatusInternalServerError)
			return
		}
		if _, err = io.Copy(out, f); err != nil {
			out.Close()
			http.Error(w, "Unable to read uploaded PDF", http.StatusInternalServerError)
			return
		}
		out.Close()
		inputPaths = append(inputPaths, inputPath)
	}

	if action == "merge" && len(inputPaths) < 2 {
		http.Error(w, "At least two PDF files are required for merging.", http.StatusBadRequest)
		return
	}
	if action != "merge" && len(inputPaths) == 0 {
		http.Error(w, "A PDF file is required for this action.", http.StatusBadRequest)
		return
	}

	outputFile := filepath.Join(tempDir, "processed.pdf")
	pdfcpuPath, _ := exec.LookPath("pdfcpu")
	gsPath, _ := exec.LookPath("gs")

	switch action {
	case "merge":
		if pdfcpuPath != "" {
			cmd := exec.Command(pdfcpuPath, "merge", "-o", outputFile, inputPaths[0], inputPaths[1])
			for _, p := range inputPaths[2:] {
				cmd.Args = append(cmd.Args, p)
			}
			if output, err := cmd.CombinedOutput(); err != nil {
				log.Printf("pdfcpu merge error: %v\n%s", err, output)
				http.Error(w, fmt.Sprintf("The PDF merge backend failed: %s", strings.TrimSpace(string(output))), http.StatusInternalServerError)
				return
			}
		} else if gsPath != "" {
			args := []string{"-dNOPAUSE", "-dBATCH", "-q", "-sDEVICE=pdfwrite", "-sOUTPUTFILE=" + outputFile}
			args = append(args, inputPaths...)
			cmd := exec.Command(gsPath, args...)
			if output, err := cmd.CombinedOutput(); err != nil {
				log.Printf("gs merge error: %v\n%s", err, output)
				http.Error(w, fmt.Sprintf("The PDF merge backend failed: %s", strings.TrimSpace(string(output))), http.StatusInternalServerError)
				return
			}
		} else {
			http.Error(w, "No PDF backend is available on this server. Use the browser PDF tools instead.", http.StatusServiceUnavailable)
			return
		}
	case "split":
		rangeText := r.FormValue("range")
		if rangeText == "" {
			rangeText = "1-2"
		}
		if pdfcpuPath != "" {
			outDir := filepath.Join(tempDir, "split")
			_ = os.MkdirAll(outDir, 0o755)
			cmd := exec.Command(pdfcpuPath, "split", "-r", rangeText, inputPaths[0], outDir)
			if output, err := cmd.CombinedOutput(); err != nil {
				log.Printf("pdfcpu split error: %v\n%s", err, output)
				http.Error(w, fmt.Sprintf("The PDF split backend failed: %s", strings.TrimSpace(string(output))), http.StatusInternalServerError)
				return
			}
			outputFile = filepath.Join(outDir, "split-1.pdf")
		} else if gsPath != "" {
			outDir := filepath.Join(tempDir, "split")
			_ = os.MkdirAll(outDir, 0o755)
			cmd := exec.Command(gsPath, "-dNOPAUSE", "-dBATCH", "-q", "-sDEVICE=pdfwrite", "-sOutputFile="+filepath.Join(outDir, "page-%d.pdf"), "-dFirstPage=1", "-dLastPage=1", inputPaths[0])
			if output, err := cmd.CombinedOutput(); err != nil {
				log.Printf("gs split error: %v\n%s", err, output)
				http.Error(w, fmt.Sprintf("The PDF split backend failed: %s", strings.TrimSpace(string(output))), http.StatusInternalServerError)
				return
			}
			outputFile = filepath.Join(outDir, "page-1.pdf")
		} else {
			http.Error(w, "No PDF backend is available on this server. Use the browser PDF tools instead.", http.StatusServiceUnavailable)
			return
		}
	case "compress":
		if pdfcpuPath != "" {
			cmd := exec.Command(pdfcpuPath, "optimize", "-o", outputFile, inputPaths[0])
			if output, err := cmd.CombinedOutput(); err != nil {
				log.Printf("pdfcpu optimize error: %v\n%s", err, output)
				http.Error(w, fmt.Sprintf("The PDF compression backend failed: %s", strings.TrimSpace(string(output))), http.StatusInternalServerError)
				return
			}
		} else if gsPath != "" {
			cmd := exec.Command(gsPath, "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.4", "-dPDFSETTINGS=/ebook", "-dNOPAUSE", "-dBATCH", "-q", "-sOutputFile="+outputFile, inputPaths[0])
			if output, err := cmd.CombinedOutput(); err != nil {
				log.Printf("gs compress error: %v\n%s", err, output)
				http.Error(w, fmt.Sprintf("The PDF compression backend failed: %s", strings.TrimSpace(string(output))), http.StatusInternalServerError)
				return
			}
		} else {
			http.Error(w, "No PDF backend is available on this server. Use the browser PDF tools instead.", http.StatusServiceUnavailable)
			return
		}
	case "rotate":
		targetAngle := r.FormValue("angle")
		if targetAngle == "" {
			targetAngle = "90"
		}
		if pdfcpuPath != "" {
			cmd := exec.Command(pdfcpuPath, "rotate", "--angle", targetAngle, "--pages", "1-9999", inputPaths[0], outputFile)
			if output, err := cmd.CombinedOutput(); err != nil {
				log.Printf("pdfcpu rotate error: %v\n%s", err, output)
				http.Error(w, fmt.Sprintf("The PDF rotate backend failed: %s", strings.TrimSpace(string(output))), http.StatusInternalServerError)
				return
			}
		} else if gsPath != "" {
			cmd := exec.Command(gsPath, "-dNOPAUSE", "-dBATCH", "-q", "-sDEVICE=pdfwrite", "-sOUTPUTFILE="+outputFile, "-c", "<</Rotate "+targetAngle+">> setpagedevice", "-f", inputPaths[0])
			if output, err := cmd.CombinedOutput(); err != nil {
				log.Printf("gs rotate error: %v\n%s", err, output)
				http.Error(w, fmt.Sprintf("The PDF rotate backend failed: %s", strings.TrimSpace(string(output))), http.StatusInternalServerError)
				return
			}
		} else {
			http.Error(w, "No PDF backend is available on this server. Use the browser PDF tools instead.", http.StatusServiceUnavailable)
			return
		}
	case "delete-pages":
		rangeText := r.FormValue("range")
		if rangeText == "" {
			rangeText = "2"
		}
		if pdfcpuPath != "" {
			cmd := exec.Command(pdfcpuPath, "remove", "-r", rangeText, inputPaths[0], outputFile)
			if output, err := cmd.CombinedOutput(); err != nil {
				log.Printf("pdfcpu remove error: %v\n%s", err, output)
				http.Error(w, fmt.Sprintf("The PDF page removal backend failed: %s", strings.TrimSpace(string(output))), http.StatusInternalServerError)
				return
			}
		} else if gsPath != "" {
			http.Error(w, "The Ghostscript backend does not currently support deleting arbitrary PDF pages on this server.", http.StatusNotImplemented)
			return
		} else {
			http.Error(w, "No PDF backend is available on this server. Use the browser PDF tools instead.", http.StatusServiceUnavailable)
			return
		}
	case "extract-pages":
		rangeText := r.FormValue("range")
		if rangeText == "" {
			rangeText = "1-2"
		}
		if pdfcpuPath != "" {
			cmd := exec.Command(pdfcpuPath, "extract", "-r", rangeText, inputPaths[0], outputFile)
			if output, err := cmd.CombinedOutput(); err != nil {
				log.Printf("pdfcpu extract error: %v\n%s", err, output)
				http.Error(w, fmt.Sprintf("The PDF extraction backend failed: %s", strings.TrimSpace(string(output))), http.StatusInternalServerError)
				return
			}
		} else if gsPath != "" {
			cmd := exec.Command(gsPath, "-dNOPAUSE", "-dBATCH", "-q", "-sDEVICE=pdfwrite", "-sOUTPUTFILE="+outputFile, "-dFirstPage=1", "-dLastPage=2", inputPaths[0])
			if output, err := cmd.CombinedOutput(); err != nil {
				log.Printf("gs extract error: %v\n%s", err, output)
				http.Error(w, fmt.Sprintf("The PDF extraction backend failed: %s", strings.TrimSpace(string(output))), http.StatusInternalServerError)
				return
			}
		} else {
			http.Error(w, "No PDF backend is available on this server. Use the browser PDF tools instead.", http.StatusServiceUnavailable)
			return
		}
	default:
		http.Error(w, "Unsupported PDF action", http.StatusBadRequest)
		return
	}

	resultBytes, err := os.ReadFile(outputFile)
	if err != nil {
		http.Error(w, "Unable to read processed PDF", http.StatusInternalServerError)
		return
	}

	fileName := "processed.pdf"
	if len(files) > 0 && strings.TrimSpace(files[0].Filename) != "" {
		base := strings.TrimSuffix(filepath.Base(files[0].Filename), filepath.Ext(files[0].Filename))
		fileName = base + "-processed.pdf"
	}
	if action == "split" {
		fileName = "split.pdf"
	}
	if action == "extract-pages" {
		fileName = "extracted-pages.pdf"
	}
	if action == "delete-pages" {
		fileName = "pdf-with-pages-removed.pdf"
	}

	w.Header().Set("Content-Type", "application/pdf")
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
