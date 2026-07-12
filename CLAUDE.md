# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PingCraft — an AI-powered requirements analysis and import tool for PingCode project management. Users upload requirement documents (DOCX/Markdown/TXT), which are parsed by LLM into structured work items, matched against existing PingCode projects via vector search (SeekDB), and batch-imported with duplicate detection.

## Tech Stack

- **Frontend:** Vue 3 + TypeScript + Vite 7, Element Plus UI, Pinia state, ECharts
- **Backend:** Node.js 22 + Express 5 (ESM), Sequelize 6 ORM, LangChain (OpenAI/Anthropic)
- **Database:** SeekDB (MySQL-compatible with vector embeddings), port 2881
- **Package manager:** pnpm workspace — `backend/`, `frontend/`, `cli/`, (future) `packages/*`

## Commands

### Development

```bash
# Install all workspace packages at once (backend + frontend + cli)
pnpm install

# Backend (port 3000)
cd backend && pnpm dev
# or: pnpm -F backend dev

# Frontend (port 5177)
cd frontend && pnpm dev
# or: pnpm -F frontend dev

# CLI (dev mode, runs source via tsx). NOTE: pnpm v10 forwards `--` literally,
# so `pnpm -F cli dev -- --version` fails — use `exec tsx` to pass flags:
pnpm -F cli exec tsx src/main.ts --version
# or build first, then run the artifact:
pnpm -F cli build && node cli/dist/main.js <cmd>

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

# CLI
pnpm -F cli test
pnpm -F cli test:coverage

# Root-level aggregation (runs in every package that has the script)
pnpm test
```

Test files live in `src/**/__tests__/**/*.test.ts` (backend, frontend) and `cli/tests/**/*.test.ts` (cli).

### Type Checking

```bash
pnpm -F backend typecheck            # tsc --noEmit
pnpm -F frontend exec vue-tsc --noEmit
pnpm -F cli typecheck                # tsc --noEmit
pnpm typecheck                       # root aggregation
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
models/          # Sequelize models — index.ts defines all associations
routes/          # Express route handlers (mounted in app.ts)
services/        # Business logic: agent.ts (LangChain), pingcode.ts (API client),
                 #   parser.ts (doc parsing), db.ts (Sequelize+SeekDB init)
prompts/         # LLM prompt templates
utils/           # Helpers (retry, response wrappers)
app.ts           # Express app setup, middleware stack, route mounting
index.ts         # Server entry point
```

**API route prefixes:** `/auth` (OAuth), `/auth/local` (login/register), `/api` (all other endpoints), `/api/metadata`, `/api/models`, `/api/records`, `/api/stats`, `/api/roles`, `/api/users`

**Backend is TypeScript + ESM** (`"type": "module"`, `module: NodeNext`). Source files are `.ts`; compiled output is `.js`. Because of NodeNext resolution, **imports always specify the `.js` extension** (e.g. `import { x } from './retry.js'`) even though the source on disk is `.ts` — this resolves correctly under both `tsx` (dev) and the compiled `tsc` output.

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

### CLI (`cli/src/`) — Agent-first CLI for PingCode + PingCraft

```
bin/              # `pingcode.js` shim → dist/main.js
src/
├── commands/     L3 Command definitions (Commander) — thin: arg parsing + output
├── sdk/          L2 PingCode API SDK — pure functions/classes, no IO but HTTP
├── core/         L1 Core runtime — config / auth / output / errors / pagination
├── mcp/          MCP Server mode (Phase 3)
├── index.ts      Library entry: exports createProgram()/run() (no side effects)
└── main.ts       Process entry: calls run() and exits
```

**Layer discipline:** `commands/` only calls `sdk/` and `core/`; `sdk/` does not reference `core/` output/error formats; `core/` does not depend on `sdk/`.

**Three run modes:** CLI (`pingcode <cmd>`), library (`import { ... } from '@pingcraft/cli/sdk'`), MCP (`pingcode mcp serve`, Phase 3). Plan & phase status: see `docs/cli/`.

> 🚧 Status: Phase 0 (scaffold) complete — only `--version` / `--help` / `capabilities` are live; business commands land in Phase 1+.

### Shared package (future `packages/pingcode-sdk/`)

Phase 3 extracts `cli/sdk/` into a standalone `@pingcraft/pingcode-sdk` package that both the CLI and `backend/src/services/pingcode.ts` depend on (backend keeps a thin compat facade). Until then, the SDK lives in-repo under `cli/sdk/`.

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
