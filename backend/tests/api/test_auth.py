"""Authentication API test suite."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_citizen_success(client: AsyncClient):
    payload = {
        "email": "new.citizen@test.com",
        "username": "new_citizen",
        "full_name": "New Citizen User",
        "password": "Password@123",
        "phone_number": "+91-9988776655",
    }
    resp = await client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["success"] is True
    assert "access_token" in data["data"]
    assert "refresh_token" in data["data"]
    assert data["data"]["role"] == "CITIZEN"


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    payload = {
        "email": "duplicate.test@test.com",
        "username": "dup_user1",
        "full_name": "Duplicate User One",
        "password": "Password@123",
        "phone_number": "+91-9988776655",
    }
    resp1 = await client.post("/api/v1/auth/register", json=payload)
    assert resp1.status_code == 201

    payload2 = {
        "email": "duplicate.test@test.com",
        "username": "dup_user2",
        "full_name": "Duplicate User Two",
        "password": "Password@123",
        "phone_number": "+91-9988776655",
    }
    resp2 = await client.post("/api/v1/auth/register", json=payload2)
    assert resp2.status_code == 409
    data2 = resp2.json()
    assert data2["success"] is False
    assert data2["error"]["code"] == "CONFLICT"


@pytest.mark.asyncio
async def test_register_weak_password(client: AsyncClient):
    payload = {
        "email": "weak.pw@test.com",
        "username": "weak_pw_user",
        "full_name": "Weak Password User",
        "password": "123",  # too short
        "phone_number": "+91-9988776655",
    }
    resp = await client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    # Register first
    reg_payload = {
        "email": "login.test@test.com",
        "username": "login_user",
        "full_name": "Login Test User",
        "password": "Password@123",
        "phone_number": "+91-9988771122",
    }
    await client.post("/api/v1/auth/register", json=reg_payload)

    # Login
    login_payload = {
        "username_or_email": "login_user",
        "password": "Password@123",
    }
    resp = await client.post("/api/v1/auth/login", json=login_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["email"] == "login.test@test.com"


@pytest.mark.asyncio
async def test_login_invalid_password(client: AsyncClient):
    login_payload = {
        "username_or_email": "nonexistent@test.com",
        "password": "WrongPassword@123",
    }
    resp = await client.post("/api/v1/auth/login", json=login_payload)
    assert resp.status_code == 401
    data = resp.json()
    assert data["success"] is False
    assert data["error"]["code"] == "AUTHENTICATION_FAILED"


@pytest.mark.asyncio
async def test_get_me_flow(citizen_client: AsyncClient):
    resp = await citizen_client.get("/api/v1/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["role"] == "CITIZEN"
    assert data["data"]["username"] == "test_citizen"


@pytest.mark.asyncio
async def test_get_me_unauthorized(client: AsyncClient):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401
