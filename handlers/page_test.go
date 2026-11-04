package handlers

import (
	"bytes"
	"fmt"
	"html/template"
	"io/fs"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"
)

func TestPageDataIncludesCurrentYear(t *testing.T) {
	currentYear := time.Now().Year()
	tmpl := template.Must(template.New("footer").Parse(`{{define "footer"}}&copy; {{.CurrentYear}} Imigi App. All rights reserved.{{end}}`))

	var buf bytes.Buffer
	if err := tmpl.ExecuteTemplate(&buf, "footer", PageData{CurrentYear: currentYear}); err != nil {
		t.Fatalf("render footer: %v", err)
	}

	want := fmt.Sprintf("&copy; %d Imigi App. All rights reserved.", currentYear)
	if got := buf.String(); got != want {
		t.Fatalf("footer rendered unexpectedly: got %q, want %q", got, want)
	}
}

func TestReusableToolCategoryTemplateRenders(t *testing.T) {
	funcMap := template.FuncMap{
		"slice": func(items ...interface{}) []interface{} { return items },
		"feature": func(icon, title, description string) map[string]string {
			return map[string]string{"Icon": icon, "Title": title, "Description": description}
		},
		"toolTile": func(href, label, meta string) map[string]string {
			return map[string]string{"Href": href, "Label": label, "Meta": meta}
		},
		"toolSection": func(eyebrow, title string, items []interface{}) map[string]interface{} {
			return map[string]interface{}{"Eyebrow": eyebrow, "Title": title, "Items": items}
		},
		"toolPage": func(eyebrow, title, description string, features []interface{}, section map[string]interface{}) map[string]interface{} {
			return map[string]interface{}{"Eyebrow": eyebrow, "Title": title, "Description": description, "Features": features, "ToolSection": section}
		}, "pageHeaderData": func(eyebrow, title, description string) map[string]string {
			return map[string]string{"Eyebrow": eyebrow, "Title": title, "Description": description}
		}, "dict": func(values ...interface{}) map[string]interface{} {
			result := make(map[string]interface{}, len(values)/2)
			for i := 0; i < len(values); i += 2 {
				key, ok := values[i].(string)
				if !ok {
					key = fmt.Sprint(values[i])
				}
				result[key] = values[i+1]
			}
			return result
		}, "renderPage": func(data interface{}) template.HTML {
			if data == nil {
				return template.HTML("")
			}
			if page, ok := data.(map[string]interface{}); ok {
				if name, ok := page["TemplateName"].(string); ok && name != "" {
					return template.HTML("<section>" + name + "</section>")
				}
			}
			return template.HTML("<section>content</section>")
		}}

	root := filepath.Clean("../templates")
	tmpl := template.New("").Funcs(funcMap)
	var matches []string
	if err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() || !strings.EqualFold(filepath.Ext(path), ".html") {
			return nil
		}
		matches = append(matches, path)
		return nil
	}); err != nil {
		t.Fatalf("walk templates: %v", err)
	}
	sort.Strings(matches)
	for _, match := range matches {
		var parseErr error
		tmpl, parseErr = tmpl.ParseFiles(match)
		if parseErr != nil {
			t.Fatalf("parse nested template %s: %v", match, parseErr)
		}
	}

	data := funcMap["toolPage"].(func(string, string, string, []interface{}, map[string]interface{}) map[string]interface{})(
		"Image tools",
		"Fast photo editing tools for resizing, converting, and compressing images.",
		"Compress bulky uploads, resize for social posts, convert file types, and clean up photos without installing a desktop editor.",
		[]interface{}{
			funcMap["feature"].(func(string, string, string) map[string]string)("🗜️", "Compress images", "Reduce file sizes for faster uploads."),
			funcMap["feature"].(func(string, string, string) map[string]string)("📐", "Resize for any dimension", "Set the exact width and height you need."),
		},
		map[string]interface{}{
			"Eyebrow": "Popular image utilities",
			"Title":   "Choose the tool you need",
			"Items": []interface{}{
				funcMap["toolTile"].(func(string, string, string) map[string]string)("/image-compressor", "Image Compressor", "Smaller file size"),
				funcMap["toolTile"].(func(string, string, string) map[string]string)("/image-resizer", "Image Resizer", "Resize to exact dimensions"),
			},
		},
	)

	var buf bytes.Buffer
	if err := tmpl.ExecuteTemplate(&buf, "toolCategoryPage", data); err != nil {
		t.Fatalf("render reusable tool category page: %v", err)
	}

	if got := buf.String(); got == "" {
		t.Fatal("tool category component rendered empty output")
	}
}
