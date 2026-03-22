## ADDED Requirements

### Requirement: Typed API Client and Envelope Handling
The frontend SHALL use a typed API client for `/api/v1` endpoints and MUST normalize backend success/error envelopes into predictable frontend response and error objects.

#### Scenario: Successful API response unwrapping
- **WHEN** an endpoint returns `ApiSuccessResponse<T>`
- **THEN** the client MUST expose `data` as typed payload `T` to feature hooks without requiring per-call envelope parsing

#### Scenario: Error response normalization
- **WHEN** an endpoint returns `ApiErrorResponse` with `error.code` and `error.message`
- **THEN** the client MUST map it into a shared frontend error shape consumable by forms and page-level error boundaries

### Requirement: Query Key and Invalidation Conventions
The frontend SHALL define a centralized TanStack Query key strategy and MUST apply deterministic invalidation for mutations that affect module summaries, histories, and details.

#### Scenario: Match creation invalidation
- **WHEN** `POST /api/v1/matches` succeeds for a module
- **THEN** the system MUST invalidate that module summary, ledger/history, match list, dashboard overview, and recent preset queries

#### Scenario: Player mutation invalidation
- **WHEN** player create/update/deactivate operations succeed
- **THEN** the system MUST invalidate player list queries and dependent screens that consume active player options

### Requirement: Shared Form Schema and Error Mapping
The frontend SHALL use Zod schemas with React Hook Form for user input and MUST map backend validation/business codes to actionable form feedback.

#### Scenario: Client-side schema validation
- **WHEN** a user submits invalid form values
- **THEN** the system MUST block submission and show field-level validation messages derived from Zod schema rules

#### Scenario: Backend business error display
- **WHEN** backend returns a known business error code such as `MATCH_DUPLICATE_PLAYER`
- **THEN** the system MUST show a readable error message near submit context and preserve entered form state

### Requirement: Formatting Utilities for Currency, Time, and Labels
The frontend SHALL provide shared formatting utilities for VND amounts, date-time values, and status/module labels.

#### Scenario: Currency display
- **WHEN** an integer VND value is rendered in summary cards or history rows
- **THEN** the system MUST format it for display without mutating the underlying integer value used for logic

#### Scenario: Timezone-aware date-time display
- **WHEN** an ISO timestamp is rendered
- **THEN** the system MUST format it with explicit timezone handling using `dayjs` utilities

