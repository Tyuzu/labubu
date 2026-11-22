package main

type FileUploadData struct {
	Id          string
	Name        string
	Label       string
	AriaLabel   string
	Accept      string // e.g., "image/png,image/jpeg,image/webp"
	Capture     string // e.g., "environment" for mobile cameras
	Multiple    bool
	Required    bool
	Class       string
	Icon        string
	Title       string
	Hint        string
	Placeholder string
}
