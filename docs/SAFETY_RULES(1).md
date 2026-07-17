# ActionPilot Safety Rules

ActionPilot must operate as a visible, human-controlled browser assistant—not as a hidden automation bot.

These rules apply to the extension, local planner, backend planner, and every future execution layer.

## Non-negotiable requirements

Every executable action must satisfy all of the following conditions:

- The user instruction is visible.
- The proposed action is visible before execution.
- The target element is identifiable to the user.
- Execution requires explicit user confirmation.
- Actions run only on the active tab.
- Browser permissions remain as limited as possible.
- A low-confidence planner result does not trigger execution.
- Backend failure does not silently fall back to unsafe behavior.

## Blocked actions

ActionPilot must not automate:

- CAPTCHA solving or bypass
- Password entry
- 2FA or MFA flows
- Banking operations
- Payments, purchases, checkout, or money transfers
- Crypto wallet operations
- Account deletion
- Destructive bulk actions
- Hidden background clicking
- Unsupervised mass scraping
- Security-control bypass
- Actions intended to evade access restrictions
- Irreversible actions without a dedicated safety review

## Ambiguous instructions

When an instruction is unclear:

1. Show the most relevant candidates.
2. Explain why the planner is uncertain.
3. Ask the user to select the intended target.
4. Do not guess when the possible result is sensitive, destructive, or irreversible.
5. Return a structured low-confidence result when no candidate is reliable.

## Confirmation boundary

Planning and execution must remain separate.

The planner may:

- Inspect visible page metadata
- Rank visible candidates
- Propose an action
- Explain its reasoning
- Estimate confidence and risk

The planner must not:

- Execute the action directly
- Hide the proposed target
- Skip confirmation
- Treat high confidence as user permission
- Chain multiple actions without visible checkpoints

## Logging

Future versions may keep local action logs containing:

- Timestamp
- User instruction
- Selected element identifier
- Action type
- Planner confidence
- Risk classification
- Execution result

Logs must not store:

- Passwords
- Authentication tokens
- Payment data
- Private form contents
- Full sensitive page content
- Secret environment values

Logs should remain local unless the user explicitly enables another storage model.

## Permission policy

Every requested browser permission must have a documented purpose.

Before adding a permission:

1. Confirm that the current feature genuinely requires it.
2. Prefer a narrower alternative when available.
3. Document the reason in the pull request.
4. Review whether the permission expands access beyond the active tab.

## Safety review checklist

A safety-sensitive change is ready for review only when:

- The proposed action remains visible.
- Confirmation cannot be bypassed.
- Dangerous instruction categories remain blocked.
- Low-confidence behavior is safe.
- Failure states do not execute actions.
- No new sensitive data is logged.
- Any new permission is justified.
- Relevant tests or manual verification steps are included.

## Core rule

> The system may recommend an action. Vitaly—and every other user—retains control over whether that action is executed.
