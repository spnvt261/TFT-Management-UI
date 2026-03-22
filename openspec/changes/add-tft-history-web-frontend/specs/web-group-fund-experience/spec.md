## ADDED Requirements

### Requirement: Group Fund Summary Panel
The frontend SHALL provide a Group Fund module page with top summary metrics from `GET /api/v1/group-fund/summary`.

#### Scenario: Summary content rendering
- **WHEN** group fund summary query succeeds
- **THEN** the system MUST display fund balance, total module matches, and per-player contribution/obligation values

### Requirement: Group Fund Ledger Feed
The frontend SHALL provide a fund increase/decrease history feed backed by `GET /api/v1/group-fund/ledger`.

#### Scenario: Ledger row content
- **WHEN** ledger entries are rendered
- **THEN** each entry MUST show datetime, related player, movement amount, movement type (`FUND_IN` or `FUND_OUT`), and reason text

#### Scenario: Ledger row detail interaction
- **WHEN** a user selects a ledger row linked to a match
- **THEN** the system MUST allow opening corresponding match detail context

### Requirement: Group Fund Match History
The frontend SHALL provide Group Fund match history using `GET /api/v1/group-fund/matches`.

#### Scenario: Group fund match card details
- **WHEN** match history entries are shown
- **THEN** each entry MUST display datetime, participants/placements, rule set context, note, and fund-related settlement totals

### Requirement: Manual Group Fund Transaction UX
The frontend SHALL support manual fund transaction creation and listing via `POST /api/v1/group-fund/transactions` and `GET /api/v1/group-fund/transactions`.

#### Scenario: Manual transaction creation
- **WHEN** a user submits a valid manual transaction form
- **THEN** the system MUST create the transaction and refresh summary, ledger, and transaction list data

#### Scenario: Conditional player requirement
- **WHEN** transaction type is `CONTRIBUTION` or `WITHDRAWAL`
- **THEN** the system MUST require player selection before allowing submit

### Requirement: Group Fund Quick Add Affordance
The frontend SHALL provide a clear quick-add action entry point for creating Group Fund matches.

#### Scenario: Group Fund quick match trigger
- **WHEN** user activates the `+` action on Group Fund module screen
- **THEN** the system MUST open reusable quick match entry with module preset to `GROUP_FUND`

