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
flatlog validate --strict            # Also enforce version match with package.json
flatlog validate --json              # Output results as JSON
flatlog get-version                  # Print the latest stable release version
flatlog get-release-notes            # Print bullet items for the latest release
flatlog get-release-notes <version>  # Print bullet items for a specific version
```

### Typical workflow

```bash
flatlog next                         # Start tracking the next version
flatlog bullet "Added: new feature"  # Add entries as you work
flatlog release 1.2.0                # Publish when ready
```

By default all commands target `CHANGELOG.md`. Use `--file` / `-f` to target a different file.

## Version format

Only `X.Y.Z` semver versions are supported.

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

## License

MIT
