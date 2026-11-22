package services

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

const FFmpegFiltersDirectory = "ffmpegFilters"

// FFmpegFilters maps a filter file's relative path to its complete contents.
// It includes every regular file in ffmpegFilters, regardless of extension.
var FFmpegFilters = mustLoadFFmpegFilters(FFmpegFiltersDirectory)

func mustLoadFFmpegFilters(directory string) map[string]string {
	filters, err := LoadFFmpegFilters(directory)
	if err != nil {
		return map[string]string{}
	}
	return filters
}

func LoadFFmpegFilters(directory string) (map[string]string, error) {
	filters := make(map[string]string)

	err := filepath.WalkDir(directory, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() {
			return nil
		}

		content, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("read FFmpeg filter %q: %w", path, err)
		}

		relativePath, err := filepath.Rel(directory, path)
		if err != nil {
			return fmt.Errorf("resolve FFmpeg filter path %q: %w", path, err)
		}
		relativePath = filepath.ToSlash(relativePath)
		filters[relativePath] = strings.ReplaceAll(string(content), "\r\n", "\n")
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("load FFmpeg filters: %w", err)
	}

	return filters, nil
}

func FFmpegFilterNames(filters map[string]string) []string {
	names := make([]string, 0, len(filters))
	for name := range filters {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}
