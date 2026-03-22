## Why

The project already has a complete backend API, but there is no production-ready web frontend for daily use by a TFT friend group. A mobile-first frontend specification is needed now so implementation can start immediately with clear API integration boundaries and consistent UX for fast post-match entry.

## What Changes

- Define a full frontend-only implementation plan for a new web app using `Vite + React + TypeScript + Tailwind CSS + Ant Design`.
- Define information architecture, route hierarchy, and module navigation for `Match Stakes`, `Group Fund`, and `Rules`.
- Define shared screens and utilities: dashboard overview, player management, reusable match detail presentation, loading/empty/error states, and not-found handling.
- Define reusable quick match entry flow for both modules with strict validation, fast mobile interaction, and required recent preset integration.
- Define concrete page-to-endpoint mapping using `api_usage_guide_en.md` as the backend source of truth.
- Define frontend data and form architecture using `TanStack Query`, `React Hook Form`, `Zod`, and `dayjs`, including query key and mutation invalidation strategy.
- Define responsive behavior patterns (mobile-first lists/cards, desktop sidebar, mobile drawer/bottom-friendly navigation, sticky quick actions).
- Break implementation into small, execution-friendly tasks for later `/opsx:apply`.
- Explicitly keep backend contracts unchanged (no backend redesign in this change).

## Capabilities

### New Capabilities
- `web-app-shell-navigation`: App shell, responsive navigation, route scaffolding, and global UX states.
- `web-integration-foundation`: Typed API client, DTO/schema strategy, query key conventions, mutation/error handling, and formatting utilities.
- `web-dashboard-and-players`: Dashboard overview and player management screens mapped to existing player and dashboard APIs.
- `web-match-stakes-experience`: Match Stakes summary, debt movement history feed, match history, and match detail interaction.
- `web-group-fund-experience`: Group Fund summary, fund ledger history, match history, manual fund transactions, and detail interaction.
- `web-quick-match-entry`: Reusable high-speed match creation flow for both modules, including recent preset preload/update behavior.
- `web-rules-management`: Rule set and version management UI (list/detail/create/edit/version metadata) for nested rule DTO structures.

### Modified Capabilities
- None (no existing frontend OpenSpec capabilities currently defined in `openspec/specs`).

## Impact

- Affected codebase areas: new frontend app structure under `apps/web` (or equivalent app directory if repository constraints differ), including routing, features, API layer, shared UI, and form infrastructure.
- Backend/API impact: no contract changes; frontend consumes existing `/api/v1` APIs exactly as documented.
- Dependencies introduced: `react-router-dom`, `@tanstack/react-query`, `react-hook-form`, `zod`, `@hookform/resolvers`, `dayjs`, and lightweight helpers such as `axios`, `clsx`, and `tailwind-merge` where useful.
- Delivery impact: enables immediate implementation with predictable sequence and minimal ambiguity across module teams.
