# Git Branching Strategy

This document defines the branch model used to keep ActionPilot development organized, reviewable, and stable.

## Core branches

### `main`

The stable production and demo branch.

Rules:

- Do not develop features directly on `main`.
- Merge into `main` only from `develop`.
- Every merge into `main` should represent a tested and presentable version.
- Use this branch for portfolio demos, releases, and tagged milestones.

### `develop`

The integration branch.

Rules:

- Feature branches are merged here first.
- The branch may contain active development, but it should not remain broken.
- Test the complete workflow on `develop` before promoting changes to `main`.
- Resolve integration issues here, not in the stable branch.

## Working branches

### `feature/vitaly-ui-extension`

Vitaly's primary feature branch.

Scope:

- Extension popup
- UI and interaction design
- Scan → plan → confirm → execute workflow
- Visible-element scanner
- Local deterministic planner
- Confirmation and execution logic
- Manual browser testing

### `feature/agent-planner-api`

Planner and backend branch.

Scope:

- Rust/Axum backend
- API contracts
- Backend planner
- Planner tests
- Safety and decision rules

### `experiment/lab-click-flows`

Experimental branch for aggressive prototyping.

Scope:

- Fast experiments
- Alternative interaction flows
- Code that may temporarily break
- Ideas that are not ready for integration

Do not merge this branch into `develop` without cleanup, review, and testing.

### `archive/v0-scaffold`

Frozen copy of the initial project scaffold.

Purpose:

- Preserve the original repository baseline
- Provide a safe recovery point
- Make early architectural changes easy to compare

This branch should not receive normal development commits.

## Recommended initial commands

Run these commands after creating the repository and making the first commit on `main`:

```bash
git checkout -b develop
git push -u origin develop

git checkout -b feature/vitaly-ui-extension
git push -u origin feature/vitaly-ui-extension

git checkout develop
git checkout -b feature/agent-planner-api
git push -u origin feature/agent-planner-api

git checkout develop
git checkout -b experiment/lab-click-flows
git push -u origin experiment/lab-click-flows

git checkout main
git checkout -b archive/v0-scaffold
git push -u origin archive/v0-scaffold

git checkout develop
```

## Daily workflow

### Starting a task

```bash
git checkout develop
git pull origin develop
git checkout feature/vitaly-ui-extension
git rebase develop
```

### Saving progress

```bash
git add .
git commit -m "feat(extension): improve action confirmation flow"
git push origin feature/vitaly-ui-extension
```

### Integrating a completed feature

1. Confirm that the feature builds.
2. Run the relevant tests.
3. Review permissions and safety behavior.
4. Open a pull request into `develop`.
5. Test the integrated workflow.
6. Promote `develop` to `main` only when the version is stable.

## Commit convention

Use clear, scoped commit messages:

```text
feat(extension): add visible element scanner
feat(planner): rank clickable candidates
fix(safety): block password-related actions
docs(readme): document local installation
test(planner): cover low-confidence results
refactor(api): extract planning service
```

## Practical rule

- Vitaly works primarily in `feature/vitaly-ui-extension`.
- Planner/backend work belongs in `feature/agent-planner-api`.
- Unstable experiments belong in `experiment/lab-click-flows`.
- Completed work is merged into `develop`.
- Tested milestones are promoted from `develop` to `main`.
