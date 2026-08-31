# AGENTS.md

## Project overview

Ride Booking System backend: Express 5 + TypeScript + MongoDB (Mongoose) + Passport.js (Google OAuth) + JWT auth + Zod validation. Deployed on Vercel.

## Commands

- `npm run dev` — dev server with hot-reload via `ts-node-dev`
- `npm run build` — TypeScript compile (`tsc`)
- `npm run lint` — ESLint (`npx eslint ./src`)
- `npm start` — runs compiled output (`node ./dist/server.js`)

No test suite exists (`npm test` exits with error). No typecheck script — use `npm run build` to verify types.

## Build order

`lint` → `build` → `start`. There is no separate typecheck command; `tsc` (build) is the type checker.

## Architecture

- **Entry**: `src/server.ts` connects to MongoDB, starts Express, seeds admin user
- **App setup**: `src/app.ts` — middleware stack, passport init, mounts all routes under `/api`
- **Routes**: `src/app/routes/index.ts` — central route registry
- **Modules** (each in `src/app/modules/<name>/`): `controller` → `service` → `model`, plus `route.ts`, `validation.ts`, `interface.ts`, `constant.ts`
- **Roles**: `admin`, `driver`, `rider` (defined in `user.interface.ts` as `Role` enum)
- **Auth middleware**: `src/app/middlewares/checkAuth.ts` — JWT from `Authorization` header OR `accessToken` cookie; checks role, verified, blocked, deleted status
- **Query builder**: `src/app/utils/QueryBuilder.ts` — chainable filter/search/sort/paginate for list endpoints

## Key conventions

- All routes prefixed with `/api` (set in `app.ts`)
- Module routes registered in `src/app/routes/index.ts` — add new modules there
- JWT access token stored in httpOnly cookie (`accessToken`) — see `src/app/utils/setCookie.ts`
- Validation uses Zod schemas in `*.validation.ts` files
- `QueryBuilder` handles pagination (default page=1, limit=10), sorting (default `-createdAt`), field selection, and regex search
- Seed admin auto-creates on startup from env vars (`ADMIN_EMAIL`, `ADMIN_PASSWORD`)
- `dist/` is committed (build artifact) — needed for Vercel deployment

## Environment

15 required env vars — see `src/app/config/env.ts`. App throws on missing vars at import time. Key ones: `DB_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

## ESLint

Uses flat config (`eslint.config.mjs`) with `typescript-eslint` strict + stylistic presets. `no-console` is set to warn (use `/* eslint-disable no-console */` where needed).
