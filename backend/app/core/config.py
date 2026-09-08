"""Configuration settings loaded from environment variables using Pydantic Settings."""

from typing import List, Optional, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralized application configuration settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "KRITAGAS Backend"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # Security & JWT
    SECRET_KEY: str = "kritagas_default_secret_key_change_in_production_min_32_chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/kritagas_db"
    DATABASE_ECHO: bool = False
    POSTGRES_POOL_SIZE: int = 10
    POSTGRES_MAX_OVERFLOW: int = 20
    POSTGRES_POOL_TIMEOUT: int = 30
    POSTGRES_POOL_RECYCLE: int = 1800

    # CORS
    FRONTEND_URL: str = "http://localhost:3000"
    CORS_ORIGINS: Union[str, List[str]] = "http://localhost:3000,http://127.0.0.1:3000"

    # Storage
    STORAGE_BACKEND: str = "local"
    STORAGE_PROVIDER: str = "local"
    LOCAL_STORAGE_DIR: str = "./uploads"

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 120

    # AI Provider API Keys & Settings
    # Groq Multi-Key Configuration
    GROQ_API_KEY_1: Optional[str] = None
    GROQ_API_KEY_2: Optional[str] = None
    GROQ_API_KEY_3: Optional[str] = None
    GROQ_API_KEY_4: Optional[str] = None
    GROQ_PRIMARY_KEY_INDEX: int = 1
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_API_KEY: Optional[str] = None  # Backward compatibility fallback

    # Google Gemini Multi-Key Configuration
    GEMINI_API_KEY_1: Optional[str] = None
    GEMINI_API_KEY_2: Optional[str] = None
    GEMINI_PRIMARY_KEY_INDEX: int = 1
    GEMINI_MODEL: str = "gemini-1.5-flash"
    GEMINI_API_KEY: Optional[str] = None  # Backward compatibility fallback

    # Hugging Face Configuration
    HUGGINGFACE_API_KEY: Optional[str] = None
    HF_EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"

    # OpenAI Configuration (Optional/Future)
    OPENAI_API_KEY: Optional[str] = None

    # AI Pipeline & Routing Controls
    AI_DEFAULT_PROVIDER: str = "groq"
    AI_ENABLE_GROQ: bool = True
    AI_ENABLE_GEMINI: bool = True
    AI_ENABLE_HUGGINGFACE: bool = True
    AI_REQUEST_TIMEOUT: int = 30
    AI_MAX_RETRIES: int = 2

    # ML & Similarity Thresholds
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    SIMILARITY_THRESHOLD: float = 0.75
    ENTITY_MATCH_THRESHOLD: float = 0.80

    # Infrastructure (Optional - will not crash if missing)
    # Neo4j Graph Database Configuration (Neo4j Aura / Community / Enterprise)
    NEO4J_URI: Optional[str] = None
    NEO4J_USERNAME: Optional[str] = "neo4j"
    NEO4J_PASSWORD: Optional[str] = None
    NEO4J_DATABASE: str = "neo4j"
    NEO4J_MAX_CONNECTION_POOL_SIZE: int = 50
    NEO4J_CONNECTION_TIMEOUT: float = 5.0
    NEO4J_QUERY_TIMEOUT: float = 15.0
    NEO4J_GRAPH_MAX_DEPTH: int = 3

    # Valkey Cache Configuration (Aiven Valkey / Redis-compatible)
    VALKEY_URL: Optional[str] = None
    VALKEY_HOST: Optional[str] = None
    VALKEY_PORT: int = 24408
    VALKEY_USERNAME: str = "default"
    VALKEY_PASSWORD: Optional[str] = None
    VALKEY_SSL: bool = True
    VALKEY_SOCKET_TIMEOUT: float = 2.0
    VALKEY_CONNECT_TIMEOUT: float = 3.0
    ENABLE_VALKEY: bool = True

    # Feature Flags
    ENABLE_AI: bool = True
    ENABLE_GRAPH: bool = False
    ENABLE_REDIS: bool = False
    ENABLE_BLOCKCHAIN: bool = False
    ENABLE_OCR: bool = False

    # Blockchain Evidence Integrity Configuration
    BLOCKCHAIN_MODE: str = "mock"  # mock | ethereum
    BLOCKCHAIN_PROVIDER: str = "mock"
    BLOCKCHAIN_ENABLED: bool = False
    BLOCKCHAIN_RPC_URL: Optional[str] = None
    BLOCKCHAIN_PRIVATE_KEY: Optional[str] = None
    BLOCKCHAIN_CONTRACT_ADDRESS: Optional[str] = None

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: str) -> str:
        """Ensure standard postgresql:// or postgres:// connection strings use asyncpg driver."""
        if not isinstance(v, str):
            return v
        # Convert postgres:// or postgresql:// to postgresql+asyncpg://
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql+asyncpg://", 1)
        elif v.startswith("postgresql://") and not v.startswith("postgresql+asyncpg://"):
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)

        # Adapt SSL parameters for asyncpg
        if "sslmode=require" in v:
            v = v.replace("sslmode=require", "ssl=require")
        if "channel_binding=" in v:
            import re
            v = re.sub(r"[?&]channel_binding=[^&]*", "", v)
            if "?" not in v and "&" in v:
                v = v.replace("&", "?", 1)
        return v

    @property
    def cors_origin_list(self) -> List[str]:
        """Convert comma-delimited string or list to list of origin strings."""
        if isinstance(self.CORS_ORIGINS, list):
            return self.CORS_ORIGINS
        if isinstance(self.CORS_ORIGINS, str):
            return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        return ["*"]

    def get_active_groq_key(self) -> Optional[str]:
        """Retrieve the active Groq API key based on GROQ_PRIMARY_KEY_INDEX with safe fallback."""
        idx = self.GROQ_PRIMARY_KEY_INDEX
        primary_key_attr = f"GROQ_API_KEY_{idx}"
        primary_val = getattr(self, primary_key_attr, None)
        if primary_val and primary_val.strip():
            return primary_val.strip()

        # Fallback to any populated Groq key
        candidates = [
            self.GROQ_API_KEY_1,
            self.GROQ_API_KEY,
            self.GROQ_API_KEY_2,
            self.GROQ_API_KEY_3,
            self.GROQ_API_KEY_4,
        ]
        for key in candidates:
            if key and key.strip():
                return key.strip()
        return None

    def get_active_gemini_key(self) -> Optional[str]:
        """Retrieve the active Gemini API key based on GEMINI_PRIMARY_KEY_INDEX with safe fallback."""
        idx = self.GEMINI_PRIMARY_KEY_INDEX
        primary_key_attr = f"GEMINI_API_KEY_{idx}"
        primary_val = getattr(self, primary_key_attr, None)
        if primary_val and primary_val.strip():
            return primary_val.strip()

        # Fallback to any populated Gemini key
        candidates = [
            self.GEMINI_API_KEY_1,
            self.GEMINI_API_KEY,
            self.GEMINI_API_KEY_2,
        ]
        for key in candidates:
            if key and key.strip():
                return key.strip()
        return None

    def get_active_hf_key(self) -> Optional[str]:
        """Retrieve the active Hugging Face API key if configured."""
        if self.HUGGINGFACE_API_KEY and self.HUGGINGFACE_API_KEY.strip():
            return self.HUGGINGFACE_API_KEY.strip()
        return None

    def is_provider_configured(self, provider_name: str) -> bool:
        """Check whether a specific provider has active credentials and is enabled."""
        p = provider_name.lower().strip()
        if p == "groq":
            return bool(self.AI_ENABLE_GROQ and self.get_active_groq_key())
        elif p == "gemini":
            return bool(self.AI_ENABLE_GEMINI and self.get_active_gemini_key())
        elif p in ("huggingface", "hf"):
            # Hugging Face can operate without key for public models, but key unlocks higher limits
            return bool(self.AI_ENABLE_HUGGINGFACE)
        elif p == "openai":
            return bool(self.OPENAI_API_KEY and self.OPENAI_API_KEY.strip())
        elif p in ("local", "local_fallback", "rule_engine"):
            return True
        return False

    @property
    def valkey_connection_url(self) -> Optional[str]:
        """Resolve Valkey/Redis connection string with TLS support."""
        if self.VALKEY_URL and self.VALKEY_URL.strip():
            return self.VALKEY_URL.strip()
        if self.REDIS_URL and self.REDIS_URL.strip():
            return self.REDIS_URL.strip()
        if self.VALKEY_HOST and self.VALKEY_HOST.strip():
            scheme = "rediss" if self.VALKEY_SSL else "redis"
            user = self.VALKEY_USERNAME or "default"
            pwd = f":{self.VALKEY_PASSWORD}" if self.VALKEY_PASSWORD else ""
            auth = f"{user}{pwd}@" if (user or pwd) else ""
            return f"{scheme}://{auth}{self.VALKEY_HOST.strip()}:{self.VALKEY_PORT}"
        return None


settings = Settings()


