import os
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
    USE_TYPESAFE_API: bool = Field(
        default=True,
        description="Enable TypeSafe AI System One cloud API instead of local model",
    )
    TYPESAFE_API_KEY: str = Field(
        default_factory=lambda: os.getenv(
            "TYPESAFE_API_KEY",
            os.getenv(
                "AGRI_TYPESAFE_API_KEY",
                "apikey_2106a0ccd40af72247358768f76a4d7970b7_f2f05d7de5fee16242dfc0ed997c2072e33424d293e2fb3142a45d173dbe4b5d",
            ),
        ),
        description="API key for TypeSafe System One (overridable via TYPESAFE_API_KEY or AGRI_TYPESAFE_API_KEY)",
    )
    TYPESAFE_MODEL: str = Field(
        default="jev-latest",
        description="Target TypeSafe model identifier",
    )
    TYPESAFE_BASE_URL: str = Field(
        default="https://api.typesafe.ai",
        description="Base URL for TypeSafe API endpoint",
    )
    TYPESAFE_TIMEOUT_SECONDS: float = Field(
        default=4.0,
        description="Maximum seconds before falling back to deterministic matrix",
    )

    model_config = {
        "env_prefix": "AGRI_",
        "case_sensitive": False,
        "extra": "ignore",
    }


settings = Settings()
