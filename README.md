# CDGS — Continuous Documentation Generation System

> Automated, AI-powered documentation generation for GitHub repositories.

---

## Implementation Status

| Phase / Module | Status |
|---|---|
| Phase 1: Foundation (React + Express +  TS + Pino + Zod + Supabase) | ✅ Complete |
| Phase 2: Auth & Repo Import (GitHub OAuth + Token Encryption + File Tree + Commits + Reader) | ✅ Complete |
| Phase 3: Automatic Change Detection (Pipeline Service, Database Schema 003, Shared Contracts, Dashboard UI) | 🚀 Phase 3 Active (Integration/Pipeline Complete) |
| Phase 4: AI Generation Engine & Public Portal | ⏳ Phase 4 |

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

### 3. Apply database migrations

In your Supabase project → **SQL Editor**, run the migration files in order:

1. `db/schema.sql` (Phase 1 core schema)
2. `db/migrations/002_phase2_auth.sql` (Phase 2 OAuth & repo columns)
3. `db/migrations/003_phase3_pipeline.sql` (Phase 3 pipeline runs & stage logs)

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
│   ├── schema.sql        # Core Supabase schema
│   └── migrations/       # Incremental SQL migrations (002_auth, 003_pipeline)
├── docs/                 # MkDocs documentation source
├── frontend/             # React + Vite + Tailwind app
│   └── src/
│       ├── components/   # Reusable UI components (FileViewerModal, PipelineRunsTable, etc.)
│       └── pages/        # Route-level pages (DashboardPage, RepositoryDetailPage, etc.)
└── backend/              # Express + TypeScript API
    └── src/
        ├── auth/         # GitHub OAuth, JWT, & Cookie auth
        ├── config/       # Typed env var loader
        ├── db/           # Supabase client
        ├── github/       # Centralized GitHub REST API client
        ├── logger/       # Pino logger
        ├── middleware/   # Error handler, validation, authentication
        ├── pipeline/     # Phase 3 Pipeline Service, contracts, & endpoints
        ├── repositories/ # Repository management API
        ├── routes/       # Central API route index
        └── swagger/      # Swagger/OpenAPI config
```

---

## API Reference

All routes are prefixed `/api/v1/`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/health` | Health check |
| `GET` | `/api/v1/docs` | Swagger UI |
| `GET` | `/api/v1/auth/github` | Trigger GitHub OAuth login |
| `GET` | `/api/v1/auth/me` | Get current authenticated user |
| `GET` | `/api/v1/repositories` | List connected repositories |
| `GET` | `/api/v1/repositories/:id` | Repository details, commit history & tree |
| `GET` | `/api/v1/repositories/:id/file` | Read raw file contents from GitHub |
| `GET` | `/api/v1/pipeline-runs` | List Phase 3 pipeline runs |
| `GET` | `/api/v1/pipeline-runs/:id` | Get pipeline run details & stage logs |

---

## Environment Variables

See [`.env.example`](.env.example) for the full list with descriptions.
