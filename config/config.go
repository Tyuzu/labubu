package config

type Config struct {
	SERVER_HTTP_PORT string
}

func New() *Config {
	return &Config{
		SERVER_HTTP_PORT: "0.0.0.0:4000",
	}
}
