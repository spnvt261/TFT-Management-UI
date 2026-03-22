## ADDED Requirements

### Requirement: Dashboard Overview Screen
The frontend SHALL provide a dashboard page that consumes `GET /api/v1/dashboard/overview` and presents high-signal group status data for quick scanning.

#### Scenario: Dashboard data rendering
- **WHEN** dashboard overview query succeeds
- **THEN** the system MUST display player count, total matches, Match Stakes summary, Group Fund summary, and recent matches

#### Scenario: Dashboard load failure
- **WHEN** dashboard query fails
- **THEN** the system MUST render an error state with retry action

### Requirement: Player List and Filtering
The frontend SHALL provide a player management list that uses `GET /api/v1/players` with `isActive`, `search`, and pagination query support.

#### Scenario: Search and status filters
- **WHEN** a user applies name search or active-status filters
- **THEN** the system MUST request filtered results and update the list while preserving pagination behavior

### Requirement: Player Create and Update Flows
The frontend SHALL provide forms for creating and editing players via `POST /api/v1/players` and `PATCH /api/v1/players/:playerId`.

#### Scenario: Create player success
- **WHEN** a valid create form is submitted
- **THEN** the system MUST create the player, refresh player list data, and show success feedback

#### Scenario: Duplicate slug conflict
- **WHEN** backend returns `PLAYER_DUPLICATE`
- **THEN** the system MUST show a conflict message on the relevant form context without clearing existing field values

### Requirement: Player Activate/Inactivate Management
The frontend SHALL allow activation state updates using update or soft-delete APIs and MUST require confirmation for destructive-like state changes.

#### Scenario: Inactivate player
- **WHEN** a user confirms inactivation
- **THEN** the system MUST call `DELETE /api/v1/players/:playerId`, refresh list data, and reflect updated active status

#### Scenario: Reactivate player
- **WHEN** a user toggles a previously inactive player back to active
- **THEN** the system MUST call `PATCH /api/v1/players/:playerId` with `isActive=true` and refresh dependent queries

