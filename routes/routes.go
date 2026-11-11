package routes

import (
	"html/template"
	"net/http"

	"imigi/infra"

	"github.com/julienschmidt/httprouter"
)

type PageHandlerFunc func(t *template.Template, app *infra.Deps, templateName string, meta Metadata) http.HandlerFunc

type StaticHandlerFunc func() http.Handler

type PanicHandlerFunc func(app *infra.Deps, t *template.Template) func(http.ResponseWriter, *http.Request, interface{})

type NotFoundHandlerFunc func(app *infra.Deps, t *template.Template) http.HandlerFunc

type SitemapHandlerFunc func(routeMap RouteMap, baseURL string) http.HandlerFunc

type HealthHandlerFunc func() http.HandlerFunc

func Register(
	router *httprouter.Router,
	tmpl *template.Template,
	app *infra.Deps,
	routeMap RouteMap,
	pageHandler PageHandlerFunc,
	staticHandler StaticHandlerFunc,
	panicHandler PanicHandlerFunc,
	notFoundHandler NotFoundHandlerFunc,
	sitemapHandler SitemapHandlerFunc,
	healthHandler HealthHandlerFunc,
	videoProcessHandler httprouter.Handle,
	pdfProcessHandler httprouter.Handle,
) {
	if router == nil {
		return
	}

	router.Handler(http.MethodGet, "/static/*filepath", staticHandler())
	router.PanicHandler = panicHandler(app, tmpl)
	router.NotFound = notFoundHandler(app, tmpl)

	baseURL := DefaultBaseURL()
	router.HandlerFunc(http.MethodGet, "/sitemap.xml", sitemapHandler(routeMap, baseURL))
	router.HandlerFunc(http.MethodGet, "/api/health", healthHandler())
	router.POST("/api/video/process", videoProcessHandler)
	router.POST("/api/pdf/process", pdfProcessHandler)

	for _, route := range routeMap {
		router.Handler(http.MethodGet, route.Path, pageHandler(tmpl, app, route.Template, route.Metadata))
	}
}
