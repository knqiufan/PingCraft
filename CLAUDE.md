# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PingCraft — an AI-powered requirements analysis and import tool for PingCode project management. Users upload requirement documents (DOCX/Markdown/TXT), which are parsed by LLM into structured work items, matched against existing PingCode projects via vector search (SeekDB), and batch-imported with duplicate detection.

## Tech Stack

- **Frontend:** Vue 3 + TypeScript + Vite 7, Element Plus UI, Pinia state, ECharts
- **Backend:** Node.js 22 + Express 5 (ESM), Sequelize 6 ORM, LangChain (OpenAI/Anthropic)
- **Database:** SeekDB (MySQL-compatible with vector embeddings), port 2881
- **Package manager:** pnpm (separate installs for frontend/ and backend/)

## Commands

### Development

```bash
# Backend (port 3000)
cd backend && pnpm install && pnpm dev

# Frontend (port 5177)
cd frontend && pnpm install && pnpm dev

# SeekDB via Docker
docker compose up -d seekdb
```

### Testing (Vitest)

```bash
# Backend
cd backend && pnpm test              # run once
cd backend && pnpm test:watch        # watch mode
cd backend && pnpm test:coverage     # with coverage

# Frontend
cd frontend && pnpm test
cd frontend && pnpm test:watch
cd frontend && pnpm test:coverage
```

Test files live in `src/**/__tests__/**/*.test.js` (backend) and `src/**/__tests__/**/*.test.ts` (frontend).

### Type Checking

```bash
cd frontend && npx vue-tsc --noEmit
```

### Production Build

```bash
cd frontend && pnpm build            # outputs to dist/
docker compose up -d                  # full stack (needs backend/.env.production)
```

## Architecture

### Backend (`backend/src/`)

```
config/          # Environment loading (dotenv, .env.{NODE_ENV})
middleware/      # auth (JWT), permission (RBAC), logger, tokenRefresh, errorHandler
models/          # Sequelize models — index.js defines all associations
routes/          # Express route handlers (mounted in app.js)
services/        # Business logic: agent.js (LangChain), pingcode.js (API client),
                 #   parser.js (doc parsing), db.js (Sequelize+SeekDB init)
prompts/         # LLM prompt templates
utils/           # Helpers (retry, response wrappers)
app.js           # Express app setup, middleware stack, route mounting
index.js         # Server entry point
```

**API route prefixes:** `/auth` (OAuth), `/auth/local` (login/register), `/api` (all other endpoints), `/api/metadata`, `/api/models`, `/api/records`, `/api/stats`, `/api/roles`, `/api/users`

**Backend is ESM** (`"type": "module"`) — all imports use `.js` extensions.

### Frontend (`frontend/src/`)

```
api/             # Axios HTTP client modules (one per domain)
components/      # Vue SFCs organized by feature (dashboard/, workItems/, stats/, etc.)
composables/     # Vue 3 composables (useWorkItemMeta, useReportDownload)
stores/          # Pinia stores: app.ts (requirements/projects/metadata), user.ts (auth)
views/           # Page components: Login.vue, Dashboard.vue
router/          # Vue Router — /login, /dashboard (protected)
```

**Path alias:** `@` maps to `frontend/src/` (configured in both vite.config.ts and vitest.config.ts).

### Key Patterns

- **Data isolation:** All DB records include `user_id`; vector searches filter by user
- **Schema sync:** Sequelize uses `sync({ alter: true })` on startup — no migration files
- **SSE streaming:** Import progress uses Server-Sent Events (not WebSocket)
- **Production serving:** Docker builds frontend into `backend/public/`, Express serves it as SPA with fallback
- **Default admin:** `admin / qwe@123` created on first startup
- **Token refresh:** PingCode OAuth tokens auto-refreshed via middleware

### Environment

Backend env files: `.env`, `.env.development`, `.env.production`, `.env.test` (in `backend/`).
Frontend env files: `.env`, `.env.development`, `.env.production` (in `frontend/`).

Key variables: `SEEKDB_HOST`, `SEEKDB_PORT`, `SEEKDB_DATABASE`, `JWT_SECRET`, `CORS_ORIGIN`, `PINGCODE_HOST`, `VITE_API_BASE_URL`.
