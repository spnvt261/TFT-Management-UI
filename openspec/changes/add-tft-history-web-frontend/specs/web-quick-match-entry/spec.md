## ADDED Requirements

### Requirement: Reusable Quick Match Entry for Both Modules
The frontend SHALL provide one reusable quick-entry flow component that supports match creation for both `MATCH_STAKES` and `GROUP_FUND`.

#### Scenario: Module-specific entry context
- **WHEN** quick entry is opened from a module page
- **THEN** the flow MUST initialize with the module matching the originating page and allow rule/player/placement entry in the same reusable UI

### Requirement: Recent Preset Preload and Sanitization
The frontend SHALL preload recent preset data from `GET /api/v1/recent-match-presets/:module` and MUST sanitize stale references before prefilling fields.

#### Scenario: Preset prefill success
- **WHEN** preset data contains valid player ids, rule set id, optional version id, and participant count
- **THEN** the system MUST prefill quick-entry fields with those values

#### Scenario: Preset contains stale values
- **WHEN** preset references inactive/missing players or unavailable rules
- **THEN** the system MUST drop invalid references, fallback to valid defaults, and keep flow usable without blocking

### Requirement: Rule Set Resolution for Entry
The frontend SHALL resolve default rule set context via `GET /api/v1/rule-sets/default/by-module/:module` when preset data is insufficient.

#### Scenario: Default rule set fallback
- **WHEN** quick entry has no usable preset rule set/version
- **THEN** the system MUST fetch and apply default rule set for selected module and participant count

### Requirement: Match Input Validation and Submission
The frontend SHALL validate and submit quick-entry data to `POST /api/v1/matches` according to backend constraints.

#### Scenario: Unique participants and placements
- **WHEN** user attempts submit with duplicate players or duplicate placements
- **THEN** the system MUST prevent submit and show validation errors before API call

#### Scenario: Valid match create
- **WHEN** user submits valid module, rule set, participant list (3 or 4), placements (1..8), and optional note
- **THEN** the system MUST create the match and return immediate settlement result context

### Requirement: Post-Create Preset Update and UI Feedback
The frontend SHALL update presets and refresh dependent module views after successful creation.

#### Scenario: Preset update after create
- **WHEN** `POST /api/v1/matches` succeeds
- **THEN** the system MUST call `PUT /api/v1/recent-match-presets/:module` with last used rule set, version, selected player ids, and participant count

#### Scenario: Settlement confirmation UX
- **WHEN** match creation succeeds
- **THEN** the system MUST show settlement confirmation summary and provide a clear next action to close or add another match

