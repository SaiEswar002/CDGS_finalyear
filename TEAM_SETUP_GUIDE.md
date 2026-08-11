# CDGS — Continuous Documentation Generation System: Team Onboarding & Module Integration Guide

Welcome to the **CDGS** codebase! This guide provides a complete overview of how the project is structured, how the frontend and backend communicate, how to configure environment variables, and how your team can easily build new modules.

---

## 🛠️ 1. Architecture Overview

CDGS is built using a decoupled architecture:

```
[ Frontend: React + Vite + Tailwind ] (Port 5173)
             │
             │ HTTP / Cookie Auth (Proxied via Vite /api/v1)
             ▼
[ Backend: Express + TypeScript API ] (Port 3000)
             │
      ┌──────┴──────────────────────────┐
      ▼                                 ▼
[ Supabase PostgreSQL DB ]    [ GitHub REST API ]
```

### Key Connections:
- **Vite Proxy**: In development, `frontend/vite.config.ts` proxies all API requests matching `/api/v1` to `http://localhost:3000/api/v1`.
- **Authentication**: Stateless JWT session cookie (`cdgs_token`). All authentication routes use `httpOnly`, `SameSite=Lax` cookies.
- **GitHub Token Storage**: GitHub access tokens are stored in Supabase **encrypted via AES-256-GCM**. Decryption takes place **only** inside `backend/src/github/service.ts`.

---

## 🚀 2. Quick Start for Team Members

### Step 1: Clone Repository & Install Dependencies
Run in your terminal at the root directory:

```bash
git clone https://github.com/SaiEswar002/CDGS_finalyear.git
cd CDGS_finalyear

# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

---

### Step 2: Environment Variables Setup (`.env`)
Create a `.env` file in the root directory (or copy from `.env.example`):

```env
# Server
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug
FRONTEND_URL=http://localhost:5173

# Supabase Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# GitHub OAuth App Settings (Set up at github.com/settings/developers)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_CALLBACK_URL=http://localhost:3000/api/v1/auth/github/callback

# Secrets (Must be random secure strings)
JWT_SECRET=your-32-character-secret-key-goes-here
COOKIE_SECRET=your-32-character-cookie-secret-goes-here

# AES-256-GCM Encryption Key (Must be exactly 64 hexadecimal characters: 32 bytes)
ENCRYPTION_KEY=00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff
```

---

### Step 3: Database Migrations Setup
1. Log in to your [Supabase Console](https://supabase.com/).
2. Open the **SQL Editor** tab.
3. Run the SQL scripts in this exact order:
   - `db/schema.sql` (Creates core tables: `users`, `repositories`, `documents`, etc.)
   - `db/migrations/002_phase2_auth.sql` (Adds GitHub OAuth & repository metadata columns)

---

### Step 4: Run the Application
You can launch both the backend and frontend simultaneously from the root directory:

```bash
# Starts backend on 3000 and frontend on 5173
npm run dev
```

Or run them in separate terminals:

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

- **Frontend Application**: `http://localhost:5173`
- **Backend Health Endpoint**: `http://localhost:3000/api/v1/health`
- **Interactive Swagger OpenAPI Docs**: `http://localhost:3000/api/v1/docs`

---

## 🧩 3. Codebase Structure & Module Layout

### Backend (`backend/src/`)

| Folder / File | Responsibility |
|---|---|
| `app.ts` | Express server setup (CORS, Helmet, Rate Limiting, Pino Logger, Cookies) |
| `routes/index.ts` | Central API Router mounting `/health`, `/auth`, `/github`, `/repositories` |
| `auth/` | GitHub OAuth authorization, callback, me endpoint, and token encryption |
| `github/service.ts` | **Isolated GitHub API client** (fetches repos, commits, files, trees using encrypted tokens) |
| `repositories/` | Repositories module (Import, List, Get details, Tree navigation, Commits, File reader) |
| `middleware/` | `authenticate.ts` (JWT check), `errorHandler.ts` (Structured HttpErrors), `validate.ts` (Zod validation) |

### Frontend (`frontend/src/`)

| Folder / File | Responsibility |
|---|---|
| `lib/api.ts` | Shared Axios API client configured with `withCredentials: true` |
| `store/authStore.ts` | Zustand global store tracking logged-in user state |
| `pages/LandingPage.tsx` | Static hero & feature showcase page |
| `pages/LoginPage.tsx` | Sign-in page with "Continue with GitHub" OAuth redirect button |
| `pages/DashboardPage.tsx` | Overview dashboard displaying user profile & quick actions |
| `pages/RepositoriesPage.tsx` | Repository management page & import repository modal |
| `pages/RepositoryDetailPage.tsx` | Interactive repository explorer (File Tree, Commits, Languages, File Reader) |
| `components/FileViewerModal.tsx` | Code preview modal with "Edit on GitHub ↗" link |

---

## 🛠️ 4. How Team Members Can Build New Modules

To add a new module (for example: **Document Generation / Versioning**):

### Step 1: Create backend Service & Controller
1. Add schema/types in `backend/src/<module_name>/<module_name>.schema.ts` using Zod.
2. Add service logic in `backend/src/<module_name>/<module_name>.service.ts`.
3. Add controller handlers in `backend/src/<module_name>/<module_name>.controller.ts`.
4. Define Express routes in `backend/src/<module_name>/<module_name>.router.ts`.

### Step 2: Mount Route in API Router
In `backend/src/routes/index.ts`:
```ts
import { myModuleRouter } from '../myModule/myModule.router'

apiRouter.use('/my-module', myModuleRouter)
```

### Step 3: Call API in Frontend
In `frontend/src/`:
```ts
import { api } from '../lib/api'

const res = await api.get('/my-module/resource')
```

---

## 🧪 5. Testing & Verification

Run tests anytime before pushing code:

```bash
# Run backend vitest unit & integration tests
cd backend && npm test

# Run frontend TypeScript typecheck
cd frontend && npx tsc --noEmit

# Run frontend production build test
cd frontend && npx vite build
```

---

## 📚 6. Interactive API Documentation (Swagger)

Team members can explore and test all active endpoints visually without writing custom curl commands by opening:

👉 **http://localhost:3000/api/v1/docs**
