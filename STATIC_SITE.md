# Static Site Build

Build the complete static website into `dist/`:

```powershell
go run . -build dist
```

The export:

- Renders every route in `routes.json` to `dist/<route>/index.html`
- Copies `static/` into `dist/static/`
- Generates `dist/sitemap.xml`
- Adds `.nojekyll` for GitHub Pages

## Hosting

Deploy the contents of `dist/` to any static host, for example GitHub Pages, Cloudflare Pages, Netlify, or an object-storage website endpoint.

The static build does not require Redis, Go, or the API server. Image, PDF, scanner, and camera operations use browser JavaScript and WebAssembly/CDN libraries where available. Server-side video/PDF fallback endpoints are intentionally unavailable in the static export.

## Preview

From the project root:

```powershell
npx serve dist
```

## Server development

Run the dynamic server normally:

```powershell
go run .
```
