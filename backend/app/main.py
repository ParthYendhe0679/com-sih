"""FastAPI application entrypoint for KRITAGAS backend."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.api.v1.router import api_v1_router
from app.core.config import settings
from app.core.logging import get_logger, setup_logging
from app.middleware.error_handler import register_exception_handlers
from app.middleware.request_logging import RequestLoggingMiddleware

from app.db.session import dispose_engine

logger = get_logger("kritagas.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and graceful shutdown lifecycle hooks."""
    setup_logging(debug=settings.DEBUG)
    logger.info(f"=== Starting {settings.APP_NAME} in [{settings.ENVIRONMENT}] mode ===")
    logger.info(f"API Prefix: {settings.API_V1_PREFIX}")
    logger.info(f"CORS Allowed Origins: {settings.cors_origin_list}")
    yield
    logger.info(f"=== Shutting down {settings.APP_NAME} gracefully ===")
    try:
        await dispose_engine()
        logger.info("Database engine and connection pools successfully disposed.")
    except Exception as e:
        logger.error(f"Error disposing database engine on shutdown: {e}")
    try:
        from app.services.cache_service import cache_service
        await cache_service.close()
        logger.info("Valkey cache connection pool successfully closed.")
    except Exception as e:
        logger.warning(f"Error closing cache pool: {e}")



app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="""
# KRITAGAS — Criminal Intelligence & Investigation Platform Core Backend

This production foundation manages:
- **Authentication & RBAC**: JWT Access/Refresh tokens, Citizen / Police / Admin security boundaries.
- **FIR Intake & Triage**: Citizen complaint lodging, draft revisions, police review workflows.
- **Case Management**: Investigation tracking, lead investigator assignments, state machines, and timeline audits.
- **Offline FIR Support**: Walk-in complaint intake with scanned document metadata ready for OCR.
- **Evidence Management**: Chain of custody, cryptographic SHA-256 hashes, file metadata, and storage integration.
- **Operational Dashboards**: Real-time aggregated metrics for Citizens, Police Officers, and Administrators.
- **Future AI Pipeline Interfaces**: Decoupled integration interfaces for OCR, NLP, Knowledge Graph (Neo4j), Redis, and Multi-Agent pipelines.
    """,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Centralized error handling
register_exception_handlers(app)

# Request duration telemetry & audit logging middleware
app.add_middleware(RequestLoggingMiddleware)

# Cross-Origin Resource Sharing (CORS) for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API V1 router
app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)


@app.get("/", include_in_schema=False)
async def root():
    """Redirect root path to interactive Swagger documentation."""
    return RedirectResponse(url="/docs")
