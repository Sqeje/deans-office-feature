# Staff workplace implementation

Approved 2026-11-19. Goal: explicit teacher/dean responsibilities, assigned courses, linked lessons, journal grades and attendance, final history and optional dean correction (default read only), consistent two-week simulation, server catalog and staff dashboard.

## Deliverables
- Backend: Identity assignments and controlled provisioning; operation and object authorization; course-linked schedule; journal and final history; migrations and generated OpenAPI.
- Simulation: three groups of ten fictional students, three teachers, two dean staff; alternating two-week cycle with isolated exceptions; preserve existing edits and passwords.
- Frontend: assignments dashboard, course journal, attendance, finals and reasons/history, API catalog; responsive at 360px.
- Checks: server isolation/CSRF/concurrency/access tests, frontend build/browser scenarios, migration compatibility, repeat seed.

## Execution record
- Clean main inspected; feature/staff-workplace created. No publication authorized.
- Backend and frontend implementation delegated with explicit contract coordination.
- Dependent slices remain on one local feature branch for integration; no remote PRs or merges performed. Separate publication remains subject to user permission.
