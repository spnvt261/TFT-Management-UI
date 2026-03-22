## ADDED Requirements

### Requirement: Responsive App Shell and Module Navigation
The frontend SHALL provide a single authenticated app shell that exposes the three primary modules (`Match Stakes`, `Group Fund`, `Rules`) and shared areas (`Dashboard`, `Players`) with responsive navigation behavior.

#### Scenario: Desktop navigation layout
- **WHEN** viewport width is desktop breakpoint or larger
- **THEN** the system MUST render a persistent left sidebar with navigation links for Dashboard, Match Stakes, Group Fund, Rules, and Players

#### Scenario: Mobile navigation layout
- **WHEN** viewport width is below desktop breakpoint
- **THEN** the system MUST render compact top navigation with a drawer-based menu containing the same module links

### Requirement: Route Hierarchy and Deep-Link Support
The frontend SHALL expose stable route paths for all required screens and MUST support direct URL navigation for each route.

#### Scenario: Main module routes
- **WHEN** a user navigates to `/match-stakes`, `/group-fund`, or `/rules`
- **THEN** the system MUST render the corresponding module root screen with its page-specific content and actions

#### Scenario: Detail deep links
- **WHEN** a user navigates directly to `/matches/:matchId` or rule detail/version routes
- **THEN** the system MUST fetch required data and render detail content without requiring prior navigation state

### Requirement: Global UX States and Not Found Handling
The frontend SHALL provide consistent loading, empty, and error states, and SHALL include a not-found route for unmatched URLs.

#### Scenario: Not found path
- **WHEN** a user navigates to an unknown route
- **THEN** the system MUST render a dedicated not-found screen with navigation action back to a valid route

#### Scenario: Route-level loading and error
- **WHEN** a route-level query is pending or fails
- **THEN** the system MUST render standardized loading and error UI patterns with retry support for recoverable failures

