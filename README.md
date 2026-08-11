# CDGS — Continuous Documentation Generation System

> Automated, AI-powered documentation generation for GitHub repositories.

---

## Implementation Status

| Phase / Module | Status |
|---|---|
| Phase 1: Foundation (React + Express + TS + Pino + Zod + Supabase) | ✅ Complete |
| Phase 2: Auth & Repo Import (GitHub OAuth + Token Encryption + File Tree + Commits + Reader) | ✅ Complete |
| Phase 3: Webhooks, Job Queue (BullMQ/Redis), Git Clone/Diff, AI Doc Engine | ⏳ Phase 3 |
| Phase 4: Documentation Versioning & Public Portal | ⏳ Phase 4 |

📖 **For Team Setup & Module Development Guide, see [TEAM_SETUP_GUIDE.md](TEAM_SETUP_GUIDE.md).**

---

## Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [Docker](https://www.docker.com/) + Docker Compose v2
- A [Supabase](https://supabase.com/) project (for DB)

---

## Local Setup

### 1. Clone & install

```bash
git clone https://github.com/SaiEswar002/CDGS_finalyear.git
cd CDGS_finalyear
```

### 2. Set up environment variables

```bash
cp .env.example .env
# Edit .env and fill in your Supabase URL, keys, etc.
```

### 3. Apply the database schema

In your Supabase project → **SQL Editor**, run:

```bash
# Paste contents of db/schema.sql and execute
```

### 4. Run with Docker Compose (recommended)

```bash
docker-compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3000 |
| Swagger UI | http://localhost:3000/api/v1/docs |
| Health check | http://localhost:3000/api/v1/health |

### 5. Run without Docker

**Backend:**
```bash
cd backend
npm install
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Redis** (required by backend):
```bash
docker run -p 6379:6379 redis:7-alpine
```

---

## Project Structure

```
CDGS_finalyear/
├── .env.example          # All required env vars (copy to .env)
├── docker-compose.yml    # All services
├── db/
│   └── schema.sql        # 10-table Supabase schema
├── docs/                 # MkDocs documentation source
├── frontend/             # React + Vite + Tailwind app
│   └── src/
│       ├── components/   # Reusable UI components
│       └── pages/        # Route-level pages
└── backend/              # Express + TypeScript API
    └── src/
        ├── config/       # Env var loader
        ├── db/           # Supabase client
        ├── logger/       # Pino logger
        ├── middleware/   # Error handler, validation
        ├── routes/       # API route handlers
        └── swagger/      # Swagger/OpenAPI config
```

---

## API

All routes are prefixed `/api/v1/`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/health` | Health check |
| `GET` | `/api/v1/docs` | Swagger UI |

---

## Environment Variables

See [`.env.example`](.env.example) for the full list with descriptions.
