package main

type Metadata struct {
	Title       string
	Description string
	Keywords    string
	Robots      string
	Canonical   string
	OgImage     string
}

type MasterLayoutData struct {
	CurrentYear    int
	CurrentPath    string
	ActiveCategory string
	SearchQuery    string
	Categories     []ToolCategory
	Metadata       Metadata
	BackendWarning bool
}
