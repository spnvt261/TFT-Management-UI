## Context

Backend APIs are already implemented and documented in `api_usage_guide_en.md`, including DTO shapes, enums, validation rules, and business behavior. The missing piece is a frontend that supports fast, repeated post-match entry on mobile while still offering clear desktop management flows for history, fund operations, and rules administration.

Constraints and integration rules:
- Frontend-only scope; no backend contract redesign.
- API guide is the source of truth.
- Money values are integer VND from backend; formatting is display-only.
- App must be mobile-first, with low-tap quick actions and clear history scanning.
- Required stack: `Vite`, `React`, `TypeScript`, `Tailwind CSS`, `Ant Design`, `React Router`, `TanStack Query`, `React Hook Form`, `Zod`, `dayjs`.

Primary stakeholders:
- Daily users entering matches quickly after TFT games.
- Group owner/admin maintaining players and rules.

## Goals / Non-Goals

**Goals:**
- Deliver a complete implementation-ready frontend architecture for all required modules and shared screens.
- Map each screen/interaction to existing backend endpoints with typed DTO handling.
- Optimize quick match entry for `MATCH_STAKES` and `GROUP_FUND` using recent preset APIs.
- Define consistent data fetching, mutation invalidation, error handling, and validation patterns.
- Provide responsive behavior that is mobile-first but scales to desktop.

**Non-Goals:**
- Changing backend endpoint contracts, business rules, or database model.
- Building a drag-and-drop visual rule builder.
- Introducing offline-first sync or real-time websocket updates in this change.
- Designing a full custom design system beyond practical Ant Design + Tailwind conventions.

## Decisions

### 1) App structure and location

Decision:
- Build frontend app at `apps/web` (or equivalent app folder if monorepo constraints require), with feature-oriented modules.

Proposed structure:
```txt
apps/web/
  src/
    app/                 # providers, app bootstrap, global styles
    router/              # route definitions and route guards/layout wrappers
    pages/               # page containers (route-level)
    features/
      dashboard/
      players/
      match-stakes/
      group-fund/
      matches/
      rules/
      quick-match/
    components/          # shared UI (cards, states, list items, app shell parts)
    api/                 # HTTP client, endpoint wrappers, DTO mappers
    hooks/               # reusable hooks not tied to single feature
    lib/                 # formatters, constants, env, utils
    types/               # shared TS types and enum unions
```

Rationale:
- Route containers remain simple in `pages/`.
- Domain complexity is isolated in `features/*`.
- Shared primitives stay reusable and not coupled to one module.

Alternative considered:
- Pure layer-based architecture (`components/services/hooks`) was rejected because module complexity (rules + quick-entry + histories) benefits from feature boundaries.

### 2) Tech stack and supporting libraries

Decision:
- Core stack exactly as requested.
- Add lightweight helpers:
  - `axios` for typed HTTP client and interceptors.
  - `@hookform/resolvers` for Zod-RHF integration.
  - `clsx` + `tailwind-merge` for class composition.
  - Optional `react-error-boundary` for route-level fallback UX.

Rationale:
- Fast setup and maintainable types.
- Reduced boilerplate in API/forms.

Alternative considered:
- Native `fetch` + custom wrappers was rejected for slower implementation and weaker interceptor ergonomics.

### 3) Routing and information architecture

Decision:
- Single app shell with responsive nav:
  - Desktop: persistent left sidebar.
  - Mobile: top bar + slide drawer navigation, plus sticky bottom-aligned quick-add action on module pages.

Route map:
- `/` -> redirect `/dashboard`
- `/dashboard`
- `/match-stakes`
- `/group-fund`
- `/rules`
- `/rules/new`
- `/rules/:ruleSetId`
- `/rules/:ruleSetId/edit`
- `/rules/:ruleSetId/versions/new`
- `/rules/:ruleSetId/versions/:versionId`
- `/rules/:ruleSetId/versions/:versionId/edit`
- `/players`
- `/players/new`
- `/players/:playerId/edit`
- `/matches/:matchId` (standalone detail fallback; module pages also open modal/drawer detail)
- `/not-found` (or catch-all `*`)

Screen hierarchy:
- App Shell
  - Dashboard
  - Match Stakes
    - Summary cards
    - Tabs: Debt Movement / Match History
    - Quick add entry
    - Detail drawer/modal
  - Group Fund
    - Summary cards
    - Tabs: Fund Ledger / Match History / (optional) Manual Transactions
    - Quick add entry + manual fund transaction action
    - Detail drawer/modal
  - Rules
    - Rule set list + filters
    - Rule set detail (versions)
    - Create/edit rule set metadata
    - Create version (nested rules/conditions/actions)
    - Version detail and metadata edit
  - Players

Rationale:
- Clear top-level modules in navigation per requirement.
- Route-based deep-linking for admin pages; modal/drawer detail for fast history browsing.

### 4) Page-to-endpoint mapping

Decision:
- Use dedicated API modules per feature and explicit query hooks per endpoint.

Mapping:
- Dashboard:
  - `GET /api/v1/dashboard/overview`
- Players:
  - `GET /api/v1/players`
  - `POST /api/v1/players`
  - `PATCH /api/v1/players/:playerId`
  - `DELETE /api/v1/players/:playerId`
  - Optional detail fetch: `GET /api/v1/players/:playerId`
- Match Stakes page:
  - `GET /api/v1/match-stakes/summary`
  - `GET /api/v1/match-stakes/ledger`
  - `GET /api/v1/match-stakes/matches`
  - Match detail drawer: `GET /api/v1/matches/:matchId`
  - Quick create: `POST /api/v1/matches`
  - Void action (detail): `POST /api/v1/matches/:matchId/void`
- Group Fund page:
  - `GET /api/v1/group-fund/summary`
  - `GET /api/v1/group-fund/ledger`
  - `GET /api/v1/group-fund/matches`
  - Manual transactions:
    - `POST /api/v1/group-fund/transactions`
    - `GET /api/v1/group-fund/transactions`
  - Match detail/void same as above via `/matches/:matchId` endpoints
- Rules:
  - `GET /api/v1/rule-sets`
  - `POST /api/v1/rule-sets`
  - `GET /api/v1/rule-sets/:ruleSetId`
  - `PATCH /api/v1/rule-sets/:ruleSetId`
  - `POST /api/v1/rule-sets/:ruleSetId/versions`
  - `GET /api/v1/rule-sets/:ruleSetId/versions/:versionId`
  - `PATCH /api/v1/rule-sets/:ruleSetId/versions/:versionId`
  - Quick-entry helpers:
    - `GET /api/v1/rule-sets/default/by-module/:module`
- Quick-entry presets:
  - `GET /api/v1/recent-match-presets/:module`
  - `PUT /api/v1/recent-match-presets/:module`

### 5) API client, DTO typing, and schema strategy

Decision:
- API layer pattern:
  - `api/httpClient.ts`: axios instance + base URL + envelope unwrap + normalized error object.
  - `api/<feature>.ts`: endpoint wrappers returning typed `data`.
- DTO handling:
  - Keep backend DTO-aligned TS interfaces in `types/api.ts`.
  - Add optional view-model adapters in `features/*/adapters.ts` only where UI needs derived fields.
- Runtime validation:
  - Use Zod for user-input payload schemas and query param parsing in forms.
  - Do not fully re-validate every response payload at runtime for MVP performance; rely on strong TypeScript and backend contract.

Rationale:
- Keeps integration explicit while avoiding over-engineering.

### 6) TanStack Query architecture

Decision:
- Centralized query key factory:
```ts
queryKeys = {
  dashboard: { overview: ["dashboard", "overview"] },
  players: { list: (q) => ["players", "list", q], detail: (id) => ["players", "detail", id] },
  rules: { list: (q) => ["rules", "list", q], detail: (id) => ["rules", "detail", id], version: (rsId, vId) => ["rules", "version", rsId, vId], defaultByModule: (m, c) => ["rules", "default", m, c] },
  matches: { detail: (id) => ["matches", "detail", id], list: (q) => ["matches", "list", q], preset: (m) => ["matches", "preset", m] },
  matchStakes: { summary: (q) => ["matchStakes", "summary", q], ledger: (q) => ["matchStakes", "ledger", q], matches: (q) => ["matchStakes", "matches", q] },
  groupFund: { summary: (q) => ["groupFund", "summary", q], ledger: (q) => ["groupFund", "ledger", q], matches: (q) => ["groupFund", "matches", q], txns: (q) => ["groupFund", "txns", q] }
}
```

Mutation invalidation policy:
- After match create: invalidate module summary, module ledger, module match list, dashboard overview, and module preset.
- After preset update: invalidate preset key only.
- After void match: invalidate match detail, module summary/ledger/matches, dashboard overview.
- After player create/update/delete: invalidate player list; invalidate dashboard overview; invalidate quick-entry dependent player options.
- After rule set/version changes: invalidate rule list/detail/version and default-by-module key as needed.
- After manual group fund transaction create: invalidate group fund summary/ledger/transactions + dashboard overview.

Rationale:
- Predictable freshness with bounded over-fetching.

### 7) Form architecture and validation

Decision:
- React Hook Form + Zod for all create/update forms.
- Shared form primitives for input wrappers and server error mapping.

Validation rules aligned to backend:
- Match form:
  - `module` required (`MATCH_STAKES | GROUP_FUND`).
  - participant count must be `3` or `4`.
  - unique player IDs.
  - unique placements.
  - placement integers in `1..8`.
  - note optional.
  - optional explicit rule set version id.
- Player form:
  - display name `1..120`.
  - slug optional unique (server conflict handled).
  - avatar URL optional valid URL.
- Rule set metadata:
  - code `1..80`, name `1..150`.
- Rule set version:
  - participant min/max `2..8`, min <= max.
  - nested rules with at least one action.
  - allow dynamic condition/action arrays.
- Group fund transaction:
  - positive integer amount.
  - reason min length 3.
  - player required for `CONTRIBUTION` and `WITHDRAWAL`.

Error UX:
- Inline field errors from Zod.
- Global form alert for API error codes (`MATCH_DUPLICATE_PLAYER`, `RULE_SET_VERSION_NOT_APPLICABLE`, etc.).
- Preserve entered values on failed submit.

### 8) Match detail presentation pattern

Decision:
- On module pages, clicking history row opens detail in:
  - mobile: full-height drawer,
  - desktop: right-side drawer/modal.
- Also support `/matches/:matchId` route for deep links and refresh-safe standalone view.

Rationale:
- Feed browsing remains fast and context-preserving, while deep linkability is retained.

### 9) Quick match entry and recent preset flow

Decision:
- Single reusable `QuickMatchEntry` component used by Match Stakes and Group Fund pages.
- Entry trigger:
  - sticky circular `+` FAB on mobile in module pages,
  - primary top action button on desktop.

Flow:
1. Open entry drawer/modal with module preselected from current page.
2. Load in parallel:
   - recent preset (`GET /recent-match-presets/:module`),
   - active players list,
   - default rule set by module with selected participant count (`GET /rule-sets/default/by-module/:module?participantCount=3|4`) if preset lacks usable values.
3. Prefill:
   - participant count from preset if available else `4`.
   - selected players from preset (trimmed to count and active players only).
   - rule set/version from preset if still valid; fallback to default rule set.
4. User edits players, placements, rule set/version, note.
5. Submit `POST /matches`.
6. Show immediate settlement confirmation state (totals + per-player net) from response.
7. Upsert preset (`PUT /recent-match-presets/:module`) using last selected players/rule set/version/count.
8. Close flow or allow “add another match” preserving module context.

Rationale:
- Meets low-tap repeated entry requirement and uses backend preset features explicitly.

### 10) UI composition and Ant Design + Tailwind convention

Decision:
- Ant Design:
  - form controls, date picker, tabs, modal/drawer, table (desktop-heavy screens), notification/message.
- Tailwind:
  - page layout, spacing, responsive rules, card/feed styling, custom state visuals.
- Token strategy:
  - configure Antd `ConfigProvider` theme tokens for brand palette and density.
  - mirror key values with CSS variables used by Tailwind utility classes.

Conflict prevention:
- Keep global CSS minimal.
- Avoid overriding Antd component internals globally.
- Use wrapper classes and scoped utility classes around Antd components.
- Prefer Antd v5 token/theming APIs instead of deep CSS overrides.

### 11) Responsive and mobile-first behavior

Decision:
- Phone-first defaults:
  - card/feed presentation for histories.
  - larger tap targets for player/placement pickers.
  - sticky quick add button on module pages.
  - detail in drawers.
- Desktop enhancements:
  - persistent sidebar.
  - split layout cards + optional table/list toggles for larger datasets.
  - wider rule version forms with multi-column sections.

### 12) Formatting, timezone, and status labeling utilities

Decision:
- `lib/format.ts` utilities:
  - `formatVnd(value: number): string` using locale-aware thousands separators and `₫`.
  - `formatDateTime(iso: string, tz?: string): string` using `dayjs` timezone plugins.
  - `formatRelativeTime(iso: string): string`.
  - status/module/rule-kind label maps.
- Timezone:
  - default display timezone from browser.
  - optional override by `VITE_APP_TIMEZONE` (fallback to browser zone).

Assumption:
- Backend timestamps are ISO strings in UTC-compatible format.

### 13) Loading, empty, error, and confirmation patterns

Decision:
- Standardized shared components:
  - `PageLoading`, `InlineLoading`.
  - `EmptyState` with action slots.
  - `ErrorState` with retry.
  - `ConfirmDangerModal` for void/deactivate operations.
- Destructive actions require explicit confirmation with concise consequence text.

### 14) Accessibility baseline

Decision:
- Ensure keyboard reachable navigation, form controls, and modal close actions.
- Provide visible focus states and semantic headings.
- Ensure color contrast for status badges and money deltas.
- Use accessible labels for icon-only actions (including `+` quick add button).

## Risks / Trade-offs

- [Large frontend scope in one change] -> Mitigation: feature-by-feature tasks, reusable shared primitives first, strict route/API mapping.
- [Complex nested rules version forms] -> Mitigation: phased form sections with repeatable field arrays and preview summaries before submit.
- [Preset references may be stale (inactive players/rules)] -> Mitigation: validate and sanitize preset values before prefill; fallback to defaults with non-blocking warning.
- [Antd + Tailwind styling drift] -> Mitigation: explicit division of responsibility and token-first theming.
- [Potential over-invalidation with queries] -> Mitigation: centralized query key factory and documented invalidation targets per mutation.
- [Mobile speed concerns on low-end devices] -> Mitigation: paginated lists, memoized item renderers, and avoiding heavy runtime schema parsing for all responses.

## Migration Plan

1. Bootstrap web app and shared providers (router, query, antd theme, global styles).
2. Implement integration foundation and shared UI states.
3. Implement dashboard + players.
4. Implement reusable quick entry + match detail.
5. Implement Match Stakes pages.
6. Implement Group Fund pages + manual transactions.
7. Implement Rules management flows.
8. Run responsive/a11y/polish pass and verify against API guide acceptance criteria.

Rollback:
- Frontend-only rollout; if issues arise, disable web deployment while backend remains unaffected.

## Open Questions

- Should void-match action be restricted in UI by role (if role/permission APIs will be introduced later)?
- Should group-fund manual transactions appear as a third tab inside Group Fund page or as a secondary drawer flow by default?
- Should timezone override UI setting be added now or deferred to a later preference feature?
