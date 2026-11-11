package services

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
