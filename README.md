# flatlog

The Customizable, Flat Changelog Utility Belt.

## Installation

```bash
npm install -g @nilambar/flatlog
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
flatlog get-version                  # Print the latest stable release version
flatlog get-release-notes            # Print bullet items for the latest release
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

## Version format

Versions follow `X.Y.Z` semver, with optional `v` prefix and prerelease suffix (e.g. `v1.2.3-beta.1`).

## Configuration

Create a `.flatlogrc.json` in your project root to override any defaults:

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

## License

[MIT](LICENSE) © 2026 [Nilambar Sharma](https://www.nilambar.net)
