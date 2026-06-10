# flatlog

The Customizable, Flat Changelog Utility Belt.

## Installation

```bash
npm install -g @nilambar/flatlog
```

## Usage

```bash
flatlog init                  # Generate CHANGELOG.md
flatlog add                   # Insert a bullet item under the active placeholder
flatlog validate              # Audit changelog structure
flatlog validate --strict     # Also enforce version match with package.json
flatlog validate --json       # Output results as JSON
flatlog get-version           # Print the latest stable release version
flatlog get-release-notes     # Print bullet items for the latest release
```

By default all commands target `CHANGELOG.md`. Pass a filename as an argument to override.

## Configuration

On `init`, a `.flatlogrc.json` is created in the project root. Override any defaults:

```json
{
  "titlePattern": "^# .*Changelog$",
  "versionPattern": "## {{version}} - YYYY-MM-DD",
  "bulletSign": "- ",
  "allowedPrefixes": ["Added:", "Changed:", "Fixed:"],
  "initialReleaseText": "Initial release.",
  "maxLineLength": 120
}
```

## License

MIT
