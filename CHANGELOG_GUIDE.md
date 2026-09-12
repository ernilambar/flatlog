# Changelog Guide (for AI agents)

This project's `CHANGELOG.md` is checked by [flatlog](https://github.com/ernilambar/flatlog) — `flatlog validate` (often run in CI or a pre-commit hook). Follow this guide before adding or editing entries so validation passes on the first try.

## 0. Check for project overrides first

If a `.flatlogrc.json` exists in the repo root, its values override the defaults below — read it first and follow it instead. Only fall back to the defaults in this guide if no `.flatlogrc.json` is present.

## 1. Default rules

| Rule | Default |
|---|---|
| Title line (must appear exactly once, at the top) | matches `^# .*Changelog$`, e.g. `# Changelog` |
| Version header format | `## X.Y.Z - YYYY-MM-DD` (strict SemVer 2.0.0; optional `v` prefix, prerelease, build metadata) |
| Version order | newest first by SemVer precedence, no duplicates |
| Unreleased block (if any) | must be the topmost block, using literal placeholder `## X.X.X - YYYY-MM-DD` |
| Bullet prefix | line starts with `- ` followed by one of `Added:`, `Changed:`, `Fixed:` |
| First release exception | its sole bullet may instead read exactly `- Initial release` |
| Bullets | flat — never indented, never nested |
| Version headers | flat — never indented |
| Line length | ≤ 120 characters (warning, not a hard error) |
| Extra content | anything that isn't the title, a version header, the placeholder, or a bullet fails validation |

## 2. Valid example (default config)

Published state, no unreleased work pending:

```md
# Changelog

## 1.1.0 - 2026-02-10
- Added: support for custom output directory
- Fixed: crash when config file is missing

## 1.0.0 - 2026-01-05
- Initial release
```

With an active unreleased block (topmost, literal placeholder text — not a real date):

```md
# Changelog

## X.X.X - YYYY-MM-DD
- Added: `--dry-run` flag to preview changes

## 1.1.0 - 2026-02-10
- Added: support for custom output directory
- Fixed: crash when config file is missing

## 1.0.0 - 2026-01-05
- Initial release
```

## 3. Common validation errors and fixes

| Error message | Fix |
|---|---|
| `File must start with a valid title.` | First non-blank line must match the title pattern. |
| `Duplicate title found.` | Only one title line allowed. |
| `Unreleased block must be at the top of the changelog.` | Move the `## X.X.X - YYYY-MM-DD` block above all versioned headers. |
| `Invalid date: ...` | Use a real, parseable `YYYY-MM-DD` date in version headers. |
| `Version X is listed more than once.` | Remove or merge the duplicate version header. |
| `Version X is out of order (should come before Y).` | Sort version headers newest to oldest. |
| `Bullet found before any version header.` | Bullets must sit under a version header (or the unreleased placeholder), never above it. |
| `Invalid prefix. Allowed: ...` | Start the bullet with one of the allowed prefixes, or use the exact initial-release text for the first release. |
| `Indented bullets are not allowed. Use flat lists only.` | Remove leading whitespace/tabs before `- `. |
| `Indented version headers are not allowed. Use flat headers only.` | Remove leading whitespace before `##`. |
| `Unexpected content.` | Delete stray lines — only the title, version headers, the placeholder, and bullets are allowed. |
| `Line too long (N chars, max 120).` | Shorten the bullet text (warning only, won't fail validation on its own). |

## 4. Pre-flight checklist

Before running `flatlog validate`:

- [ ] Checked for `.flatlogrc.json` and used its config, if present
- [ ] Title line present once, at the top
- [ ] Unreleased block (if any) is topmost
- [ ] Version headers are newest-first, unique, with valid dates
- [ ] Every bullet starts with `- ` + an allowed prefix (or is the initial-release line)
- [ ] No indented bullets or version headers, no stray lines
