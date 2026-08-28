# Component inventory

This inventory is the implementation contract for the orbital protocol atlas. Build components from semantic HTML and the tokens in `src/styles/tokens.css`; do not replace these with a generic component library.

| Component | Purpose | Required states / accessibility contract |
| --- | --- | --- |
| `SkipLink` | Jump to room content. | Visible on focus; targets `#main`. |
| `AppShell` | Header/wordmark/navigation, main, and footer frame. | One `main`, route focus on navigation, accessible home name, `aria-current`, responsive gutters, and valid footer links. |
| `RouteHeading` | Page h1, revision/status context. | Exactly one h1; status is text plus icon. |
| `OrbitAtlas` | Relationship map of fixture, decisions, and acknowledgement. | Selected/static/reduced-motion; keyboard equivalent is the linked outline. |
| `RoomRail` | Room/revision/section context. | Current section and publish status; stacks before content at narrow widths. |
| `FixturePanel` | Sanitized request/response example. | Selected, loading, redaction warning, copy success/error; code has label and scroll boundary. |
| `RedactionReport` | Safe import findings and confirmation. | Clean, blocking finding, needs-review, resolved; never prints raw secret. |
| `Checklist` | Acceptance criteria. | Incomplete, complete, disabled, error; native checkbox/label and announced count. |
| `DecisionLedger` | Versioned decisions and owners. | Open, decided, superseded, overdue; date and owner are text, not color only. |
| `QuestionThread` | Client question and response sequence. | Empty, open, answered, loading, send error; labelled form and live submission result. |
| `OwnershipMarker` | Person/role/due-date reference. | Assigned, unassigned, overdue; does not rely on avatar color. |
| `AcknowledgementPlane` | Review confirmation and immutable receipt. | Blocked, ready, submitting, acknowledged, revision-stale; typed name, disclaimer, checkbox, receipt. |
| `DemoBanner` | Isolated sample-mode status/actions. | Active, reset confirmation, start-real link; persistent and concise. |
| `ActionButton` | Primary, secondary, or destructive verb action. | Default, hover, focus, pressed, disabled, busy; min 44px target; destructive use confirms the named target. |
| `StatusChip` | Compact status summary. | Success/warning/danger/neutral, icon plus text. |
| `Notice` | Inline error, warning, or success explanation. | Polite/assertive live use is intentional; contains next action. |
| `Dialog` | Invite, delete, billing, or confirmation layer. | Open/closed, focus trap, Escape close unless destructive confirmation needs explicit choice, focus restoration. |
| `ExportControl` | Handover download lifecycle. | Ready, generating, downloaded, expired, failed; download outcome remains in page content. |
| `EmptyState` | Next action when content does not exist. | Clear explanation and one action; no dead-end illustration. |
