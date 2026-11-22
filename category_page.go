package main

type FeatureItem struct {
	Icon        string
	Title       string
	Description string
}

type ShowcaseToolItem struct {
	Icon  string
	Label string
	Href  string
	Meta  string // e.g., "Lossless client-side WebP & AVIF encoding"
}

type ToolShowcaseSection struct {
	ID      string // e.g., "image-tools-grid"
	Eyebrow string
	Title   string
	Items   []ShowcaseToolItem
}

type CategoryPageData struct {
	PageData    // Embeds base layout data (CurrentYear, Categories, etc.)
	Eyebrow     string
	Title       string
	Description string
	Features    []FeatureItem
	ToolSection ToolShowcaseSection
}
