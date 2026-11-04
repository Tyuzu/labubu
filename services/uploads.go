package services

import (
	"fmt"
	"mime/multipart"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

const (
	MaxVideoUploadSize = 200 << 20
	MaxPDFUploadSize   = 50 << 20
)

var allowedVideoExtensions = map[string]bool{
	".mp4":  true,
	".mov":  true,
	".webm": true,
	".m4v":  true,
	".avi":  true,
	".mkv":  true,
}

var allowedVideoMIMEs = map[string]bool{
	"video/mp4":        true,
	"video/quicktime":  true,
	"video/webm":       true,
	"video/x-msvideo":  true,
	"video/x-matroska": true,
	"video/mpeg":       true,
}

var allowedPDFExtensions = map[string]bool{
	".pdf": true,
}

var allowedPDFMIMEs = map[string]bool{
	"application/pdf":          true,
	"application/octet-stream": true,
}

type BackendStatus struct {
	FFmpeg       bool
	PDFCPU       bool
	Ghostscript  bool
	BrowserVideo bool
	BrowserPDF   bool
}

func CheckBackendHealth() BackendStatus {
	status := BackendStatus{BrowserVideo: true, BrowserPDF: true}
	if _, err := exec.LookPath("ffmpeg"); err == nil {
		status.FFmpeg = true
	}
	if _, err := exec.LookPath("pdfcpu"); err == nil {
		status.PDFCPU = true
	}
	if _, err := exec.LookPath("gs"); err == nil {
		status.Ghostscript = true
	}
	return status
}

func (s BackendStatus) ServerAvailable() bool {
	return s.FFmpeg || s.PDFCPU || s.Ghostscript
}

func (s BackendStatus) ServerUnavailable() bool {
	return !s.ServerAvailable()
}

func (s BackendStatus) Message() string {
	if s.ServerAvailable() {
		return "Server-side processing is available."
	}
	return "Server-side processing is temporarily unavailable; browser-based tools remain available."
}

func ValidateVideoUpload(form *multipart.Form) error {
	if form == nil {
		return fmt.Errorf("video upload is required")
	}
	files := form.File["video"]
	if len(files) == 0 {
		return fmt.Errorf("video file is required")
	}
	for _, file := range files {
		if err := validateUploadHeader(file, allowedVideoExtensions, allowedVideoMIMEs, MaxVideoUploadSize, "video"); err != nil {
			return err
		}
	}
	return nil
}

func ValidatePDFUpload(form *multipart.Form, action string) error {
	if form == nil {
		return fmt.Errorf("pdf upload is required")
	}
	if strings.TrimSpace(action) == "" {
		return fmt.Errorf("pdf action is required")
	}
	files := form.File["pdfs"]
	if len(files) == 0 {
		files = form.File["pdf"]
	}
	if action == "merge" && len(files) < 2 {
		return fmt.Errorf("at least two PDF files are required for merging")
	}
	if action != "merge" && len(files) == 0 {
		return fmt.Errorf("a PDF file is required for this action")
	}
	for _, file := range files {
		if err := validateUploadHeader(file, allowedPDFExtensions, allowedPDFMIMEs, MaxPDFUploadSize, "PDF"); err != nil {
			return err
		}
	}
	return nil
}

func validateUploadHeader(file *multipart.FileHeader, allowedExt map[string]bool, allowedMIME map[string]bool, maxSize int64, kind string) error {
	if file == nil {
		return fmt.Errorf("%s file is required", kind)
	}
	if file.Size <= 0 {
		return fmt.Errorf("%s file is empty", kind)
	}
	if file.Size > maxSize {
		return fmt.Errorf("%s file is too large. Maximum upload size is %s.", kind, formatBytes(maxSize))
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext == "" || !allowedExt[ext] {
		return fmt.Errorf("unsupported %s file type %q. Allowed types: %s", strings.ToLower(kind), file.Filename, formatExtensions(allowedExt))
	}

	mimeType := strings.ToLower(strings.TrimSpace(strings.Split(file.Header.Get("Content-Type"), ";")[0]))
	if mimeType != "" && !allowedMIME[mimeType] {
		return fmt.Errorf("file content type %q does not match the expected %s format", mimeType, strings.ToLower(kind))
	}
	return nil
}

func formatExtensions(allowed map[string]bool) string {
	keys := make([]string, 0, len(allowed))
	for ext := range allowed {
		keys = append(keys, ext)
	}
	sort.Strings(keys)
	return strings.Join(keys, ", ")
}

func formatBytes(size int64) string {
	const unit = 1024
	if size < unit {
		return strconv.FormatInt(size, 10) + " B"
	}
	div, exp := int64(unit), 0
	for n := size / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(size)/float64(div), "KMGTPE"[exp])
}
