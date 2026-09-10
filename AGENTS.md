# AGENTS.md

## Overview

flatlog is a customizable flat changelog CLI utility written in Node.js (CommonJS). It manages CHANGELOG.md files with strict structural validation, supporting commands like `init`, `bullet`, `release`, `next`, and `validate`.

## Setup

```bash
npm ci
```

Requires Node.js >= 22.

## Commands

```bash
npm run lint        # Lint with eslint (neostandard config)
npm run format      # Auto-fix lint issues
npm test            # Run tests with node --test
```

There is no build step (plain Node.js, no compilation) and no type checker (plain JS, not TypeScript).

## Conventions

- **CommonJS only** — use `require()` / `module.exports`, never `import` / `export`.
- **Tabs for indentation** in `.js` files (spaces only in `.md`, `.json`, `.yml`).
- **Standard JS style** — no semicolons, single quotes, no trailing commas.
- **Entry point** is `bin/flatlog.js`; keep CLI argument parsing there.
- **Configuration** is loaded from `.flatlogrc.json` if present — never hardcode defaults that users can override.

## Quality Gate

Run and verify exit code 0 before declaring any task complete:

```bash
npm run lint
npm test
```

All code must pass `eslint` with zero errors before shipping.
