from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"
_BACKEND_ENV = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    database_url: str
    api_host: str = "0.0.0.0"
    api_port: int = 3001
    jwt_secret: str
    openai_api_key: str = ""
    openai_model: str = "gpt-6-luna"
    cookie_secure: bool = False
    frontend_origin: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=(_ROOT_ENV, _BACKEND_ENV, ".env", "../.env"),
        extra="ignore",
    )


settings = Settings()
