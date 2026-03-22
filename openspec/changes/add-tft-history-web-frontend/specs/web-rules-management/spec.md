## ADDED Requirements

### Requirement: Rule Set List and Filtering
The frontend SHALL provide a rule set list page backed by `GET /api/v1/rule-sets` with module/status/default filters and pagination.

#### Scenario: Filtered list query
- **WHEN** user adjusts module, status, or default filters
- **THEN** the system MUST request and render filtered rule set results with pagination metadata support

### Requirement: Rule Set Metadata CRUD
The frontend SHALL support rule set metadata creation and update using `POST /api/v1/rule-sets` and `PATCH /api/v1/rule-sets/:ruleSetId`.

#### Scenario: Create rule set metadata
- **WHEN** user submits valid module, code, name, and optional metadata fields
- **THEN** the system MUST create the rule set and route user to a detail-capable context

#### Scenario: Update default flag
- **WHEN** user sets `isDefault=true` in edit flow
- **THEN** the system MUST update rule set metadata and refresh list/detail state to reflect current default status

### Requirement: Rule Set Detail and Versions Overview
The frontend SHALL provide a detail page for `GET /api/v1/rule-sets/:ruleSetId` showing rule set metadata and version list.

#### Scenario: Version list visibility
- **WHEN** rule set detail loads successfully
- **THEN** the system MUST display version items with participant range, effective window, and active status for selection

### Requirement: Rule Set Version Creation with Nested Structures
The frontend SHALL support creating rule set versions via `POST /api/v1/rule-sets/:ruleSetId/versions` including nested rules, conditions, and actions.

#### Scenario: Nested rule structure editing
- **WHEN** user configures rules with one or more conditions and actions
- **THEN** the system MUST support add/remove/edit operations for nested arrays and serialize payload matching backend DTO structure

#### Scenario: Participant range validation
- **WHEN** participant min is greater than participant max
- **THEN** the system MUST block submission with inline validation feedback

### Requirement: Rule Set Version Detail and Metadata Edit
The frontend SHALL support version detail display via `GET /api/v1/rule-sets/:ruleSetId/versions/:versionId` and metadata updates via `PATCH /api/v1/rule-sets/:ruleSetId/versions/:versionId`.

#### Scenario: Version detail view
- **WHEN** a version is selected
- **THEN** the system MUST show nested rules, conditions, and actions in readable sections suitable for mobile and tablet/desktop

#### Scenario: Metadata-only patch
- **WHEN** user updates `isActive`, `effectiveTo`, or `summaryJson`
- **THEN** the system MUST submit only supported metadata fields and refresh version detail state on success

