"""Application configuration module for Agri-Pulse."""

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Configuration settings for Agri-Pulse decision engine."""

    LOCAL_MODEL_BASE_URL: str = Field(
        default="http://127.0.0.1:8080",
        description="Base URL for local inference runner (e.g. llama-server)",
    )
    OPENAI_API_BASE_URL: str = Field(
        default="http://127.0.0.1:8080/v1",
        description="Base URL for OpenAI-compatible chat inference endpoint",
    )
    OPENAI_API_KEY: str = Field(
        default="not-needed",
        description="API key for authentication if required",
    )
    AI_MODEL_NAME: str = Field(
        default=".\\browser\\intern-decision-4b-q8_0-fixed.gguf",
        description="Target model identifier",
    )
    AI_MODEL_TIMEOUT_SECONDS: float = Field(
        default=3.0,
        description="Maximum seconds before falling back to deterministic matrix",
    )
    USE_FAST_DECISION_ENGINE: bool = Field(
        default=True,
        description="Use single-pass logit scoring (/completion) for ~40-150ms decisions",
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
