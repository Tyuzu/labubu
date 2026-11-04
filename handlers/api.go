package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"imigi/services"

	"github.com/julienschmidt/httprouter"
)

func VideoProcessHandler(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	result, fileName, contentType, err := services.ProcessVideoUpload(r)
	if err != nil {
		writeServiceError(w, err)
		return
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", "attachment; filename=\""+fileName+"\"")
	w.Header().Set("Content-Length", strconv.Itoa(len(result)))
	_, _ = w.Write(result)
}

func PdfProcessHandler(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	result, fileName, contentType, err := services.ProcessPDFUpload(r)
	if err != nil {
		writeServiceError(w, err)
		return
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", "attachment; filename=\""+fileName+"\"")
	w.Header().Set("Content-Length", strconv.Itoa(len(result)))
	_, _ = w.Write(result)
}

func writeServiceError(w http.ResponseWriter, err error) {
	var statusErr *services.StatusError
	if errors.As(err, &statusErr) {
		http.Error(w, statusErr.Error(), statusErr.Code)
		return
	}
	http.Error(w, err.Error(), http.StatusBadRequest)
}
