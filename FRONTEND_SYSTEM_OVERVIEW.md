# FRONTEND SYSTEM OVERVIEW

## Muc luc
- [1. Tong quan frontend](#1-tong-quan-frontend)
- [2. Tong quan domain/module cua TFT](#2-tong-quan-domainmodule-cua-tft)
- [3. So do dieu huong man hinh](#3-so-do-dieu-huong-man-hinh)
- [4. Phan tich tung page](#4-phan-tich-tung-page)
- [5. Component dung chung quan trong](#5-component-dung-chung-quan-trong)
- [6. Routing va permission](#6-routing-va-permission)
- [7. State management va data flow](#7-state-management-va-data-flow)
- [8. Mapping page -> API](#8-mapping-page---api)
- [9. Business rules quan trong toan he thong](#9-business-rules-quan-trong-toan-he-thong)
- [10. Nhung diem chua xac dinh chac chan tu source code](#10-nhung-diem-chua-xac-dinh-chac-chan-tu-source-code)

## 1. Tong quan frontend
- Tech stack:
  - React 19 + TypeScript + Vite.
  - UI: Ant Design + Tailwind CSS.
  - Data fetching/cache: TanStack React Query.
  - Form/validation: React Hook Form + Zod.
  - HTTP: Axios (custom interceptor trong `src/api/httpClient.ts`).
  - Router: `createBrowserRouter` cua `react-router-dom`.
- Cau truc source thuc te (`apps/web/src`):
  - Co: `pages`, `router`, `features`, `components`, `hooks`, `api`, `lib`, `types`.
  - Khong co thu muc rieng: `routes`, `modules`, `layouts`, `services`, `store`, `context`, `utils`, `constants`.
  - Vai tro thay the:
    - `router` thay cho `routes`.
    - `lib` dong vai tro `utils/constants`.
    - `features/auth/AuthContext.tsx` thay cho `src/context`.
- Kien truc tong the:
  - `pages/*` la route adapter, render truc tiep `features/*Page`.
  - Logic nghiep vu nam trong `features/*`.
  - API layer nam trong `api/*Api.ts`, `queryKeys.ts`, `queryClient.ts`.
  - Auth/session xu ly trong `features/auth/*` + interceptor cua `httpClient`.
- Frontend giao tiep backend:
  - Base URL duoc normalize ve `/api/v1`.
  - Response chuan `ApiSuccessResponse<T>` va meta phan trang.
  - Write methods (`POST/PUT/PATCH/DELETE`) bi chan client-side neu khong phai ADMIN.
  - Token duoc gan vao header Authorization tu localStorage.
- Auth/routing/state/API:
  - App boot: `main.tsx` boc `QueryClientProvider` + `AuthProvider` + `RouterProvider`.
  - `AuthProvider` bootstrap session USER tu dong qua `/auth/login`, ADMIN login rieng bang access code.
  - Routing dung 1 shell layout (`AppShellLayout`) cho phan lon route.
  - State management la React Query + local state + localStorage (khong dung Redux/Zustand).

## 2. Tong quan domain/module cua TFT
Module thuc su co trong frontend:

- Authentication / Session
  - Login admin bang access code.
  - USER session tu bootstrap/fallback de doc du lieu.
- Settings
  - Doi cach hien thi tien (`vnd`, `dong`, `basic`).
  - Xem role hien tai, login admin/switch ve user mode.
- Dashboard
  - Tong quan players, so match, top performers, recent matches.
- Players
  - CRUD hien co: list/search/filter/paging, create, edit, deactivate/reactivate.
- Rules
  - List/filter rule sets.
  - Create/edit theo flow module:
    - Match Stakes flow (builder-based).
    - Group Fund flow (business flow map thanh raw rules).
  - Detail rule set + detail version + edit metadata version.
- Match Stakes
  - Man hinh nghiep vu quan ly debt period, current debt, lich su tich luy theo match.
  - Action: create debt period, record settlement, close period.
  - Tao match moi voi preview + manual adjust.
- Group Fund
  - Man hinh nghiep vu quy: balance, obligations, transactions, lich su.
  - Tao match moi voi preview anh huong fund truoc/sau.
- Match Detail
  - Overlay dung lai o nhieu page + trang standalone `/matches/:matchId`.
  - Co void match (admin).

Quan he giua modules:
- `rules` cap ruleSet/ruleVersion cho create match Match Stakes va Group Fund.
- `players` cap danh sach active players cho create match + modal payment/withdraw.
- `matches` la trung tam preview/create/detail/void, sau mutation invalidate dashboard + module cache.
- `group-fund` summary duoc dung them trong `MatchDetailView` de dung snapshot truoc/sau match GROUP_FUND.
- `match-stakes` timeline/debt enrich context khi mo match detail tu lich su no.

## 3. So do dieu huong man hinh

Route tree tong the:

```text
/login                                   (public, khong dung AppShellLayout)
/
  └─ AppShellLayout
     ├─ (index) -> /match-stakes
     ├─ /dashboard
     ├─ /match-stakes
     ├─ /match-stakes/new                (RequireAdminRoute)
     ├─ /group-fund -> /group-fund/fund
     ├─ /group-fund/fund
     ├─ /group-fund/new                  (RequireAdminRoute)
     ├─ /rules
     ├─ /rules/new                       (RequireAdminRoute)
     ├─ /rules/:ruleSetId
     ├─ /rules/:ruleSetId/edit           (RequireAdminRoute)
     ├─ /rules/:ruleSetId/versions/new   (RequireAdminRoute)
     ├─ /rules/:ruleSetId/versions/:versionId
     ├─ /rules/:ruleSetId/versions/:versionId/edit (RequireAdminRoute)
     ├─ /players
     ├─ /players/new                     (RequireAdminRoute)
     ├─ /players/:playerId/edit          (RequireAdminRoute)
     ├─ /matches/:matchId
     ├─ /settings
     ├─ /not-found
     └─ * -> /not-found
```

Public/protected:
- Public read routes: gan nhu toan bo route doc du lieu.
- Protected write routes: cac route create/edit duoc boc `RequireAdminRoute`.
- Ngoai route guard, write API con bi chan o interceptor neu role != ADMIN.

Dieu huong chinh:
- Mac dinh vao `/match-stakes`.
- Sidebar hien tai co: Match Stakes, Rules, Players, Settings.
- Group Fund va Dashboard co route rieng nhung khong nam trong sidebar hien tai.
- Tu dashboard/match-stakes/group-fund co the mo match detail overlay.

## 4. Phan tich tung page

### Login Page
- Route: `/login`
- Module: Authentication
- Layout: standalone (khong qua `AppShellLayout`)
- Muc dich: nang quyen USER -> ADMIN bang access code.
- Nguoi dung: user can thao tac write.
- UI structure:
  - Card trung tam, header thuong hieu.
  - Form 1 field access code.
  - Form error alert.
- Thanh phan chinh: `LoginPage`, `FormApiError`.
- API mount: khong.
- Action: submit access code -> login admin.
- Disable/hide: nut login disabled neu code rong; neu da ADMIN thi auto redirect.
- Validate: non-empty sau trim.
- Business logic: redirect target uu tien `location.state.from`, fallback query `from`, cuoi cung `/match-stakes`.
- State chinh: `accessCode`, `isSubmitting`, `formError`.
- Mutation API: `POST /auth/check-access-code`.
- Permission/Auth: success se luu token/role ADMIN vao session.

### Dashboard Page
- Route: `/dashboard`
- Module: Dashboard
- Layout: `AppShellLayout` + `PageContainer`
- Muc dich: tong quan nhanh toan he thong.
- UI structure:
  - Breadcrumb + header.
  - Metric cards.
  - Top Match Stakes players, Top contributors.
  - Recent matches + Match detail overlay.
- API mount: `GET /dashboard/overview`.
- Action: click recent match -> mo overlay.
- Loading/error/empty: `PageLoading`, `ErrorState`, `EmptyState`.

### Match Stakes Page
- Route: `/match-stakes`
- Module: Match Stakes + Debt Cycle
- Layout: `AppShellLayout`
- Muc dich: man hinh nghiep vu no theo ky (debt period), settlement, lich su tich luy.
- Nguoi dung:
  - USER: xem current debt/history.
  - ADMIN: them match, tao period, settlement, close period.
- UI structure:
  - Header actions: Create match / Close period / New debt period.
  - Toolbar: show detail toggle, filter period, reset.
  - Debt Period info section (co the an/hien).
  - Current Debt section.
  - History section (minimal/detail, grouped by period, infinite load).
  - Match detail overlay.
  - 4 modal: Filter Debt Period, Record Settlement, Create Debt Period, Close Period.
- Du lieu load:
  - Current open period.
  - Danh sach all periods.
  - Timeline active period.
  - Infinite history neu dang all periods.
- API mount:
  - `GET /match-stakes/debt-periods/current`
  - `GET /match-stakes/debt-periods`
  - `GET /match-stakes/debt-periods/:id/timeline` (hoac fallback detail+matches)
- API mutate:
  - `POST /match-stakes/debt-periods/:periodId/settlements`
  - `POST /match-stakes/debt-periods`
  - `POST /match-stakes/debt-periods/:periodId/close`
- Rule quan trong:
  - close period disable neu chua co >=1 match.
  - settlement line phai hop le (payer != receiver, amount > 0).
  - close period can confirm text dung `Close Period N`.

### Match Stakes Create Page
- Route: `/match-stakes/new`
- Module: Match Stakes
- Layout: `AppShellLayout`
- Muc dich: tao match moi bang flow preview -> dieu chinh -> confirm.
- UI structure: setup panel, participants panel, settlement preview, confirm modal.
- API load:
  - `GET /players?isActive=true`
  - `GET /rule-sets?module=MATCH_STAKES&status=ACTIVE`
  - `GET /rule-sets/:id` (de loc version applicable)
- API mutate:
  - `POST /matches/preview`
  - `POST /matches`
- Rule quan trong:
  - player unique, placement unique, du top.
  - `currentNetTotal` phai = 0 moi tao duoc.
  - neu manual adjust thi note bat buoc.
  - auto preview debounce 250ms.

### Group Fund Page
- Route: `/group-fund/fund`
- Module: Group Fund
- Layout: `AppShellLayout`
- Muc dich: quan ly quy hien tai, obligations, withdrawals, ledger, manual transactions.
- UI structure:
  - Fund balance hero + action buttons.
  - Current Obligations section (toggle hide/show).
  - History Controls (filter + mode toggle).
  - Withdrawal History, Fund Ledger, Match History, Manual Transactions.
  - Match detail overlay.
  - 4 modal: Filter, Mark Paid, Withdraw, Manual Transaction.
- API load:
  - `GET /group-fund/summary`
  - `GET /group-fund/transactions?transactionType=WITHDRAWAL`
  - `GET /group-fund/ledger`
  - `GET /group-fund/matches`
  - `GET /group-fund/transactions`
  - `GET /players?isActive=true`
- API mutate:
  - `POST /group-fund/contributions`
  - `POST /group-fund/transactions`
- Rule quan trong:
  - write actions chi hien cho ADMIN.
  - manual transaction: player optional voi ADJUSTMENT_IN/OUT.
  - obligations sort bucket: owes -> prepaid -> settled.

### Group Fund Create Page
- Route: `/group-fund/new`
- Module: Group Fund
- Layout: `AppShellLayout`
- Muc dich: tao match Group Fund voi preview tac dong quy.
- UI structure: setup panel, participants panel, module preview, confirm modal.
- API load:
  - `GET /players?isActive=true`
  - `GET /group-fund/summary`
  - `GET /rule-sets?module=GROUP_FUND&status=ACTIVE`
  - `GET /rule-sets/:id`
- API mutate:
  - `POST /matches/preview`
  - `POST /matches`
- Rule quan trong:
  - participant net khong duoc > 0.
  - manual adjust thi note bat buoc.
  - auto preview debounce 250ms.
### Rules List Page
- Route: `/rules`
- Module: Rules
- Layout: `AppShellLayout`
- Muc dich: search/filter rule sets va xem summary version moi nhat.
- Nguoi dung: USER/ADMIN (ADMIN co them nut tao).
- UI structure: header action, filter modal, results table/card responsive, pagination.
- API mount:
  - `GET /rule-sets` (fetch all pages)
  - N+1: `GET /rule-sets/:id` cho tung row de lay latest version summary.
- Rule: filter date from <= to.

### Rule Set Create Page
- Route: `/rules/new`
- Module: Rules
- Layout: `AppShellLayout`
- Muc dich: chon module va mo flow tao rule tuong ung.
- Flow:
  - Khong co query `module`: hien card chon Match Stakes/Group Fund.
  - Co query: render truc tiep flow theo module.

### Match Stakes Rule Create Flow (embedded)
- Dung trong: `/rules/new?module=MATCH_STAKES`, `/rules/:id/edit`.
- Form fields:
  - `name`, `description`, `isDefault`, `participantCount`, `winnerCount`, `winnerPayouts`, `losses`, `penalties`.
- Validate:
  - winnerCount < participantCount.
  - rank coverage dung, unique rank.
  - tong payout = tong loss.
  - rank1 payout > rank2 neu nhieu winner.
- Submit:
  - Create mode -> `rulesApi.create`.
  - Edit mode -> `rulesApi.update` (tao version moi).

### Group Fund Rule Create Flow (embedded)
- Dung trong: `/rules/new?module=GROUP_FUND`, `/rules/:id/edit`.
- Form fields:
  - `name`, `description`, `isDefault`, `participantCount`, `contributions[]`, `penalties[]`.
- Validate:
  - contributions cover du rank 1..participantCount.
  - unique contribution ranks/penalty placements.
  - it nhat 1 amount > 0.
- Submit:
  - Create mode -> `rulesApi.create` voi `rules` raw.
  - Edit mode -> `rulesApi.update` (tao version moi).

### Rule Set Detail Page
- Route: `/rules/:ruleSetId`
- Muc dich: xem metadata rule set va danh sach versions.
- API mount: `GET /rule-sets/:ruleSetId`.
- Action:
  - click version -> version detail.
  - ADMIN co nut Edit rule.
- Edge:
  - ho tro query `returnTo`, `returnLabel` de quay lai create-match page.

### Rule Set Edit Page
- Route: `/rules/:ruleSetId/edit`
- Muc dich: chinh rule set qua flow business, submit tao version moi.
- API load:
  - `GET /rule-sets/:id` (+ latest version detail khi can).
- Business logic:
  - Match Stakes prefill tu builderConfig latest.
  - Group Fund prefill tu compiled rules latest.

### Rule Set Version Create Page
- Route: `/rules/:ruleSetId/versions/new`
- Muc dich: tao version moi truc tiep (builder/raw tuy module).
- Flow:
  - MATCH_STAKES -> MatchStakesBuilderForm.
  - Module khac (hien tai GROUP_FUND) -> RawVersionForm.
- Prefill:
  - Query `fromVersionId` de prefill builder config neu source la MATCH_STAKES_PAYOUT.
- API submit:
  - qua `rulesApi.createVersion` (thuc chat goi update contract tao latest version).

### Rule Set Version Detail Page
- Route: `/rules/:ruleSetId/versions/:versionId`
- Muc dich: doc business summary + compiled rules snapshot cua version.
- API load:
  - `useRuleSetVersionDetail` (detail rule set roi find version).

### Rule Set Version Edit Page (metadata)
- Route: `/rules/:ruleSetId/versions/:versionId/edit`
- Muc dich: chinh metadata theo co che immutable (save tao version moi).
- Form: `isActive`, `effectiveTo`, `summaryJsonText`.
- API submit: `rulesApi.update` voi snapshot source version.

### Players Page
- Route: `/players`
- Muc dich: quan ly player dung trong match/rules.
- UI: search + segmented status + card grid + deactivate confirm + pagination.
- API load: `GET /players`.
- API mutate:
  - `DELETE /players/:id` (deactivate)
  - `PATCH /players/:id` (reactivate)
- Permission: write actions chi hien voi ADMIN.

### Player Create Page
- Route: `/players/new`
- Form fields (`PlayerForm`):
  - `displayName` required
  - `slug` optional
  - `avatarUrl` optional URL
  - `isActive` boolean
- API submit: `POST /players`.

### Player Edit Page
- Route: `/players/:playerId/edit`
- API load: `GET /players/:playerId`.
- API submit: `PATCH /players/:playerId`.

### Match Detail Standalone
- Route: `/matches/:matchId`
- Muc dich: trang detail rieng, co action void match.
- API load: `GET /matches/:matchId`.
- API mutate: `POST /matches/:matchId/void`.
- Permission: void chi cho ADMIN, disable neu da VOIDED.

### Match Detail Overlay (shared)
- Dung trong: Dashboard, MatchStakesPage, GroupFundPage.
- API load: `GET /matches/:id` khi mo overlay.
- Nghiep vu them:
  - Group Fund snapshot before/after qua `useGroupFundSummary`.
  - Rule details qua `useRuleSetVersionDetail`.

### Settings Page
- Route: `/settings`
- Muc dich:
  - doi money display mode,
  - quan ly role/session.
- Action:
  - doi mode luu localStorage,
  - login as admin (`/login`),
  - ADMIN switch ve USER mode.

### Not Found Page
- Route: `/not-found`, `*`
- Muc dich: fallback route.

## 5. Component dung chung quan trong

### AppShellLayout
- Vai tro: shell chung, sidebar desktop + drawer mobile.
- Menu map hien tai: `/match-stakes`, `/rules`, `/players`, `/settings`.
- Ghi chu: khong co item cho `/dashboard` va `/group-fund/fund`.

### Layout primitives
- `PageContainer`, `PageHeader`, `SectionCard`, `FilterBar`, `AppBreadcrumb`.
- Vai tro: thong nhat khung UI va spacing cho toan app.

### Match detail shared
- `MatchDetailOverlay`, `MatchDetailView`.
- Dung lai giua dashboard/match-stakes/group-fund.

### Form/state helpers
- `FormApiError`, `ErrorState`, `EmptyState`, `PageLoading`, `InlineLoading`.
- `ConfirmDanger` cho action nguy hiem.

### Rule create-flow components
- `RuleBasicInfoSection`, `RuleMatchSetupSection`, `PenaltyList`, `CurrencyAmountInput`, `ReviewSummaryCard`, `RuleFormFooter`, `RankPlacementSelect`.
- Reuse manh giua Match Stakes rule flow, Group Fund rule flow, va create-match pages.

## 6. Routing va permission
- Layout:
  - `/login` khong boc shell.
  - Route con cua `/` boc `AppShellLayout`.
- Auth guard:
  - `RequireAdminRoute` kiem tra `canWrite()`.
- Permission guard:
  - UI-level: hide buttons.
  - Action-level: `guardWritePermission`.
  - Network-level: interceptor chan write method khi role != ADMIN.
- Redirect/fallback:
  - `/` -> `/match-stakes`.
  - `/group-fund` -> `/group-fund/fund`.
  - wildcard `*` -> NotFound.
  - route error boundary co `RouteErrorBoundary`.

## 7. State management va data flow
- Global state:
  - `AuthContext` (`accessToken`, `role`, `isBootstrapping`, `isAuthenticated`, `canWrite`, ...).
  - Session luu localStorage keys: `tft2.auth.accessToken`, `tft2.auth.role`.
- Server state:
  - React Query (staleTime 30s, gcTime 5m, retry query toi da 2 lan neu khong phai 4xx).
- Form state:
  - RHF + Zod cho players/rules/group-fund modal forms.
  - local state cho mot so modal lon (match-stakes settlement/close period, login).
- URL/search state:
  - `module`, `returnTo`, `returnLabel`, `fromVersionId`.
- Persisted local state:
  - money mode, create draft, history mode, obligations visibility, match detail view mode.
- Side effects:
  - Interceptor auto recover session (ADMIN het han -> fallback USER).
  - Auto preview debounce 250ms o create match pages.
  - Infinite load history match-stakes bang `IntersectionObserver`.

## 8. Mapping page -> API

| Page | API load chinh | API mutate chinh | Ghi chu |
|---|---|---|---|
| Login | `POST /auth/check-access-code` (+ bootstrap `POST /auth/login`) | login admin | set session localStorage |
| Dashboard | `GET /dashboard/overview` | - | refetch query key dashboard |
| Match Stakes | debt periods + timeline APIs | create period/settlement/close period | invalidate toan bo `match-stakes` keys |
| Match Stakes Create | players + rules + rule detail | `POST /matches/preview`, `POST /matches` | invalidate module + dashboard |
| Group Fund | summary/ledger/matches/transactions APIs | contributions/transactions APIs | invalidate summary/ledger/transactions/dashboard |
| Group Fund Create | players + group-fund summary + rules | `POST /matches/preview`, `POST /matches` | invalidate module + dashboard |
| Rules List | `GET /rule-sets` + N+1 detail | - | client-side filter |
| Rules create/edit flows | detail khi edit | create/update rule set | update tao immutable version moi |
| Players | `GET /players` | delete/patch player | invalidate players list/options/dashboard |
| Player create/edit | detail (edit) | create/patch player | invalidate players cache |
| Match detail | `GET /matches/:id` | `POST /matches/:id/void` | invalidate match + module + dashboard |
| Settings | - | - | localStorage + navigation |

## 9. Business rules quan trong toan he thong
- USER doc duoc, ADMIN moi ghi duoc.
- Write bi chan 3 lop: route guard, UI guard, HTTP interceptor.
- Session:
  - app auto bootstrap USER session.
  - ADMIN het han -> fallback USER mode.
- Match Stakes create:
  - unique players/top, net tong = 0, manual adjust can note.
- Group Fund create:
  - participant net khong duoc > 0, manual adjust can note.
- Debt period:
  - khong close period neu chua co match.
  - close can confirm text dung format.
  - settlement line phai hop le.
- Rule builder:
  - Match Stakes: payout/loss can bang, rank coverage dung.
  - Group Fund: contribution coverage + unique penalties + co it nhat 1 amount > 0.
- Versioning:
  - update rule/metadata la tao version moi, khong sua truc tiep version cu.

## 10. Nhung diem chua xac dinh chac chan tu source code
- Chua xac dinh chac chan tu source code: ly do nghiep vu vi sao `Dashboard` va `Group Fund` khong nam trong sidebar du route ton tai.
- Chua xac dinh chac chan tu source code: `QuickMatchEntry`, `RuleSetMetaForm`, `VersionRowActionMenu`, route `/rules/:ruleSetId/versions/new`, `/rules/:ruleSetId/versions/:versionId/edit`, `/matches/:matchId` dang la luong chinh hay chi de du phong/deep-link.
- Chua xac dinh chac chan tu source code: endpoint timeline moi cua backend co phai duong chay chinh o production hay frontend se thuong fallback tu detail+matches.
- Chua xac dinh chac chan tu source code: permission matrix chi tiet hon ngoai 2 role `ADMIN`/`USER`.
- Chua xac dinh chac chan tu source code: ke hoach i18n (frontend hien khong co cau hinh i18n).
