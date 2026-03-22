## ADDED Requirements

### Requirement: Match Stakes Summary Panel
The frontend SHALL provide a Match Stakes module page with a top summary section backed by `GET /api/v1/match-stakes/summary`.

#### Scenario: Summary rendering
- **WHEN** summary query succeeds
- **THEN** the system MUST display per-player net balance, total module matches, and any returned debt suggestion data

#### Scenario: Date range filter
- **WHEN** a user changes from/to filters
- **THEN** the system MUST refetch summary data with `from` and `to` query parameters

### Requirement: Debt Movement History Feed
The frontend SHALL provide a compact vertical history feed for Match Stakes ledger entries using `GET /api/v1/match-stakes/ledger`.

#### Scenario: History feed scanability
- **WHEN** ledger entries are rendered on mobile
- **THEN** each item MUST show posted time, movement direction context (source/destination player), amount, and short reason in a high-signal layout

#### Scenario: Entry detail interaction
- **WHEN** a user taps a ledger history item
- **THEN** the system MUST open match or entry detail context in modal/drawer form where full details are available

### Requirement: Match Stakes Match History List
The frontend SHALL provide a Match Stakes match history tab backed by `GET /api/v1/match-stakes/matches`.

#### Scenario: Match history item content
- **WHEN** match history entries are displayed
- **THEN** each item MUST include datetime, participants, placements, rule set/version context, note preview, and settlement totals

#### Scenario: Match item detail view
- **WHEN** a user selects a match history item
- **THEN** the system MUST fetch `GET /api/v1/matches/:matchId` and present full detail in drawer/modal or route-based detail

### Requirement: Match Stakes Quick Add Affordance
The frontend SHALL provide a clear quick-add action entry point for creating Match Stakes matches.

#### Scenario: Mobile quick action
- **WHEN** user is on Match Stakes page on mobile viewport
- **THEN** the system MUST show a sticky `+` action button that opens the reusable quick match entry flow with module preset to `MATCH_STAKES`

