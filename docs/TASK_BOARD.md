# ActionPilot Task Board

## Status values

```text
Backlog | In Progress | Blocked | Review | Done
```

## Sprint 0 — Project foundation

| ID | Task | Owner | Branch | Status | Expected outcome |
|---|---|---|---|---|---|
| S0-01 | Create the GitHub repository | Vitaly | `main` | Done | Repository created |
| S0-02 | Push the initial scaffold | Vitaly | `main` | Done | Initial source available on GitHub |
| S0-03 | Create the branch structure | Vitaly | `main` / `develop` | Done | Core, feature, experiment, and archive branches available |
| S0-04 | Review core documentation | Shared | `develop` | Review | Project workflow and responsibilities are clear |
| S0-05 | Add repository description and topics | Vitaly | GitHub settings | Backlog | Repository is easier to discover and understand |

## Sprint 1 — Extension MVP

| ID | Task | Owner | Branch | Status | Expected outcome |
|---|---|---|---|---|---|
| S1-01 | Build the extension | Vitaly | `feature/vitaly-ui-extension` | In Progress | Extension build completes successfully |
| S1-02 | Load the unpacked extension | Vitaly | `feature/vitaly-ui-extension` | In Progress | Popup opens in Chrome or Edge |
| S1-03 | Scan the active page | Vitaly | `feature/vitaly-ui-extension` | In Progress | Visible interactive elements are collected |
| S1-04 | Implement local click planner | Vitaly | `feature/vitaly-ui-extension` | In Progress | Best candidate is proposed |
| S1-05 | Execute a confirmed click | Vitaly | `feature/vitaly-ui-extension` | In Progress | Click occurs only after confirmation |
| S1-06 | Improve low-confidence handling | Vitaly | `feature/vitaly-ui-extension` | Backlog | User can choose among ambiguous candidates |
| S1-07 | Add a reproducible test fixture | Vitaly | `feature/vitaly-ui-extension` | Backlog | Core workflow can be demonstrated consistently |

## Sprint 2 — Planner and backend

| ID | Task | Owner | Branch | Status | Expected outcome |
|---|---|---|---|---|---|
| S2-01 | Run the Rust API | Backend contributor | `feature/agent-planner-api` | Backlog | `/health` returns a successful response |
| S2-02 | Finalize the JSON contract | Backend contributor | `feature/agent-planner-api` | Backlog | Extension/backend contract is documented |
| S2-03 | Implement planner backend v1 | Backend contributor | `feature/agent-planner-api` | Backlog | API returns a structured action plan |
| S2-04 | Add planner scoring tests | Backend contributor | `feature/agent-planner-api` | Backlog | Candidate ranking is covered by tests |
| S2-05 | Add safety-policy tests | Backend contributor | `feature/agent-planner-api` | Backlog | Dangerous instructions are rejected |
| S2-06 | Return low-confidence results | Backend contributor | `feature/agent-planner-api` | Backlog | Planner refuses to guess when confidence is insufficient |

## Sprint 3 — Integration

| ID | Task | Owner | Branch | Status | Expected outcome |
|---|---|---|---|---|---|
| S3-01 | Configure the backend URL | Vitaly | `feature/vitaly-ui-extension` | Backlog | UI can target a local planner API |
| S3-02 | Send the page element map | Shared | `develop` | Backlog | Extension calls the Rust API |
| S3-03 | Display the backend plan | Shared | `develop` | Backlog | Returned action is visible before execution |
| S3-04 | Handle backend failure safely | Shared | `develop` | Backlog | Failure cannot trigger uncontrolled execution |
| S3-05 | Complete the private demo | Shared | `main` | Backlog | Stable, tested version is ready to present |

## Sprint 4 — Portfolio quality

| ID | Task | Owner | Branch | Status | Expected outcome |
|---|---|---|---|---|---|
| S4-01 | Add automated CI checks | Vitaly | `develop` | Backlog | Builds and tests run on pull requests |
| S4-02 | Record a short demo GIF | Vitaly | `docs/demo` | Backlog | README shows the full interaction flow |
| S4-03 | Add architecture documentation | Vitaly | `docs/architecture` | Backlog | Component boundaries are explained |
| S4-04 | Publish a tagged release | Vitaly | `main` | Backlog | Stable milestone is available under Releases |
| S4-05 | Add issue templates | Vitaly | `.github` | Backlog | Bugs and feature requests use structured forms |
