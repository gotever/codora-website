from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    api_host: str = "0.0.0.0"
    api_port: int = 3001
    jwt_secret: str
    openai_api_key: str = ""
    openai_model: str = "gpt-6-luna"
    cookie_secure: bool = False
    frontend_origin: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
