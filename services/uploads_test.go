package services

import (
	"mime/multipart"
	"net/textproto"
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

func TestValidateVideoUploadRejectsUnsupportedExtension(t *testing.T) {
	form := &multipart.Form{File: map[string][]*multipart.FileHeader{
		"video": {&multipart.FileHeader{
			Filename: "clip.txt",
			Header:   textproto.MIMEHeader{"Content-Type": []string{"video/mp4"}},
			Size:     128,
		}},
	}}

	if err := ValidateVideoUpload(form); err == nil {
		t.Fatal("ValidateVideoUpload() expected error for unsupported video extension")
	}
}

func TestValidateVideoUploadRejectsMimeMismatch(t *testing.T) {
	form := &multipart.Form{File: map[string][]*multipart.FileHeader{
		"video": {&multipart.FileHeader{
			Filename: "clip.mp4",
			Header:   textproto.MIMEHeader{"Content-Type": []string{"image/png"}},
			Size:     128,
		}},
	}}

	if err := ValidateVideoUpload(form); err == nil {
		t.Fatal("ValidateVideoUpload() expected error for MIME mismatch")
	}
}

func TestValidateVideoUploadRejectsOversizeFile(t *testing.T) {
	form := &multipart.Form{File: map[string][]*multipart.FileHeader{
		"video": {&multipart.FileHeader{
			Filename: "clip.mp4",
			Header:   textproto.MIMEHeader{"Content-Type": []string{"video/mp4"}},
			Size:     MaxVideoUploadSize + 1,
		}},
	}}

	if err := ValidateVideoUpload(form); err == nil {
		t.Fatal("ValidateVideoUpload() expected error for oversized upload")
	}
}

func TestValidatePDFUploadRejectsWrongMimeType(t *testing.T) {
	form := &multipart.Form{File: map[string][]*multipart.FileHeader{
		"pdf": {&multipart.FileHeader{
			Filename: "notes.pdf",
			Header:   textproto.MIMEHeader{"Content-Type": []string{"image/png"}},
			Size:     128,
		}},
	}}

	if err := ValidatePDFUpload(form, "compress"); err == nil {
		t.Fatal("ValidatePDFUpload() expected error for non-PDF MIME type")
	}
}
