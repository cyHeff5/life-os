from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@db:5432/os"
    anthropic_api_key: str = ""
    app_password: str = "changeme"
    jwt_secret: str = "change-this-secret"
    jwt_expire_days: int = 30

    class Config:
        env_file = ".env"


settings = Settings()
