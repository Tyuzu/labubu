package main

type SliderData struct {
	Id       string
	Name     string
	Label    string
	Unit     string // e.g., "%", "px", "fps"
	Min      string // e.g., "1"
	Max      string // e.g., "100"
	Value    string // e.g., "85"
	Step     string // e.g., "1"
	MinLabel string
	MaxLabel string
	Class    string
}
