package main

type DropdownOption struct {
	Value    string
	Label    string
	Selected bool
	Disabled bool
}

type DropdownData struct {
	Id           string
	Name         string
	Label        string
	AriaLabel    string
	Required     bool
	Disabled     bool
	Class        string
	WrapperClass string
	Options      []DropdownOption
}
