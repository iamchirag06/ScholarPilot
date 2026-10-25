"""FastAPI application factory and lifecycle configuration."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.scholarpilot_ai.config import get_settings
from src.scholarpilot_ai.db.session import init_db, SessionLocal
from src.scholarpilot_ai.db.models import SchemeModel, ProfileModel, AutofillMappingModel
from src.scholarpilot_ai.data.seed_schemes import SEED_SCHEMES
from src.scholarpilot_ai.data.seed_profiles import SEED_PROFILES
from src.scholarpilot_ai.vector.qdrant_service import QdrantService
from src.scholarpilot_ai.api.routes import router

settings = get_settings()


def seed_initial_data_if_empty() -> None:
    """Populate initial schemes, test profiles, and verified autofill mappings if tables are empty."""
    from src.scholarpilot_ai.services.autofill import DEFAULT_VERIFIED_MAPPINGS

    db = SessionLocal()
    try:
        # Seed schemes if table empty
        if db.query(SchemeModel).count() == 0:
            for s in SEED_SCHEMES:
                db.add(SchemeModel(**s))
            db.commit()

        # Seed test profiles if table empty
        if db.query(ProfileModel).count() == 0:
            for p in SEED_PROFILES:
                db.add(ProfileModel(**p))
            db.commit()

        # Seed default verified portal mappings if empty
        if db.query(AutofillMappingModel).count() == 0:
            for m in DEFAULT_VERIFIED_MAPPINGS:
                db.add(AutofillMappingModel(**m))
            db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for startup and shutdown procedures."""
    # 1. Initialize relational database tables idempotently
    init_db()

    # 2. Seed initial benchmark data if database is empty
    seed_initial_data_if_empty()

    # 3. Ensure Qdrant collection is ready
    try:
        qdrant = QdrantService()
        qdrant.ensure_collection()
    except Exception:
        pass

    yield


def create_app() -> FastAPI:
    """Create and configure FastAPI application instance."""
    app = FastAPI(
        title="ScholarPilot AI/ML Recommendation Engine",
        description=(
            "Personalized scholarship recommendation engine providing semantic retrieval, "
            "deterministic eligibility verification, transparent ranking, and grounded explanations."
        ),
        version="1.0.0",
        lifespan=lifespan,
    )

    # CORS configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*", "ngrok-skip-browser-warning"],
    )

    # Middleware ensuring ngrok-skip-browser-warning header is present on all responses
    @app.middleware("http")
    async def add_ngrok_skip_browser_warning_header(request, call_next):
        response = await call_next(request)
        response.headers["ngrok-skip-browser-warning"] = "true"
        return response

    app.include_router(router)

    return app


app = create_app()
