package services

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

func ProcessPDFUpload(r *http.Request) ([]byte, string, string, error) {
	if err := r.ParseMultipartForm(MaxPDFUploadSize + (10 << 20)); err != nil {
		return nil, "", "", newStatusError(http.StatusBadRequest, "Unable to parse upload")
	}

	action := r.FormValue("action")
	if err := ValidatePDFUpload(r.MultipartForm, action); err != nil {
		return nil, "", "", newStatusError(http.StatusBadRequest, err.Error())
	}

	files := r.MultipartForm.File["pdfs"]
	if len(files) == 0 {
		files = r.MultipartForm.File["pdf"]
	}

	tempDir, err := os.MkdirTemp("", "imigi-pdf-")
	if err != nil {
		return nil, "", "", newStatusError(http.StatusInternalServerError, "Unable to create working directory")
	}
	defer os.RemoveAll(tempDir)

	inputPaths := make([]string, 0, len(files))
	for _, fh := range files {
		f, err := fh.Open()
		if err != nil {
			return nil, "", "", newStatusError(http.StatusBadRequest, "Unable to read uploaded PDF")
		}
		defer f.Close()

		inputPath := filepath.Join(tempDir, fh.Filename)
		out, err := os.Create(inputPath)
		if err != nil {
			return nil, "", "", newStatusError(http.StatusInternalServerError, "Unable to save uploaded PDF")
		}
		if _, err = io.Copy(out, f); err != nil {
			_ = out.Close()
			return nil, "", "", newStatusError(http.StatusInternalServerError, "Unable to read uploaded PDF")
		}
		_ = out.Close()
		inputPaths = append(inputPaths, inputPath)
	}

	outputFile := filepath.Join(tempDir, "processed.pdf")
	pdfcpuPath, _ := exec.LookPath("pdfcpu")
	gsPath, _ := exec.LookPath("gs")

	switch action {
	case "merge":
		if pdfcpuPath != "" {
			cmd := exec.Command(pdfcpuPath, append([]string{"merge", "-o", outputFile, inputPaths[0], inputPaths[1]}, inputPaths[2:]...)...)
			if output, err := cmd.CombinedOutput(); err != nil {
				log.Printf("pdfcpu merge error: %v\n%s", err, output)
				return nil, "", "", newStatusError(http.StatusInternalServerError, fmt.Sprintf("The PDF merge backend failed: %s", strings.TrimSpace(string(output))))
			}
		} else if gsPath != "" {
			args := []string{"-dNOPAUSE", "-dBATCH", "-q", "-sDEVICE=pdfwrite", "-sOUTPUTFILE=" + outputFile}
			args = append(args, inputPaths...)
			cmd := exec.Command(gsPath, args...)
			if output, err := cmd.CombinedOutput(); err != nil {
				log.Printf("gs merge error: %v\n%s", err, output)
				return nil, "", "", newStatusError(http.StatusInternalServerError, fmt.Sprintf("The PDF merge backend failed: %s", strings.TrimSpace(string(output))))
			}
		} else {
			return nil, "", "", newStatusError(http.StatusServiceUnavailable, "No PDF backend is available on this server right now. Use the browser PDF tools or try again later.")
		}
	case "split":
		rangeText := r.FormValue("range")
		if rangeText == "" {
			rangeText = "1-2"
		}
		if pdfcpuPath != "" {
			outDir := filepath.Join(tempDir, "split")
			_ = os.MkdirAll(outDir, 0o755)
			cmd := exec.Command(pdfcpuPath, "split", "-r", rangeText, inputPaths[0], outDir)
			if output, err := cmd.CombinedOutput(); err != nil {
				log.Printf("pdfcpu split error: %v\n%s", err, output)
				return nil, "", "", newStatusError(http.StatusInternalServerError, fmt.Sprintf("The PDF split backend failed: %s", strings.TrimSpace(string(output))))
			}
			outputFile = filepath.Join(outDir, "split-1.pdf")
		} else if gsPath != "" {
			outDir := filepath.Join(tempDir, "split")
			_ = os.MkdirAll(outDir, 0o755)
			cmd := exec.Command(gsPath, "-dNOPAUSE", "-dBATCH", "-q", "-sDEVICE=pdfwrite", "-sOutputFile="+filepath.Join(outDir, "page-%d.pdf"), "-dFirstPage=1", "-dLastPage=1", inputPaths[0])
			if output, err := cmd.CombinedOutput(); err != nil {
				log.Printf("gs split error: %v\n%s", err, output)
				return nil, "", "", newStatusError(http.StatusInternalServerError, fmt.Sprintf("The PDF split backend failed: %s", strings.TrimSpace(string(output))))
			}
			outputFile = filepath.Join(outDir, "page-1.pdf")
		} else {
			return nil, "", "", newStatusError(http.StatusServiceUnavailable, "No PDF backend is available on this server right now. Use the browser PDF tools or try again later.")
		}
	case "compress":
		if pdfcpuPath != "" {
			cmd := exec.Command(pdfcpuPath, "optimize", "-o", outputFile, inputPaths[0])
			if output, err := cmd.CombinedOutput(); err != nil {
				log.Printf("pdfcpu optimize error: %v\n%s", err, output)
				return nil, "", "", newStatusError(http.StatusInternalServerError, fmt.Sprintf("The PDF compression backend failed: %s", strings.TrimSpace(string(output))))
			}
		} else if gsPath != "" {
			cmd := exec.Command(gsPath, "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.4", "-dPDFSETTINGS=/ebook", "-dNOPAUSE", "-dBATCH", "-q", "-sOutputFile="+outputFile, inputPaths[0])
			if output, err := cmd.CombinedOutput(); err != nil {
				log.Printf("gs compress error: %v\n%s", err, output)
				return nil, "", "", newStatusError(http.StatusInternalServerError, fmt.Sprintf("The PDF compression backend failed: %s", strings.TrimSpace(string(output))))
			}
		} else {
			return nil, "", "", newStatusError(http.StatusServiceUnavailable, "No PDF backend is available on this server right now. Use the browser PDF tools or try again later.")
		}
	case "rotate":
		targetAngle := r.FormValue("angle")
		if targetAngle == "" {
			targetAngle = "90"
		}
		if pdfcpuPath != "" {
			cmd := exec.Command(pdfcpuPath, "rotate", "--angle", targetAngle, "--pages", "1-9999", inputPaths[0], outputFile)
			if output, err := cmd.CombinedOutput(); err != nil {
				log.Printf("pdfcpu rotate error: %v\n%s", err, output)
				return nil, "", "", newStatusError(http.StatusInternalServerError, fmt.Sprintf("The PDF rotate backend failed: %s", strings.TrimSpace(string(output))))
			}
		} else if gsPath != "" {
			cmd := exec.Command(gsPath, "-dNOPAUSE", "-dBATCH", "-q", "-sDEVICE=pdfwrite", "-sOUTPUTFILE="+outputFile, "-c", "<</Rotate "+targetAngle+">> setpagedevice", "-f", inputPaths[0])
			if output, err := cmd.CombinedOutput(); err != nil {
				log.Printf("gs rotate error: %v\n%s", err, output)
				return nil, "", "", newStatusError(http.StatusInternalServerError, fmt.Sprintf("The PDF rotate backend failed: %s", strings.TrimSpace(string(output))))
			}
		} else {
			return nil, "", "", newStatusError(http.StatusServiceUnavailable, "No PDF backend is available on this server right now. Use the browser PDF tools or try again later.")
		}
	case "delete-pages":
		rangeText := r.FormValue("range")
		if rangeText == "" {
			rangeText = "2"
		}
		if pdfcpuPath != "" {
			cmd := exec.Command(pdfcpuPath, "remove", "-r", rangeText, inputPaths[0], outputFile)
			if output, err := cmd.CombinedOutput(); err != nil {
				log.Printf("pdfcpu remove error: %v\n%s", err, output)
				return nil, "", "", newStatusError(http.StatusInternalServerError, fmt.Sprintf("The PDF page removal backend failed: %s", strings.TrimSpace(string(output))))
			}
		} else if gsPath != "" {
			return nil, "", "", newStatusError(http.StatusNotImplemented, "The Ghostscript backend does not currently support deleting arbitrary PDF pages on this server.")
		} else {
			return nil, "", "", newStatusError(http.StatusServiceUnavailable, "No PDF backend is available on this server right now. Use the browser PDF tools or try again later.")
		}
	case "extract-pages":
		rangeText := r.FormValue("range")
		if rangeText == "" {
			rangeText = "1-2"
		}
		if pdfcpuPath != "" {
			cmd := exec.Command(pdfcpuPath, "extract", "-r", rangeText, inputPaths[0], outputFile)
			if output, err := cmd.CombinedOutput(); err != nil {
				log.Printf("pdfcpu extract error: %v\n%s", err, output)
				return nil, "", "", newStatusError(http.StatusInternalServerError, fmt.Sprintf("The PDF extraction backend failed: %s", strings.TrimSpace(string(output))))
			}
		} else if gsPath != "" {
			cmd := exec.Command(gsPath, "-dNOPAUSE", "-dBATCH", "-q", "-sDEVICE=pdfwrite", "-sOUTPUTFILE="+outputFile, "-dFirstPage=1", "-dLastPage=2", inputPaths[0])
			if output, err := cmd.CombinedOutput(); err != nil {
				log.Printf("gs extract error: %v\n%s", err, output)
				return nil, "", "", newStatusError(http.StatusInternalServerError, fmt.Sprintf("The PDF extraction backend failed: %s", strings.TrimSpace(string(output))))
			}
		} else {
			return nil, "", "", newStatusError(http.StatusServiceUnavailable, "No PDF backend is available on this server right now. Use the browser PDF tools or try again later.")
		}
	default:
		return nil, "", "", newStatusError(http.StatusBadRequest, "Unsupported PDF action")
	}

	resultBytes, err := os.ReadFile(outputFile)
	if err != nil {
		return nil, "", "", newStatusError(http.StatusInternalServerError, "Unable to read processed PDF")
	}

	fileName := "processed.pdf"
	if len(files) > 0 && strings.TrimSpace(files[0].Filename) != "" {
		base := strings.TrimSuffix(filepath.Base(files[0].Filename), filepath.Ext(files[0].Filename))
		fileName = base + "-processed.pdf"
	}
	if action == "split" {
		fileName = "split.pdf"
	}
	if action == "extract-pages" {
		fileName = "extracted-pages.pdf"
	}
	if action == "delete-pages" {
		fileName = "pdf-with-pages-removed.pdf"
	}
	return resultBytes, fileName, "application/pdf", nil
}
