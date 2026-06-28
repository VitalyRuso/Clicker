# Browser Clicker Agent

A user-controlled browser automation assistant.

The extension scans the currently active tab, shows visible clickable elements, proposes a safe action, and executes it only after explicit user confirmation.

## Stack

- Browser extension: Vite + TypeScript + Chrome Manifest V3
- Future planner/backend: Rust + Axum
- First target browser: Chrome / Chromium / Edge
- Product language: English first, translations later

## Repository layout

```text
apps/
  extension/   Chrome MV3 extension UI, page scanner, local planner and executor
  agent-api/   Rust Axum API scaffold for future agent/planner logic
docs/          Product plan, branch strategy, safety rules and task board
scripts/       Git helper scripts
```

## First local run: extension

```bash
cd apps/extension
npm install
npm run build
```

Then open Chrome or Edge:

```text
chrome://extensions
Developer mode: ON
Load unpacked
Select: apps/extension/dist
```

## First manual test

1. Open any normal website, for example a local HTML page or a simple documentation page.
2. Open the extension popup.
3. Click **Scan page**.
4. Type an instruction like: `Click the login button`.
5. Click **Plan action**.
6. Review the proposed action.
7. Click **Execute confirmed action** only if the plan is correct.

## Future local run: Rust API

```bash
cargo run --manifest-path apps/agent-api/Cargo.toml
```

Test:

```bash
curl http://127.0.0.1:8080/health
```

## Safety principle

The product must behave as a visible assistant, not as a hidden bot. It must not bypass CAPTCHA, automate payments, type passwords, delete accounts, or perform irreversible actions without explicit confirmation.
