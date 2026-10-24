"""Configuration and environment management for ScholarPilot AI/ML Engine."""

import os
from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Server
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000

    # Database
    DATABASE_URL: str = "sqlite:///./scholarpilot.db"

    # Qdrant Vector DB
    # Handles standard naming and existing project aliases (QDART_ENDPOINT, QDRAT_API_KEY)
    QDRANT_ENDPOINT: Optional[str] = None
    QDART_ENDPOINT: Optional[str] = None
    QDRANT_API_KEY: Optional[str] = None
    QDRAT_API_KEY: Optional[str] = None
    QDRANT_LOCATION: Optional[str] = None  # e.g., ":memory:" for isolated offline testing
    QDRANT_COLLECTION_NAME: str = "scholarships_v1"
    QDRANT_TIMEOUT_SEC: float = 10.0

    # Embeddings (Local FastEmbed - zero API cost)
    EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"
    EMBEDDING_DIMENSION: int = 384

    # LLM Providers (Gemini & Groq Fallback)
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-1.5-flash"
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama-3.1-8b-instant"
    LLM_TIMEOUT_SEC: float = 8.0
    MAX_RAW_TEXT_LENGTH: int = 25000

    @property
    def effective_qdrant_endpoint(self) -> Optional[str]:
        return self.QDRANT_ENDPOINT or self.QDART_ENDPOINT or os.getenv("QDART_ENDPOINT") or os.getenv("QDRANT_ENDPOINT")

    @property
    def effective_qdrant_api_key(self) -> Optional[str]:
        return self.QDRANT_API_KEY or self.QDRAT_API_KEY or os.getenv("QDRAT_API_KEY") or os.getenv("QDRANT_API_KEY")

    @property
    def effective_database_url(self) -> str:
        url = self.DATABASE_URL or os.getenv("DATABASE_URL") or "sqlite:///./scholarpilot.db"
        # Standardize postgres:// to postgresql:// for SQLAlchemy 2.0
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url


@lru_cache()
def get_settings() -> Settings:
    """Return cached application settings instance."""
    return Settings()
