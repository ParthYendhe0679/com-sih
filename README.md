# KRITAGAS — AI-Powered Criminal Intelligence & Investigation Platform

KRITAGAS is a unified criminal intelligence and investigation platform designed for law enforcement agencies, cybercrime cells, and citizen reporting.

---

## Repository Structure

```
KRITAGAS/
│
├── frontend/                 # Next.js 15 + TypeScript + Redux Toolkit UI
│   ├── src/                  # Components, app routes, store slices, mock intelligence
│   ├── public/               # Public assets and static media
│   ├── package.json          # Node dependencies and scripts
│   ├── tsconfig.json         # TypeScript configuration
│   └── README.md             # Frontend specific documentation
│
├── backend/                  # FastAPI + SQLAlchemy 2.0 Async + PostgreSQL Backend Core
│   ├── app/                  # Layered architecture (api, core, db, models, schemas, repos, services)
│   ├── alembic/              # Database schema migrations
│   ├── tests/                # Automated pytest test suites (31 passing tests)
│   ├── scripts/              # Database seeding script (Admin, Police, Citizen)
│   ├── requirements.txt      # Python dependencies
│   ├── Dockerfile            # Container build specification
│   ├── docker-compose.yml    # Multi-container orchestration (FastAPI + PostgreSQL 16)
│   └── README.md             # Backend architecture & API documentation
│
├── .gitignore                # Unified monorepo ignore rules
└── README.md                 # Project root documentation
```

---

## Quick Start Guide

### 1. Start Backend Core
```bash
cd backend

# Create & activate Python virtual environment (optional)
python -m venv .venv
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Linux / macOS

# Install Python requirements
pip install -r requirements.txt

# Start development server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Interactive API documentation: **[http://localhost:8000/docs](http://localhost:8000/docs)**

To run automated tests:
```bash
cd backend
python -m pytest -v
```

### 2. Start Frontend Application
```bash
cd frontend

# Install Node dependencies
npm install

# Run development server
npm run dev
```
Frontend interface: **[http://localhost:3000](http://localhost:3000)**

---

## Default Development Accounts

Run `python -m scripts.seed_db` inside `backend/` to seed the database:

| Role | Email | Username | Password |
|---|---|---|---|
| **Admin** | `admin@kritagas.gov.in` | `admin` | `Admin@123456` |
| **Police Officer** | `inspector.sharma@police.gov.in` | `inspector_sharma` | `Police@123456` |
| **Citizen** | `citizen.rahul@example.com` | `citizen_rahul` | `Citizen@123456` |
