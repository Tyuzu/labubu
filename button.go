package main

type ButtonData struct {
	Id           string
	Label        string
	Variant      string // "primary", "secondary", "danger", "ghost"
	Type         string // "button", "submit", "reset"
	Class        string
	Icon         string // HTML or emoji icon string
	Disabled     bool
	Name         string
	Value        string
	AriaExpanded string
	AriaControls string
	HxPost       string
	HxGet        string
	HxTarget     string
}
