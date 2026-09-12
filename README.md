# flatlog

The Customizable, Flat Changelog Utility Belt.

[![npm version](https://img.shields.io/npm/v/@nilambar/flatlog)](https://www.npmjs.com/package/@nilambar/flatlog)
[![CI](https://github.com/ernilambar/flatlog/actions/workflows/ci.yml/badge.svg)](https://github.com/ernilambar/flatlog/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/github/license/ernilambar/flatlog)](LICENSE)

## Requirements

Node.js >= 22.

## Installation

```bash
npm install -g @nilambar/flatlog
```

Or with pnpm/yarn:

```bash
pnpm add -g @nilambar/flatlog
yarn global add @nilambar/flatlog
```

No install, run once:

```bash
npx @nilambar/flatlog init
```

## Usage

```bash
flatlog init                         # Generate CHANGELOG.md
flatlog bullet "Fixed: typo"         # Insert a bullet item under the active placeholder
flatlog release <version>            # Promote placeholder to a versioned release header
flatlog next                         # Add a new unreleased block (use this after a release)
flatlog validate                     # Audit changelog structure
flatlog validate <version>           # Also enforce topmost version matches <version>
flatlog validate --json              # Output results as JSON
flatlog get-version                  # Print the topmost released version
flatlog get-version --stable         # Same, but ignore prereleases
flatlog get-release-notes            # Print bullet items for the latest release
flatlog get-release-notes --stable   # Print bullet items for the latest stable release
flatlog get-release-notes <version>  # Print bullet items for a specific version
flatlog --version, -v                # Print flatlog version
flatlog --help, -h                   # Show usage help
```

### Typical workflow

```bash
flatlog next                         # Start tracking the next version
flatlog bullet "Added: new feature"  # Add entries as you work
flatlog release 1.2.0                # Publish when ready
```

By default all commands target `CHANGELOG.md`. Use `--file` / `-f` to target a different file.

## Exit codes

All commands exit `0` on success and `1` on failure.

| Command | Exits `1` when |
| --- | --- |
| `init` | the target file already exists, or it cannot be written |
| `bullet` | the file is missing, no bullet text is given, or the prefix is not in `allowedPrefixes` |
| `release` | the file is missing, `<version>` is invalid, already listed, or older than the current release, or no placeholder exists |
| `next` | the file is missing, or an unreleased block already exists |
| `validate` | any validation error is found |
| `get-version` | no released version exists, or no stable release exists with `--stable` |
| `get-release-notes` | the requested version (or any release) is not found |
| any | no command is given, the command or an option is unknown, or a recognized option is not supported by the command |

## JSON output

`flatlog validate --json` prints a machine-readable report to stdout.

```json
{
  "success": true,
  "errors": [],
  "warnings": [],
  "metadata": {
    "releasesChecked": 2,
    "topmostVersion": "1.0.4"
  }
}
```

Failures use the same shape with `success: false` and populated `errors`:

```json
{
  "success": false,
  "errors": [{ "line": 7, "message": "Invalid prefix. Allowed: Added:, Changed:, Fixed:" }],
  "warnings": [{ "line": 12, "message": "Line too long (135 chars, max 120)." }],
  "metadata": { "releasesChecked": 2, "topmostVersion": "1.0.4" }
}
```

Each entry in `errors` and `warnings` carries a `line` (1-based; `0` for file-level issues) and a `message`. When the target file does not exist, the JSON output contains only `success`, `errors`, and `warnings` — no `metadata`.

## Version format

Versions follow strict [SemVer 2.0.0](https://semver.org/): `X.Y.Z`, with an optional `v` prefix, an optional prerelease suffix (e.g. `v1.2.3-beta.1`), and optional build metadata (e.g. `1.2.3+build.1`). Invalid versions — leading zeros, `_`, or empty identifiers — are rejected.

Ordering is SemVer precedence: newest release first, and prerelease identifiers compared per spec (`1.0.0-beta.10` is newer than `1.0.0-beta.2`). A `v` prefix is ignored for comparison, so `v1.0.0` and `1.0.0` are the same release. Output commands (`get-version`, `validate --json`) preserve the version exactly as written in the changelog, including build metadata.

By default `get-version` and `get-release-notes` select the **topmost** release — prereleases included, so you always get the release you just cut. Pass `--stable` to select the highest non-prerelease release instead (`get-version --stable` exits `1` if the changelog has only prereleases).

## Configuration

Copy the shipped `.flatlogrc.json` example into your project root, then customize any defaults:

```json
{
  "titlePattern": "^# .*Changelog$",
  "versionPattern": "## {{version}} - YYYY-MM-DD",
  "bulletSign": "- ",
  "allowedPrefixes": ["Added:", "Changed:", "Fixed:"],
  "initialReleaseText": "Initial release",
  "maxLineLength": 120
}
```

## AI agents

Point your AI agent at [CHANGELOG_GUIDE.md](CHANGELOG_GUIDE.md) (also shipped in `node_modules/@nilambar/flatlog/`) before it writes changelog entries — it documents the format `flatlog validate` enforces, with a worked example and an error-to-fix table.

## Development

Requires Node.js >= 22. There is no build step — the CLI entry point is `bin/flatlog.js` (CommonJS).

```bash
npm ci          # install dependencies
npm run lint    # lint with eslint (neostandard)
npm run format  # auto-fix lint issues
npm test        # run tests with node --test
```

Both `npm run lint` and `npm test` must pass before a change is ready. Bug reports and pull requests are welcome via the [issue tracker](https://github.com/ernilambar/flatlog/issues).

## License

[MIT](LICENSE) © 2026 [Nilambar Sharma](https://www.nilambar.net)
