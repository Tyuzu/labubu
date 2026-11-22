package main

type ToolLink struct {
	Label string
	Href  string
	Icon  string
}

type ToolCategory struct {
	ID    string // e.g., "overview", "images", "videos", "scanner", "pdfs", "utility"
	Name  string // Rail label: "Home", "Images", etc.
	Title string // Sidebar header: "Image Tools", etc.
	Icon  string
	Tools []ToolLink
}

type PageData struct {
	CurrentYear    int
	CurrentPath    string // e.g., "/image-compressor"
	ActiveCategory string // e.g., "images" (derived from CurrentPath)
	SearchQuery    string
	Categories     []ToolCategory
}
