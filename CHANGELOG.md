# flatlog Changelog

## 2.0.0 - 2026-09-12
- Added: `--stable` flag for `get-version` and `get-release-notes`
- Changed: version validation now follows SemVer 2.0.0 strictly
- Changed: invalid versions are now rejected
- Changed: `release` rejects a version older than the current release
- Changed: running `flatlog` with no command now exits with an error instead of implicitly validating
- Fixed: `v`-prefixed and unprefixed versions are treated as the same release

## 1.0.4 - 2026-08-02
- Fixed: version/date swap when `versionPattern` places the date before `{{version}}`

## 1.0.3 - 2026-08-02
- Added: `--help`/`-h` and `--version`/`-v` short aliases
- Added: error when target changelog path exists but is not a file
- Added: `CHANGELOG_GUIDE.md` reference for AI agents writing changelog entries
- Changed: `validate` accepts a positional `<version>`
- Changed: unknown CLI flags now exit with an error

## 1.0.2 - 2026-07-13
- Added: accept `v` prefix and prerelease suffix in version headers
- Added: support `--dry-run` for `next` command

## 1.0.1 - 2026-06-10
- Added: `next command` to open a new unreleased
- Fixed: simplified error and warning messages

## 1.0.0 - 2026-06-10
- Initial release
