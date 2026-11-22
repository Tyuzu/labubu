package main

type PageShellData struct {
	ID              string // e.g., "image-compressor"
	Eyebrow         string // e.g., "Lossless Compression"
	Title           string // e.g., "Image Compressor"
	Description     string // e.g., "Reduce PNG, JPEG, and WebP file size instantly in your browser without uploading files to a server."
	PrimaryAction   ButtonData
	SecondaryAction ButtonData
}
