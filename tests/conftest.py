import os
import pytest
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from qdrant_client import QdrantClient
from starlette.testclient import TestClient

# Ensure automated test suite runs offline and isolated from live paid external calls
os.environ["GEMINI_API_KEY"] = ""
os.environ["GROQ_API_KEY"] = ""

from src.scholarpilot_ai.db.models import (
    Base,
    SchemeModel,
    ProfileModel,
    AutofillMappingModel,
    AutofillSessionModel,
)
from src.scholarpilot_ai.services.autofill import DEFAULT_VERIFIED_MAPPINGS
from src.scholarpilot_ai.db.session import get_db
from src.scholarpilot_ai.vector.qdrant_service import QdrantService
from src.scholarpilot_ai.data.seed_schemes import SEED_SCHEMES
from src.scholarpilot_ai.data.seed_profiles import SEED_PROFILES
from src.scholarpilot_ai.api.app import app
from src.scholarpilot_ai.api.routes import get_qdrant_service
from src.scholarpilot_ai.services.summarizer import settings as summarizer_settings

# Isolate default test execution from external live LLM calls
summarizer_settings.GEMINI_API_KEY = None
summarizer_settings.GROQ_API_KEY = None


@pytest.fixture(scope="session")
def in_memory_engine():
    """Create shared SQLite in-memory database engine for tests."""
    eng = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=eng)
    return eng


@pytest.fixture(scope="function")
def db_session(in_memory_engine) -> Generator[Session, None, None]:
    """Provide clean database session populated with seed data for each test."""
    connection = in_memory_engine.connect()
    transaction = connection.begin()
    SessionTest = sessionmaker(bind=connection)
    session = SessionTest()

    # Seed initial test records
    for s in SEED_SCHEMES:
        session.add(SchemeModel(**s))
    for p in SEED_PROFILES:
        session.add(ProfileModel(**p))
    for m in DEFAULT_VERIFIED_MAPPINGS:
        session.add(AutofillMappingModel(**m))
    session.commit()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def mock_qdrant():
    """Provide isolated in-memory Qdrant service."""
    client = QdrantClient(location=":memory:")
    service = QdrantService(client=client)
    service.ensure_collection()
    service.index_schemes(SEED_SCHEMES)
    return service


@pytest.fixture(scope="function")
def client(db_session: Session, mock_qdrant: QdrantService) -> Generator[TestClient, None, None]:
    """Test client with overridden DB session and Qdrant fixtures."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    def override_get_qdrant():
        return mock_qdrant

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_qdrant_service] = override_get_qdrant

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()
