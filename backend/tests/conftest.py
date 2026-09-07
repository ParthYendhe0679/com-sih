"""Pytest test configuration and fixtures for KRITAGAS backend testing."""

from typing import AsyncGenerator
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.constants import UserRole
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import get_async_session
from app.main import app
from app.models.user import User

# In-memory SQLite with StaticPool ensures all connections share the same memory DB
test_engine = create_async_engine(
    "sqlite+aiosqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest_asyncio.fixture(autouse=True)
async def prepare_database():
    """Create all tables in in-memory test database and clean up after each test."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


from app.db.session import get_async_session, get_db

@pytest_asyncio.fixture(autouse=True)
def override_db():
    """Override application get_async_session and get_db dependencies with test session."""
    async def _get_test_session():
        async with TestingSessionLocal() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    app.dependency_overrides[get_async_session] = _get_test_session
    app.dependency_overrides[get_db] = _get_test_session
    yield
    app.dependency_overrides.pop(get_async_session, None)
    app.dependency_overrides.pop(get_db, None)


@pytest_asyncio.fixture
async def session() -> AsyncGenerator[AsyncSession, None]:
    """Provide isolated async session for database unit tests."""
    async with TestingSessionLocal() as session:
        yield session



@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """HTTP client for unauthenticated API requests."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


@pytest_asyncio.fixture
async def admin_user() -> User:
    async with TestingSessionLocal() as session:
        user = User(
            email="test_admin@kritagas.gov.in",
            username="test_admin",
            full_name="Test Admin",
            phone_number="+91-11-23090001",
            password_hash=hash_password("Admin@123456"),
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


@pytest_asyncio.fixture
async def police_user() -> User:
    async with TestingSessionLocal() as session:
        user = User(
            email="test_police@police.gov.in",
            username="test_police",
            full_name="Officer Ramesh Kumar",
            phone_number="+91-9811998877",
            password_hash=hash_password("Police@123456"),
            role=UserRole.POLICE,
            badge_number="POL-TEST-001",
            department="Central District Police Station",
            rank="Sub-Inspector",
            is_active=True,
            is_verified=True,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


@pytest_asyncio.fixture
async def citizen_user() -> User:
    async with TestingSessionLocal() as session:
        user = User(
            email="test_citizen@example.com",
            username="test_citizen",
            full_name="Aarav Sharma",
            phone_number="+91-9876500001",
            password_hash=hash_password("Citizen@123456"),
            role=UserRole.CITIZEN,
            is_active=True,
            is_verified=True,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


@pytest.fixture
def admin_token(admin_user: User) -> str:
    return create_access_token(subject=admin_user.id, role=admin_user.role.value, email=admin_user.email)


@pytest.fixture
def police_token(police_user: User) -> str:
    return create_access_token(subject=police_user.id, role=police_user.role.value, email=police_user.email)


@pytest.fixture
def citizen_token(citizen_user: User) -> str:
    return create_access_token(subject=citizen_user.id, role=citizen_user.role.value, email=citizen_user.email)


@pytest_asyncio.fixture
async def admin_client(admin_token: str) -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    headers = {"Authorization": f"Bearer {admin_token}"}
    async with AsyncClient(transport=transport, base_url="http://testserver", headers=headers) as ac:
        yield ac


@pytest_asyncio.fixture
async def police_client(police_token: str) -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    headers = {"Authorization": f"Bearer {police_token}"}
    async with AsyncClient(transport=transport, base_url="http://testserver", headers=headers) as ac:
        yield ac


@pytest_asyncio.fixture
async def citizen_client(citizen_token: str) -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    headers = {"Authorization": f"Bearer {citizen_token}"}
    async with AsyncClient(transport=transport, base_url="http://testserver", headers=headers) as ac:
        yield ac
