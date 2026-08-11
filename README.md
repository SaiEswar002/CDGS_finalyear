# DocOps — Code Documentation Generation System

> Automated, AI-powered documentation generation for GitHub repositories.

---

## What's Implemented (Phase 1 — Foundation)

| Area | Status |
|---|---|
| Frontend (React + Vite + Tailwind + Router) | ✅ |
| Backend (Express + TypeScript strict) | ✅ |
| `GET /api/v1/health` | ✅ |
| Centralized config loader (zod-validated) | ✅ |
| Structured logging (pino) | ✅ |
| Centralized error-handling middleware | ✅ |
| Zod validation middleware factory | ✅ |
| Supabase client | ✅ |
| Database schema (10 tables) | ✅ |
| Docker Compose (frontend, backend, redis) | ✅ |
| Swagger base config (`/api/v1/docs`) | ✅ |
| JSDoc base config | ✅ |
| MkDocs base config | ✅ |

**Not yet implemented (later phases):** GitHub OAuth, GitHub API calls, webhook handling, BullMQ job processing, AI provider calls, documentation generation, versioning logic.

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
