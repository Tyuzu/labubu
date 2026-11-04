package services

import (
	"mime/multipart"
	"testing"
)

func TestValidateVideoUploadRequiresVideoFile(t *testing.T) {
	form := &multipart.Form{File: map[string][]*multipart.FileHeader{}}
	if err := ValidateVideoUpload(form); err == nil {
		t.Fatal("ValidateVideoUpload() expected error for missing video file")
	}
}

func TestValidatePDFUploadRequiresMergeFiles(t *testing.T) {
	form := &multipart.Form{File: map[string][]*multipart.FileHeader{}}
	if err := ValidatePDFUpload(form, "merge"); err == nil {
		t.Fatal("ValidatePDFUpload() expected error for insufficient PDF files")
	}
}
