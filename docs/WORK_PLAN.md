# ActionPilot Work Plan

## 1. Project objective

Build a browser extension that accepts a natural-language instruction and performs a visible action on the active page while preserving explicit human control.

Example MVP flow:

```text
User: Click the login button.
ActionPilot: Scans the page, identifies visible candidates, proposes one action,
waits for confirmation, and executes only after approval.
```

ActionPilot is not a hidden automation bot. It is a visible, human-in-the-loop assistant designed to reduce repetitive browser work without removing user oversight.

## 2. Expected outcomes by stage

### Local MVP

- Loadable unpacked extension for Chrome and Edge
- Clean popup interface
- Visible-element scanning
- Basic local deterministic planner
- Click execution only after explicit confirmation
- Initial safety rules
- Clear local installation instructions

### Private demo

- Improved visual design
- Better candidate ranking
- Local action logs
- Manual candidate selection when confidence is low
- Rust backend prepared for planner integration
- Reproducible demo scenarios

### Advanced version

- Rust planner connected to the extension
- Controlled multi-step actions
- Confirmation checkpoints between steps
- Interface translations
- Reusable site profiles or workflows
- Automated tests and CI
- Structured technical documentation

## 3. Selected stack

### Browser extension

- Vite
- TypeScript
- Chrome Manifest V3
- HTML and CSS without React for the first MVP

Rationale:

- Smaller runtime footprint
- Fewer dependencies
- Faster iteration
- Easier debugging of the core browser-extension workflow

### Backend and planner

- Rust
- Axum
- Serde JSON
- Tokio
- JSON API

Rationale:

- Strong type system
- Predictable performance
- Clear API contracts
- Solid foundation for a more advanced planner

## 4. Product principles

1. The user remains in control.
2. Scan first, plan second, confirm third, execute last.
3. When confidence is low, show candidates and request a decision.
4. Never store passwords or sensitive values.
5. Do not automate payments, banking, CAPTCHA, 2FA, or destructive actions.
6. Prefer a simple and reliable system over premature AI complexity.
7. Make every proposed action inspectable.
8. Keep browser permissions minimal.

## 5. Ownership

### Vitaly

Primary responsibility:

- Popup interface
- User experience
- Scan → plan → confirm → execute workflow
- Visual design
- Visible-element scanner
- Basic local planner
- Confirmation and execution logic
- Usage documentation
- Manual testing on real pages

Primary branch:

```text
feature/vitaly-ui-extension
```

### Planner/backend contributor

Primary responsibility:

- Planner architecture
- Rust backend
- API contracts
- Decision rules
- Safety policies
- Planner tests
- Possible future AI-model integration

Primary branch:

```text
feature/agent-planner-api
```

### Shared responsibility

- Review major architectural decisions
- Review safety-sensitive changes
- Review merges into `develop`
- Define release scope
- Validate demo scenarios

## 6. Development phases

### Phase 0 — Repository foundation

Expected result:

- Monorepo structure created
- Extension build scaffold working
- Rust API scaffold available
- Core documentation written
- Branch strategy established

### Phase 1 — Extension MVP

Tasks:

- Build a functional popup
- Scan the active page
- Display detected visible elements
- Add a basic local planner
- Require confirmation before execution
- Execute a click on the approved visible element

Definition of completion:

- The extension loads in Chrome or Edge
- The flow works on a standard test page
- No hidden or automatic actions occur
- The proposed action is visible before execution

### Phase 2 — UX and manual control

Tasks:

- Improve the popup design
- Display ranked candidates
- Allow manual candidate selection
- Add useful error states
- Add local, privacy-conscious logs
- Improve low-confidence handling

### Phase 3 — Rust backend and planner

Tasks:

- Implement `/health`
- Implement `/v1/plan`
- Stabilize the JSON contract
- Build the first deterministic Rust planner
- Add scoring tests
- Add safety-policy tests
- Return an explicit low-confidence result when no candidate is reliable

### Phase 4 — Extension and backend integration

Tasks:

- Configure the backend URL
- Send the page element map to the backend
- Receive a structured action plan
- Display the returned plan
- Execute only after confirmation
- Handle backend errors without unsafe fallback behavior

### Phase 5 — Private demo

Tasks:

- Finalize installation documentation
- Prepare repeatable test cases
- Add Spanish or Russian translations only if they improve the demo
- Record a short product demo
- Tag a stable release

## 7. Decision framework

Important technical decisions should compare at least two realistic options.

| Decision | Option A | Option B | Current direction |
|---|---|---|---|
| Extension UI | Plain HTML/CSS/TS | React | Plain stack for MVP |
| Planner | Local TypeScript | Rust API | Local first, Rust integration next |
| Branch model | Feature branches | Direct work in `develop` | Feature branches |
| Initial actions | Click only | Click, type, select | Click only |
| Planner logic | Deterministic scoring | AI-first planner | Deterministic first |
| Execution | Automatic | Explicit confirmation | Explicit confirmation |

## 8. Definition of Done

A task is complete only when:

- It builds, or any known build limitation is documented.
- It can be tested manually or automatically.
- It does not break the existing workflow.
- It does not add unnecessary permissions.
- It does not bypass user confirmation.
- It includes documentation when behavior or setup changes.
- It includes clear, scoped commits.
- Safety-sensitive changes include tests or explicit review notes.
