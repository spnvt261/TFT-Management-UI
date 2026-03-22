# TFT History Manager Frontend

## Prerequisites

- Node.js 20+
- pnpm 10+

## Required environment variables

Create `apps/web/.env`:

```bash
VITE_API_BASE_URL=http://localhost:3000
# Optional; defaults to browser timezone
VITE_APP_TIMEZONE=Asia/Ho_Chi_Minh
```

`VITE_API_BASE_URL` should point to backend host root (the app automatically appends `/api/v1` when missing).

## Install

```bash
pnpm install
```

## Run

```bash
pnpm dev
```

## Build

```bash
pnpm build
```

## Test

```bash
pnpm test:run
```
