# Match Stakes Page Deep Implementation Overview

## 1) Page identity

### Route and entry
- Route path: `/match-stakes`
- Router binding: `apps/web/src/router/router.tsx` -> `MatchStakesRoute`
- Route component: `apps/web/src/pages/MatchStakesRoute.tsx`
- Feature page component: `apps/web/src/features/match-stakes/MatchStakesPage.tsx`

### Navigation placement
- App shell navigation places **Match Stakes** as a top-level item.
- Root route `/` redirects to `/match-stakes`.

### Domain/module purpose
- This page is the operational screen for debt-period lifecycle and debt history in the **MATCH_STAKES** module:
1. View period state and debt.
2. Browse history across one period or all periods.
3. Open match detail from history.
4. Run period-level operations (admin-only): create period, close period, add history event.

### USER vs ADMIN
- USER (`role: "USER"`): read-focused access to all views and history navigation.
- ADMIN (`role: "ADMIN"`): all USER capabilities plus write actions.
- `/match-stakes` itself is not route-protected; write actions are guarded in UI and HTTP client.

---

## 2) High-level purpose and boundaries

`/match-stakes` is not a "create match form" page. It is a **debt operations and history page** centered around debt periods:
- Current debt visibility.
- Debt period lifecycle (open/close/create).
- Period/all-period timeline and unified history viewing.
- Operational history events (advance/note, and UI supports debt settlement event type).

How it differs from nearby pages:

| Page | Primary job | What it is not |
|---|---|---|
| `/match-stakes` | Debt period + debt history operations | Not full match creation form |
| `/match-stakes/new` | Create a new MATCH_STAKES match | Not period lifecycle/history dashboard |
| `/matches/:matchId` | Standalone match detail/void flow | Not period-level history browser |
| `/group-fund/fund` | Group fund obligations/fund transactions | Different module and fund accounting model |

---

## 3) Real layout structure (top to bottom)

The page renders inside `PageContainer` with this order:

### A. Breadcrumb + header
- `AppBreadcrumb`: `Match Stakes`
- `PageHeader` title: `Match Stakes`
- Header action area (admin-only): `Create match`, `Add history event`, `Close period` (conditional), `New debt period` (conditional).

### B. Global toolbar row
- Eye button: toggle Debt Period section visibility (`showDebtPeriodDetail`).
- Filter button: open period filter modal.
- Reset filters button: resets selected period + history view mode to defaults.

### C. Debt Period section (optional block)
- Shown only when `showDebtPeriodDetail = true`.
- Displays metadata for active period (period no, opened time, total matches, status, closed time).
- Handles:
1. Loading skeleton.
2. Error states (with retry).
3. Empty period state.
4. "No open period" info alert and optional admin action to create a period.

### D. Current Debt section (conditional)
- Hidden when selected filter period is explicitly `CLOSED`.
- Shows player debt cards with segmented view mode:
1. `match-only` (default)
2. `after-advance`
- Uses active timeline data and per-player derived values.
- Handles no period, loading, error, empty players.

### E. History section (always rendered)
- Segmented history mode:
1. `minimal` (default)
2. `detail`
- Two rendering modes:
1. **Single selected period mode** (`selectedPeriodId` exists): one history feed plus init snapshot panel.
2. **All-period mode** (`selectedPeriodId` empty): grouped period cards with infinite loading sentinel.
- Unified-history API unavailability is surfaced with info alerts; page falls back to merged timeline + settlement data.

### F. Overlay and modals
- `MatchDetailOverlay` (drawer) for clicked match.
- `MatchStakesHistoryEventModal`.
- AntD modals:
1. Filter Debt Period
2. Record settlement
3. Create new debt period
4. Close period

---

## 4) Action buttons and user actions

## Top/header actions

| Action | Location | USER | ADMIN | Disabled rules | Result | API/mutation | Refresh side effects |
|---|---|---|---|---|---|---|---|
| Create match | PageHeader | Hidden | Visible | None | Navigate to `/match-stakes/new` | No API here | Create page later calls `POST /matches`, then invalidates match-stakes/dashboard/preset and returns |
| Add history event | PageHeader | Hidden | Visible | None | Open `MatchStakesHistoryEventModal` | On submit: create history event mutation | Invalidates `["match-stakes"]`, selected period detail/timeline/history keys (if periodId), and dashboard overview |
| Close period | PageHeader (only when open period exists) | Hidden | Visible | Disabled unless current open period has `totalMatches >= 1` | Open close modal | On confirm: `POST /match-stakes/debt-periods/{periodId}/close` | Invalidates all match-stakes keys and specific period detail |
| New debt period | PageHeader (only when no open period) | Hidden | Visible | None | Open create-period modal | On confirm: `POST /match-stakes/debt-periods` | Invalidates all match-stakes keys |

## Toolbar actions

| Action | Location | USER | ADMIN | Disabled rules | Result |
|---|---|---|---|---|---|
| Toggle Debt Period detail | Toolbar eye button | Visible | Visible | None | Shows/hides Debt Period section |
| Filter Debt Period | Toolbar filter button | Visible | Visible | None | Opens filter modal |
| Reset filters | Toolbar | Visible | Visible | Disabled if no non-default filter (`selectedPeriodId` empty and history mode already minimal) | Resets to all periods + minimal history mode |

## History interactions

| Action | Location | USER | ADMIN | Disabled rules | Result |
|---|---|---|---|---|---|
| Open match detail | History item (only MATCH items) | Visible | Visible | Non-match history items are non-clickable | Opens `MatchDetailOverlay` with mapped participant ledger context |
| Infinite load older periods | All-period history sentinel | Visible | Visible | Only active in all-period mode and when `hasNextPage` | Fetch next page of period groups |

## Filter modal actions

| Action | USER | ADMIN | Behavior |
|---|---|---|---|
| Select period | Yes | Yes | Sets `selectedPeriodId`; selecting special `__ALL_PERIODS__` returns to all-period mode |
| Reset to default | Yes | Yes | Same behavior as global reset |

## History event modal actions

| Action | USER | ADMIN | Validation/Rules | API |
|---|---|---|---|---|
| Save event | Hidden (modal open is `open && canWrite`) | Visible | Note required; Advance requires player + amount > 0; Advance/Debt Settlement require amount > 0 | Create history event mutation (v2 endpoint preferred, legacy fallback chain) |

## Settlement modal actions

| Action | USER | ADMIN | Notes |
|---|---|---|---|
| Record settlement modal submit | Hidden (modal open is `open && canWrite`) | Implemented but currently no visible trigger on page | Form + submit logic exists; mutation calls settlement endpoint |
| Add/remove settlement line | N/A | In modal | Validates payer/receiver/amount |

## Close period modal actions

| Action | USER | ADMIN | Validation/Rules | API |
|---|---|---|---|---|
| Close period submit | Hidden | Visible | Must have open period id, at least 1 match, and confirmation text exactly `Close Period {periodNo}` | `POST /match-stakes/debt-periods/{periodId}/close` |
| Set all = 0 | Hidden | Visible | Sets all closing-balance draft rows to 0 | No API (local state only) |

## Create period modal actions

| Action | USER | ADMIN | Validation/Rules | API |
|---|---|---|---|---|
| Create period submit | Hidden | Visible | Title/note optional; trimmed | `POST /match-stakes/debt-periods` |

---

## 5) Full user flows

### Flow A: Viewing the current open period
1. Entry: load `/match-stakes`.
2. Page queries current period and all periods; computes `openPeriodId`.
3. Active period id resolution: `selectedPeriodId ?? openPeriodId ?? allPeriods[0]?.id`.
4. If Debt Period detail section is toggled on, metadata cards show period fields and status.
5. If no open period, info alert appears and admin can open create-period modal.
6. Error paths show `ErrorState` with retry callbacks.

API/query path:
- `GET /match-stakes/debt-periods/current`
- `GET /match-stakes/debt-periods` (all pages via helper)
- `GET /match-stakes/debt-periods/{activePeriodId}/timeline` (with fallback logic in hook)

### Flow B: Switching/filtering a debt period
1. Entry: click filter button.
2. Modal loads period options (plus "All periods - Full history").
3. Selecting one period sets `selectedPeriodId`.
4. Selecting all-period option clears `selectedPeriodId`.
5. Reset action clears selected period and restores history mode to `minimal`.

Result:
- Selected-period mode shows one period history and init block.
- All-period mode shows grouped period cards with infinite loading.

### Flow C: Reading Current Debt
1. Current Debt card loads from active timeline query.
2. User toggles segmented mode:
1. `match-only`: display derived debt from timeline rows (init + match progression).
2. `after-advance`: display server `outstandingNetVnd` and accrued/settled breakdown.
3. Players sorted by positive debt-receive first, then negative, then zero.
4. If selected period is closed, Current Debt section is hidden entirely.

### Flow D: Browsing History
1. History section always visible.
2. User can switch `minimal/detail` view mode (persisted in localStorage).
3. In selected-period mode:
1. Timeline + detail + (optional) unified history are combined.
2. If unified history endpoint unavailable (`null`), info alert indicates fallback merge mode.
4. In all-period mode:
1. Period groups loaded in pages of 3 periods.
2. Each period card renders feed items.
3. Intersection observer fetches older pages when sentinel enters viewport.

### Flow E: Opening Match Detail from history
1. Entry: click a clickable MATCH item in history feed.
2. Page maps selected match row data into `MatchStakesDetailContext` (placement, debt before/after, net).
3. `MatchDetailOverlay` opens and calls `useMatchDetail(matchId)`.
4. Overlay uses Drawer:
1. Mobile width `100%`.
2. Desktop width `680`.
5. Close action clears `selectedMatchId` and context.

API:
- `GET /matches/{matchId}`

### Flow F: Creating a new match from this page
1. Entry: click `Create match`.
2. Navigation to `/match-stakes/new` (admin-only route).
3. Create page handles preview + create.
4. Create page submits `POST /matches` with module `MATCH_STAKES`.
5. On success, create page invalidates relevant queries and navigates back to `/match-stakes`.

### Flow G: Recording settlement
1. Settlement modal implementation exists on this page with full validation and submit mutation.
2. Submit builds `CreateDebtSettlementRequest` with lines and optional postedAt/note.
3. Mutation endpoint: `POST /match-stakes/debt-periods/{periodId}/settlements`.
4. Success closes modal and shows success toast; errors map to `FormApiError`.
5. Current code note: there is no visible button wired to `openSettlementModal`, so this flow is not currently user-reachable from visible UI.

### Flow H: Creating a new debt period
1. Entry: `New debt period` header button (shown only when no open period) or empty-state/alert action.
2. Admin opens modal, inputs optional title/note.
3. Submit mutation `POST /match-stakes/debt-periods`.
4. On success:
1. Toast `Debt period created.`
2. Modal closes.
3. Match-stakes query namespace invalidated.

### Flow I: Closing a period
1. Entry: `Close period` button (admin + open period + at least one match).
2. Modal initializes closing-balance draft for current-period players.
3. User may edit per-player `netVnd` carry-over and add close note.
4. User must type exact confirmation text: `Close Period {periodNo}`.
5. Submit mutation `POST /match-stakes/debt-periods/{periodId}/close`.
6. Success closes modal and refreshes period/current/history data through invalidation.

### Flow J: History-event flow
1. Entry: `Add history event`.
2. Modal fields:
1. Debt period
2. Event type (`ADVANCE`, `DEBT_SETTLEMENT`, `NOTE`)
3. Optional player
4. Amount (for advance/debt settlement)
5. Impact mode
6. Note/reason
3. Validation by zod schema:
1. Note required.
2. Advance requires player.
3. Advance and debt settlement require amount > 0.
4. Submit calls create history event mutation.
5. Success closes modal + invalidates history/period/timeline/dashboard queries.

### Flow K: History-event reset/void flow
- No event-reset or event-void action is implemented on `/match-stakes` in current source.

---

## 6) Data loading and API map

### Query/data map used by `MatchStakesPage`

| Hook / query | Endpoint(s) | When called | UI dependency | Loading/error/empty behavior |
|---|---|---|---|---|
| `useCurrentDebtPeriod()` | `GET /match-stakes/debt-periods/current` | Always on page load | Open-period existence, close modal target, alerts | `DEBT_PERIOD_NOT_FOUND` is converted to `null`; other errors show `ErrorState` in Debt Period section |
| `useAllDebtPeriods()` | `GET /match-stakes/debt-periods` across all pages (size 100) | Always on page load | Filter options, selected period validity, default period fallback | Empty -> empty states; error -> retry state |
| `useDebtPeriodTimeline(activePeriodId)` | Prefer `GET /match-stakes/debt-periods/{id}/timeline?includeInitialSnapshot=true`; fallback: `GET /match-stakes/debt-periods/{id}` + `GET /match-stakes/matches?periodId=...` all pages | For active period resolution | Current Debt section + Debt Period metadata | Handles loading/error; fallback computed timeline if timeline endpoint unavailable |
| `useDebtPeriodTimeline(selectedPeriodId)` | Same as above | Only when selected period exists | Selected-period history and init block | Loading/error in history panel |
| `useDebtPeriodDetail(selectedPeriodId)` | `GET /match-stakes/debt-periods/{id}` | Selected-period mode | Settlement lines + period detail fallback mapping | Loading/error in selected-period history mode |
| `useMatchStakesHistory({periodId,page:1,pageSize:200}, enabled)` | Prefer `GET /match-stakes/debt-periods/{periodId}/history`, fallback `GET /match-stakes/history` | Selected-period mode only | Selected-period unified feed | `null` indicates endpoint unavailable; page shows info alert and local fallback merge |
| `useInfiniteDebtPeriodHistory(!selectedPeriodId)` | `GET /match-stakes/debt-periods?page=n&pageSize=3` + per-period timeline fetch | All-period mode | Grouped history cards + infinite scroll | Loading skeleton, retry error, sentinel fetch |
| `useQueries` period history per group | Same history endpoint chain as above | All-period mode, for each loaded period | Per-period feed items | `null` payload triggers per-period fallback alert |
| `useQueries` period detail per group | `GET /match-stakes/debt-periods/{id}` | All-period mode, per loaded period | Settlement enrichment for feeds | Used in fallback merge mapping |
| `useActivePlayers()` | `GET /players?isActive=true&page=1&pageSize=100` | Always | History-event player selector | Standard loading via modal interaction (no blocking card-level skeleton) |
| `MatchDetailOverlay -> useMatchDetail(matchId)` | `GET /matches/{matchId}` | On overlay open | Match detail drawer content | Drawer shows page loading / error state |

### Mutation/API map used by `MatchStakesPage`

| Mutation | Endpoint | Trigger | Success behavior | Invalidation/refetch |
|---|---|---|---|---|
| `useCreateDebtPeriod` | `POST /match-stakes/debt-periods` | Create period modal submit | Toast + close modal | Invalidate all `["match-stakes"]` |
| `useCloseDebtPeriod` | `POST /match-stakes/debt-periods/{periodId}/close` | Close period modal submit | Toast + close modal | Invalidate all `["match-stakes"]` + `periodDetail(periodId)` |
| `useCreateDebtSettlement` | `POST /match-stakes/debt-periods/{periodId}/settlements` | Settlement modal submit (no visible trigger currently) | Toast + close modal | Invalidate all `["match-stakes"]` + `periodDetail(periodId)` |
| `useCreateMatchStakesHistoryEvent` | Preferred `POST /match-stakes/history-events` (v2 payload for ADVANCE/NOTE); fallback legacy `POST /match-stakes/debt-periods/{periodId}/history` or `POST /match-stakes/history` | History event modal submit | Toast + close modal | Invalidate `["match-stakes"]`; if period provided also invalidate detail/timeline/periodHistory; invalidate dashboard overview |

### Create-match action API note (triggered after navigation)
- `/match-stakes` "Create match" button navigates to `/match-stakes/new`.
- On that page, create mutation calls `POST /matches`.
- On success, it invalidates match-stakes and dashboard-related caches then navigates back.

---

## 7) Component map

Approximate tree from `MatchStakesPage`:

1. `PageContainer`
2. `AppBreadcrumb`
3. `PageHeader` (admin action buttons)
4. Toolbar row (`Button` + `Tooltip`)
5. Optional `SectionCard("Debt Period")`
6. Conditional `SectionCard("Current Debt")`
7. `SectionCard("History")`
1. Selected-period branch: `MatchStakesHistoryFeed` + init block
2. All-period branch: repeated period cards + `MatchStakesHistoryFeed` + load-more sentinel
8. `MatchDetailOverlay`
9. `MatchStakesHistoryEventModal`
10. AntD `Modal`: Filter Debt Period
11. AntD `Modal`: Record settlement
12. AntD `Modal`: Create new debt period
13. AntD `Modal`: Close period

Key child/related components:
- `MatchStakesHistoryFeed` (`apps/web/src/features/match-stakes/components/MatchStakesHistoryFeed.tsx`)
- `MatchStakesHistoryEventModal` (`.../components/MatchStakesHistoryEventModal.tsx`)
- `MatchDetailOverlay` -> `MatchDetailView` (`apps/web/src/features/matches/*`)

---

## 8) State management and persistence

### React Query state used directly on page
- Current/open period: `currentPeriodQuery`
- All periods list: `allPeriodsQuery`
- Active and selected timelines: `activePeriodTimelineQuery`, `selectedPeriodTimelineQuery`
- Selected period detail: `selectedPeriodDetailQuery`
- Selected period history: `selectedPeriodHistoryQuery`
- All-period infinite history: `allHistoryPeriodsQuery`
- Per-period dynamic queries in all-period mode (`useQueries`): server history + period detail maps
- Active players for history modal: `playersQuery`
- Mutations: create period, close period, settlement, history event

### Local component state (page)
- Selection and view:
1. `selectedPeriodId`
2. `showDebtPeriodDetail`
3. `periodFilterOpen`
4. `currentDebtViewMode`
5. `historyViewMode`
- Overlay:
1. `selectedMatchId`
2. `selectedMatchContext`
- History-event modal:
1. `historyEventOpen`
2. `historyEventApiError`
- Settlement modal:
1. `settlementOpen`
2. `settlementApiError`
3. `settlementPostedAt`
4. `settlementNote`
5. `settlementLines`
6. `settlementLineSeed`
- Create period modal:
1. `createPeriodOpen`
2. `createPeriodApiError`
3. `createPeriodTitle`
4. `createPeriodNote`
- Close period modal:
1. `closePeriodOpen`
2. `closePeriodApiError`
3. `closePeriodNote`
4. `closePeriodConfirmText`
5. `closeBalanceDraft`

### Derived/computed state highlights
- `activePeriodId = selectedPeriodId ?? openPeriodId ?? firstPeriodId`
- `hideCurrentDebtSection = selectedPeriodId && selected period is CLOSED`
- `canOpenClosePeriod = admin && open period exists && totalMatches >= 1`
- `canConfirmClosePeriod = exact confirmation text match`
- History feed items are merged/mapped from unified history or fallback timeline/settlement sources.

### Persistence/localStorage
- `tft2.matchStakes.currentDebtViewMode` (default `match-only`)
- `tft2.match-stakes.history.view-mode` (default `minimal`)

Also in related overlay view (`MatchDetailView`, opened from this page):
- `tft2.match-detail.participant.view-mode`
- `tft2.match-detail.rule-details.open`

### URL/search params
- `/match-stakes` page itself does not use URL search params for filters.

---

## 9) Permission and guard behavior

### Role model
- `canWrite()` returns true only when role is `ADMIN`.

### Visibility and guards
- Header write actions are rendered only when `canWriteActions` is true.
- Write handlers also call `guardWritePermission(canWriteActions)` before opening/submitting.
- Modals that perform writes are rendered with `open={... && canWriteActions}`.

### Route-level protection related to this area
- `/match-stakes` is accessible without admin route guard.
- `/match-stakes/new` is wrapped in `RequireAdminRoute` with fallback to `/match-stakes`.

### Network-level protection
- HTTP client request interceptor blocks non-admin write methods (POST/PUT/PATCH/DELETE) and returns `AUTH_FORBIDDEN`.

---

## 10) Business rules and constraints observed in code

1. Close period requires at least one match (`totalMatches >= 1`).
2. Close period submit requires exact confirmation string: `Close Period {periodNo}`.
3. Close period payload always includes `closingBalances` from draft rows (default initialized to zero).
4. Settlement line validity:
1. Payer required.
2. Receiver required.
3. Payer and receiver must differ.
4. Amount must be > 0.
5. History event schema:
1. Note required.
2. `ADVANCE` requires player.
3. `ADVANCE` and `DEBT_SETTLEMENT` require amount > 0.
6. Current debt display supports two semantics:
1. Match-only derived progression.
2. After-advance from summary outstanding fields.
7. If selected period is closed, Current Debt section is hidden.
8. Unified history endpoint is optional. `null` responses (404/405/501) trigger local fallback composition.
9. Timeline endpoint is optional. Missing/unavailable timeline falls back to period detail + all period matches.
10. All-period history loads lazily with infinite scroll and period page size = 3.

---

## 11) Edge cases and implementation notes

1. No current open period:
1. Page still works in historical read mode.
2. Admin can create new period from alerts/empty states.
2. No debt periods at all:
1. Empty states shown in Debt Period/Current Debt/History.
3. Selected period removed from list:
1. Effect resets `selectedPeriodId` to undefined.
4. Unified history API unavailable per period:
1. Page shows info alert and synthesizes feed from timeline + settlements.
5. Timeline API unavailable:
1. Hook builds fallback timeline from `/periodDetail` + `/matches`.
6. Settlement modal reachability:
1. Fully implemented modal/mutation exists.
2. No visible button currently calls `openSettlementModal`, so this path is effectively unreachable from normal UI.
7. `renderMobilePeriodSequence` helper exists but is not currently used in render tree.
8. Match detail drawer uses `destroyOnHidden`; content unmounts on close.
9. All-period mode can trigger many background queries (timeline + history + detail per loaded period), which is important for performance reasoning.

---

## 12) File reference appendix (inspected)

### Core route/page
- `apps/web/src/router/router.tsx`  
Why: route path mapping, index redirect, admin guard for create route.
- `apps/web/src/pages/MatchStakesRoute.tsx`  
Why: route wrapper entry to feature page.
- `apps/web/src/features/match-stakes/MatchStakesPage.tsx`  
Why: main page layout, state, actions, modals, flow orchestration.

### Match-stakes data/hooks/API
- `apps/web/src/features/match-stakes/hooks.ts`  
Why: query/mutation definitions, timeline and history fallback logic, invalidation.
- `apps/web/src/api/matchStakesApi.ts`  
Why: concrete endpoint map, optional endpoint compatibility, history-event posting strategy.
- `apps/web/src/api/queryKeys.ts`  
Why: query key namespaces and per-resource keys.
- `apps/web/src/types/api.ts`  
Why: DTO/query/mutation payload shapes and status/event type contracts.

### History/feed/modal components
- `apps/web/src/features/match-stakes/components/MatchStakesHistoryFeed.tsx`  
Why: history item rendering rules, clickability, minimal/detail behaviors.
- `apps/web/src/features/match-stakes/components/MatchStakesHistoryEventModal.tsx`  
Why: event form behavior and submission payload mapping.
- `apps/web/src/features/match-stakes/schemas.ts`  
Why: zod validation rules for history event creation.

### Match detail overlay path from this page
- `apps/web/src/features/matches/MatchDetailOverlay.tsx`  
Why: drawer behavior and match detail loading states.
- `apps/web/src/features/matches/MatchDetailView.tsx`  
Why: detail rendering, extra localStorage state, participant debt display.
- `apps/web/src/features/matches/hooks.ts` and `apps/web/src/api/matchesApi.ts`  
Why: `/matches/{id}` query and match APIs.

### Permissions/navigation/session context
- `apps/web/src/features/auth/AuthContext.tsx`  
Why: `canWrite` role behavior.
- `apps/web/src/features/auth/permissions.ts`  
Why: `guardWritePermission`.
- `apps/web/src/router/ProtectedRoute.tsx`  
Why: admin route guard for `/match-stakes/new`.
- `apps/web/src/components/layout/AppShellLayout.tsx`  
Why: app navigation placement of Match Stakes.

### Supporting behavior
- `apps/web/src/features/players/hooks.ts` and `apps/web/src/api/playersApi.ts`  
Why: active players source for history-event modal.
- `apps/web/src/api/httpClient.ts`  
Why: write-method admin enforcement and error normalization.
- `apps/web/src/features/match-stakes/MatchStakesCreatePage.tsx` and `apps/web/src/lib/invalidation.ts`  
Why: clarify create-match flow after navigating from `/match-stakes`.
