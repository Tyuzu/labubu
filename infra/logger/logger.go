// File: utils/logger/logger.go

package logger

import (
	"fmt"
	"io"
	stdlog "log"
	"os"

	"go.uber.org/zap"
)

var L *zap.Logger

type zapWriter struct{}

func (z zapWriter) Write(p []byte) (n int, err error) {
	if L == nil {
		// fallback
		return len(p), nil
	}
	L.Sugar().Info(string(p))
	return len(p), nil
}

// Init initializes the global zap logger and redirects the standard log package to zap.
func Init() error {
	var err error
	cfg := zap.NewProductionConfig()
	cfg.DisableStacktrace = true
	L, err = cfg.Build()
	if err != nil {
		return err
	}

	// redirect stdlib log output to zap
	stdlog.SetOutput(zapWriter{})
	return nil
}

// Sync flushes any buffered log entries
func Sync() error {
	if L == nil {
		return nil
	}
	return L.Sync()
}

// Writer exposes an io.Writer that writes to the zap logger
func Writer() io.Writer { return zapWriter{} }

// Compatibility wrappers matching the stdlib `log` package API.
// This allows existing call sites to `import log "scav/infra/logger"`
// and keep calling `log.Println`, `log.Printf`, `log.Fatalf`, etc.
func Print(v ...interface{}) {
	if L == nil {
		fmt.Print(v...)
		return
	}
	L.Sugar().Info(v...)
}
func Println(v ...interface{}) {
	if L == nil {
		fmt.Println(v...)
		return
	}
	L.Sugar().Info(v...)
}
func Printf(format string, v ...interface{}) {
	if L == nil {
		fmt.Printf(format, v...)
		return
	}
	L.Sugar().Infof(format, v...)
}

func Fatal(v ...interface{}) {
	if L == nil {
		fmt.Fprint(os.Stderr, fmt.Sprintln(v...))
		os.Exit(1)
		return
	}
	L.Sugar().Fatal(v...)
}
func Fatalf(format string, v ...interface{}) {
	if L == nil {
		fmt.Fprintf(os.Stderr, format, v...)
		os.Exit(1)
		return
	}
	L.Sugar().Fatalf(format, v...)
}

func Panic(v ...interface{}) {
	if L == nil {
		panic(fmt.Sprint(v...))
	}
	L.Sugar().Panic(v...)
}
func Panicf(format string, v ...interface{}) {
	if L == nil {
		panic(fmt.Sprintf(format, v...))
	}
	L.Sugar().Panicf(format, v...)
}

func Printlnw(msg string, keysAndValues ...interface{}) {
	if L == nil {
		fmt.Println(msg)
		return
	}
	L.Sugar().Infow(msg, keysAndValues...)
}
