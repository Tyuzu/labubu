package services

import (
	"fmt"
	"mime/multipart"
	"strings"
)

func ValidateVideoUpload(form *multipart.Form) error {
	if form == nil {
		return fmt.Errorf("video upload is required")
	}
	if len(form.File["video"]) == 0 {
		return fmt.Errorf("video file is required")
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
	return nil
}
