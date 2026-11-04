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

type StatusError struct {
	Code    int
	Message string
}

func (e *StatusError) Error() string {
	return e.Message
}

func newStatusError(code int, msg string) error {
	return &StatusError{Code: code, Message: msg}
}

func ProcessVideoUpload(r *http.Request) ([]byte, string, string, error) {
	if err := r.ParseMultipartForm(MaxVideoUploadSize + (10 << 20)); err != nil {
		return nil, "", "", newStatusError(http.StatusBadRequest, "Unable to parse upload")
	}
	if err := ValidateVideoUpload(r.MultipartForm); err != nil {
		return nil, "", "", newStatusError(http.StatusBadRequest, err.Error())
	}

	action := r.FormValue("action")
	outputFormat := strings.ToLower(r.FormValue("format"))
	if outputFormat == "" {
		outputFormat = "mp4"
	}
	file, header, err := r.FormFile("video")
	if err != nil {
		return nil, "", "", newStatusError(http.StatusBadRequest, "Video file is required")
	}
	defer file.Close()

	ffmpegPath, err := exec.LookPath("ffmpeg")
	if err != nil {
		return nil, "", "", newStatusError(http.StatusServiceUnavailable, "Self-hosted FFmpeg is not available on this server right now. Use the browser-based option or try again later.")
	}

	tempDir, err := os.MkdirTemp("", "imigi-video-")
	if err != nil {
		return nil, "", "", newStatusError(http.StatusInternalServerError, "Unable to create working directory")
	}
	defer os.RemoveAll(tempDir)

	inputExt := filepath.Ext(header.Filename)
	if inputExt == "" {
		inputExt = ".mp4"
	}
	inputPath := filepath.Join(tempDir, "input"+inputExt)
	outputExt := ".mp4"
	if outputFormat == "webm" {
		outputExt = ".webm"
	} else if outputFormat == "mov" {
		outputExt = ".mov"
	}
	outputPath := filepath.Join(tempDir, "output"+outputExt)

	outFile, err := os.Create(inputPath)
	if err != nil {
		return nil, "", "", newStatusError(http.StatusInternalServerError, "Unable to save uploaded video")
	}
	if _, err = io.Copy(outFile, file); err != nil {
		_ = outFile.Close()
		return nil, "", "", newStatusError(http.StatusInternalServerError, "Unable to read uploaded video")
	}
	_ = outFile.Close()

	args := []string{"-y", "-i", inputPath}
	codecName := "libx264"
	audioCodec := "aac"
	if outputFormat == "webm" {
		codecName = "libvpx-vp9"
		audioCodec = "libopus"
	}
	switch action {
	case "crop":
		widthValue, heightValue := r.FormValue("width"), r.FormValue("height")
		xValue, yValue := r.FormValue("x"), r.FormValue("y")
		if widthValue == "" || heightValue == "" {
			return nil, "", "", newStatusError(http.StatusBadRequest, "Crop width and height are required")
		}
		args = append(args, "-vf", fmt.Sprintf("crop=%s:%s:%s:%s", widthValue, heightValue, xValue, yValue), "-c:v", codecName, "-preset", "veryfast", "-c:a", audioCodec, outputPath)
	case "trim":
		start := r.FormValue("start")
		end := r.FormValue("end")
		if start == "" || end == "" {
			return nil, "", "", newStatusError(http.StatusBadRequest, "Trim start and end values are required")
		}
		args = append(args, "-ss", start, "-to", end, "-c:v", codecName, "-preset", "veryfast", "-c:a", audioCodec, outputPath)
	case "filter":
		filter := r.FormValue("filter")
		if filter == "" {
			filter = "cinematic"
		}
		filterMap := map[string]string{
			"cinematic": "eq=contrast=1.15:saturation=1.35:brightness=0.04",
			"warm":      "eq=contrast=1.1:saturation=1.4:brightness=0.08",
			"cool":      "eq=contrast=1.2:saturation=0.95:brightness=-0.03",
			"vintage":   "eq=contrast=1.35:saturation=0.8:brightness=0.06",
			"contrast":  "eq=contrast=1.6:saturation=1.2:brightness=0.02",
			"grayscale": "eq=contrast=1.12:saturation=0.1:brightness=0.02",
			"sepia":     "eq=contrast=1.18:saturation=0.8:brightness=0.05,colorchannelmixer=rr=1.2:gg=0.8:bb=0.6",
			"noir":      "curves=r='0.2':0.4:1.0/0.0:1.0,curves=g='0.2':0.4:1.0/0.0:1.0,curves=b='0.2':0.4:1.0/0.0:1.0",
			"sharp":     "unsharp=5:5:1.2:5:5:0.8",
			"sunset":    "eq=contrast=1.25:saturation=1.5:brightness=0.09",
			"dreamy":    "eq=contrast=1.08:saturation=1.1:brightness=0.08",
		}
		args = append(args, "-vf", filterMap[filter], "-c:v", codecName, "-preset", "veryfast", "-c:a", audioCodec, outputPath)
	default:
		return nil, "", "", newStatusError(http.StatusBadRequest, "Unsupported video action")
	}

	cmd := exec.Command(ffmpegPath, args...)
	cmd.Dir = tempDir
	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("FFmpeg error: %v\n%s", err, string(output))
		return nil, "", "", newStatusError(http.StatusInternalServerError, fmt.Sprintf("The self-hosted FFmpeg job failed: %s", strings.TrimSpace(string(output))))
	}

	resultBytes, err := os.ReadFile(outputPath)
	if err != nil {
		return nil, "", "", newStatusError(http.StatusInternalServerError, "Unable to read processed video")
	}

	fileName := "processed-video.mp4"
	if strings.TrimSpace(header.Filename) != "" {
		fileName = strings.TrimSuffix(filepath.Base(header.Filename), filepath.Ext(header.Filename)) + "-processed" + outputExt
	}
	if outputFormat == "webm" {
		fileName = strings.TrimSuffix(fileName, filepath.Ext(fileName)) + ".webm"
	}
	if outputFormat == "mov" {
		fileName = strings.TrimSuffix(fileName, filepath.Ext(fileName)) + ".mov"
	}

	contentType := "video/mp4"
	switch outputFormat {
	case "webm":
		contentType = "video/webm"
	case "mov":
		contentType = "video/quicktime"
	}
	return resultBytes, fileName, contentType, nil
}

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
