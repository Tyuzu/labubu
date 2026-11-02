package config

type Config struct {
	SERVER_HTTP_PORT string
}

func New() *Config {
	return &Config{
		SERVER_HTTP_PORT: "localhost:4000",
	}
}
