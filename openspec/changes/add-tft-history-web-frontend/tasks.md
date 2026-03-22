## 1. Bootstrap Web App

- [x] 1.1 Create `apps/web` Vite React TypeScript app scaffold (or equivalent frontend app folder if repository layout requires)
- [x] 1.2 Install core dependencies: `react-router-dom`, `antd`, `@tanstack/react-query`, `react-hook-form`, `zod`, `@hookform/resolvers`, `dayjs`
- [x] 1.3 Install supporting dependencies: `axios`, `clsx`, `tailwind-merge`, and optional `react-error-boundary`
- [x] 1.4 Configure TypeScript path aliases and environment variable loading for API base URL

## 2. Styling and Theme Foundation

- [x] 2.1 Configure Tailwind CSS with mobile-first breakpoints and shared spacing scale
- [x] 2.2 Configure Ant Design `ConfigProvider` theme tokens and connect to app root
- [x] 2.3 Add global CSS variables for brand colors and typography tokens used by Tailwind utilities
- [x] 2.4 Implement style-convention guardrails to prevent Tailwind vs Antd overrides conflicts

## 3. App Shell and Routing

- [x] 3.1 Implement app shell layout with desktop sidebar and mobile drawer navigation
- [x] 3.2 Define route tree for dashboard, modules, rules flows, players, match detail, and not-found
- [x] 3.3 Add route-level loading and error boundary wrappers
- [x] 3.4 Implement not-found page and default redirect from `/` to `/dashboard`

## 4. API and Query Infrastructure

- [x] 4.1 Implement typed axios client with `/api/v1` base URL and envelope unwrapping
- [x] 4.2 Implement shared API error normalization and error-code helper utilities
- [x] 4.3 Create feature API modules for dashboard, players, rules, matches, match stakes, group fund, and presets
- [x] 4.4 Create centralized TanStack Query key factory and shared query client defaults
- [x] 4.5 Wire query provider and developer-friendly query retry/stale-time defaults

## 5. Shared UI and Utility Layer

- [x] 5.1 Build shared `PageLoading`, `EmptyState`, and `ErrorState` components
- [x] 5.2 Build reusable confirm modal/drawer pattern for destructive actions
- [x] 5.3 Implement formatting utilities for VND, date-time, relative time, and enum/status labels
- [x] 5.4 Add explicit timezone formatting behavior with browser-zone default and env override fallback

## 6. Dashboard Module

- [x] 6.1 Implement dashboard overview query hook for `GET /api/v1/dashboard/overview`
- [x] 6.2 Build dashboard page cards for player count, total matches, Match Stakes summary, and Group Fund summary
- [x] 6.3 Add recent matches section with entry actions to open match detail
- [x] 6.4 Add loading, empty, and retry states for dashboard page

## 7. Player Management Module

- [x] 7.1 Implement player list page with search, active-status filter, and pagination
- [x] 7.2 Build create player form with RHF + Zod validation
- [x] 7.3 Build edit player form with active-state toggle and update mutation
- [x] 7.4 Implement deactivate/reactivate flow with confirmation and correct query invalidation
- [x] 7.5 Map backend conflict/validation errors to field or form-level messages

## 8. Match Detail and Shared Match Utilities

- [x] 8.1 Implement match detail query hook using `GET /api/v1/matches/:matchId`
- [x] 8.2 Build reusable match detail presenter for participants, settlement lines, and metadata
- [x] 8.3 Implement module-page detail drawer/modal wrapper with mobile-first behavior
- [x] 8.4 Implement standalone `/matches/:matchId` route using same detail presenter
- [x] 8.5 Add optional match void action flow with confirmation and invalidation strategy

## 9. Reusable Quick Match Entry

- [x] 9.1 Implement reusable quick-entry component scaffold shared by Match Stakes and Group Fund
- [x] 9.2 Integrate recent preset preload via `GET /api/v1/recent-match-presets/:module`
- [x] 9.3 Integrate default rule set fallback via `GET /api/v1/rule-sets/default/by-module/:module`
- [x] 9.4 Build participant selector and placement editor optimized for 3 or 4 players
- [x] 9.5 Enforce Zod validation for unique players, unique placements, and placement range `1..8`
- [x] 9.6 Submit matches via `POST /api/v1/matches` and display settlement confirmation result
- [x] 9.7 Persist updated presets via `PUT /api/v1/recent-match-presets/:module` after successful creation

## 10. Match Stakes Module

- [x] 10.1 Implement Match Stakes summary section using `GET /api/v1/match-stakes/summary`
- [x] 10.2 Implement bottom tab area with debt movement history and match history
- [x] 10.3 Build mobile-first debt movement feed from `GET /api/v1/match-stakes/ledger`
- [x] 10.4 Build match history list from `GET /api/v1/match-stakes/matches`
- [x] 10.5 Connect history item click actions to match detail drawer/modal
- [x] 10.6 Add sticky `+` quick action and connect to reusable quick-entry flow (module preset `MATCH_STAKES`)

## 11. Group Fund Module

- [x] 11.1 Implement Group Fund summary section using `GET /api/v1/group-fund/summary`
- [x] 11.2 Implement bottom tab area with fund ledger history and group fund match history
- [x] 11.3 Build fund ledger feed from `GET /api/v1/group-fund/ledger` with movement type visualization
- [x] 11.4 Build group fund match history list from `GET /api/v1/group-fund/matches`
- [x] 11.5 Implement manual transaction create/list UI with `POST/GET /api/v1/group-fund/transactions`
- [x] 11.6 Add sticky `+` quick action and connect to reusable quick-entry flow (module preset `GROUP_FUND`)

## 12. Rules Management Module

- [x] 12.1 Implement rule set list page with module/status/default filters and pagination
- [x] 12.2 Implement rule set create and metadata edit forms (`POST` and `PATCH /api/v1/rule-sets`)
- [x] 12.3 Implement rule set detail page with versions overview from `GET /api/v1/rule-sets/:ruleSetId`
- [x] 12.4 Implement rule set version create form with nested rules, conditions, and actions arrays
- [x] 12.5 Implement rule set version detail page from `GET /api/v1/rule-sets/:ruleSetId/versions/:versionId`
- [x] 12.6 Implement version metadata edit form via `PATCH /api/v1/rule-sets/:ruleSetId/versions/:versionId`
- [x] 12.7 Add validation and UX helpers for nested structures (collapsible sections, summary chips, inline errors)

## 13. Quality, Responsiveness, and Accessibility

- [x] 13.1 Run responsive pass across key breakpoints (mobile, tablet, desktop) for all main screens
- [x] 13.2 Ensure tap targets, sticky actions, and drawer/modal behavior are mobile-friendly
- [x] 13.3 Add accessibility basics: keyboard navigation, focus states, aria labels for icon-only controls
- [x] 13.4 Verify empty/loading/error states for every route-level and tab-level data surface

## 14. Verification and Handoff

- [x] 14.1 Add unit tests for critical formatters and validation schemas
- [x] 14.2 Add integration-level tests for quick-entry submit validation and preset update flow
- [x] 14.3 Perform endpoint-to-screen mapping review against `api_usage_guide_en.md`
- [x] 14.4 Document local run instructions and required environment variables for backend integration

