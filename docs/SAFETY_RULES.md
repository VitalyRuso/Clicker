# Safety rules

The extension must be a visible user assistant, not a hidden bot.

## Always required

- User instruction must be visible.
- Proposed action must be visible before execution.
- Execution requires explicit user confirmation.
- Actions run only on the active tab.
- The extension should use minimum permissions.

## Blocked actions

The extension must not automate:

- CAPTCHA solving or CAPTCHA bypass.
- Password entry.
- 2FA / MFA flows.
- Banking operations.
- Payments, purchases or checkout.
- Crypto wallet operations.
- Account deletion.
- Destructive bulk actions.
- Hidden background clicking.
- Mass scraping without user control.

## Ambiguous instructions

If the instruction is unclear:

- Show candidates.
- Ask the user to choose.
- Do not guess if the result could be risky.

## Logs

Future versions should keep local logs:

- instruction;
- selected element;
- action type;
- result;
- timestamp.

No sensitive values should be stored in logs.
