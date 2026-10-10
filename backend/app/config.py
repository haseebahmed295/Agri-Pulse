"""Application configuration module for Agri-Pulse."""

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Configuration settings for Agri-Pulse decision engine."""

    OPENAI_API_BASE_URL: str = Field(
        default="http://localhost:8000/v1",
        description="Base URL for OpenAI-compatible inference endpoint",
    )
    OPENAI_API_KEY: str = Field(
        default="not-needed",
        description="API key for authentication if required",
    )
    AI_MODEL_NAME: str = Field(
        default="default-model",
        description="Target model name for OpenAI-compatible endpoint",
    )
    AI_MODEL_TIMEOUT_SECONDS: float = Field(
        default=0.50,
        description="Maximum seconds before falling back to deterministic matrix",
    )
    FALLBACK_ENABLED: bool = Field(
        default=True,
        description="Whether instant deterministic fallback is enabled",
    )

    model_config = {
        "env_prefix": "AGRI_",
        "case_sensitive": False,
        "extra": "ignore",
    }


settings = Settings()
