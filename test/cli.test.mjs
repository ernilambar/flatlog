import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as fs from 'node:fs'
import { tmpdir } from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cliPath = path.join(__dirname, '..', 'bin', 'flatlog.js')

function runCli (args = [], opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [cliPath, ...args], {
      cwd: opts.cwd || path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d) => { stdout += d })
    proc.stderr.on('data', (d) => { stderr += d })
    proc.on('close', (code, signal) => {
      resolve({ code, signal, stdout, stderr })
    })
    proc.on('error', reject)
  })
}

function tmpTestDir (prefix) {
  const dir = path.join(tmpdir(), `flatlog-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

const VALID_CHANGELOG = `# Test Changelog

## 1.0.0 - 2024-01-01
- Initial release
`

const CHANGELOG_WITH_PLACEHOLDER = `# Test Changelog

## X.X.X - YYYY-MM-DD
- Added: Setup layout configuration tracking bounds.

## 1.0.0 - 2024-01-01
- Initial release
`

describe('config schema validation', () => {
  let testDir

  beforeEach(() => { testDir = tmpTestDir('config') })
  afterEach(() => { fs.rmSync(testDir, { recursive: true }) })

  it('warns on unknown config key and still validates successfully', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    fs.writeFileSync(path.join(testDir, '.flatlogrc.json'), JSON.stringify({ bulletSigns: '-' }))
    const result = await runCli(['validate'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    assert.match(result.stderr, /Unknown config key "bulletSigns"/)
  })

  it('warns on wrong-type config value and falls back to default', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    fs.writeFileSync(path.join(testDir, '.flatlogrc.json'), JSON.stringify({ maxLineLength: 'wide' }))
    const result = await runCli(['validate'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    assert.match(result.stderr, /maxLineLength.*expects number/)
  })

  it('accepts valid config overrides without warnings', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    fs.writeFileSync(path.join(testDir, '.flatlogrc.json'), JSON.stringify({ maxLineLength: 80 }))
    const result = await runCli(['validate'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    assert(!result.stderr.includes('Warning'))
  })

  it('falls back to defaults on malformed JSON and still validates', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    fs.writeFileSync(path.join(testDir, '.flatlogrc.json'), '{ not valid json')
    const result = await runCli(['validate'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    assert.match(result.stderr, /\.flatlogrc\.json is invalid/)
  })

  it('warns and falls back when versionPattern is missing required tokens', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    fs.writeFileSync(path.join(testDir, '.flatlogrc.json'), JSON.stringify({ versionPattern: '## {{version}}' }))
    const result = await runCli(['validate'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    assert.match(result.stderr, /must contain/)
  })

  it('warns and falls back when allowedPrefixes is empty', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    fs.writeFileSync(path.join(testDir, '.flatlogrc.json'), JSON.stringify({ allowedPrefixes: [] }))
    const result = await runCli(['validate'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    assert.match(result.stderr, /cannot be empty/)
  })

  it('warns and falls back when titlePattern is not a valid regex', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    fs.writeFileSync(path.join(testDir, '.flatlogrc.json'), JSON.stringify({ titlePattern: '[unterminated' }))
    const result = await runCli(['validate'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    assert.match(result.stderr, /not a valid regular expression/)
  })
})

describe('flatlog init', () => {
  let testDir

  beforeEach(() => { testDir = tmpTestDir('init') })
  afterEach(() => { fs.rmSync(testDir, { recursive: true }) })

  it('creates CHANGELOG.md and exits 0', async () => {
    const result = await runCli(['init'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    assert(fs.existsSync(path.join(testDir, 'CHANGELOG.md')))
  })

  it('created file contains title line', async () => {
    await runCli(['init'], { cwd: testDir })
    const content = fs.readFileSync(path.join(testDir, 'CHANGELOG.md'), 'utf8')
    assert.match(content, /^# .*Changelog/m)
  })

  it('created file contains placeholder line', async () => {
    await runCli(['init'], { cwd: testDir })
    const content = fs.readFileSync(path.join(testDir, 'CHANGELOG.md'), 'utf8')
    assert.match(content, /## X\.X\.X - YYYY-MM-DD/)
  })

  it('created file contains initial release header with today\'s local date', async () => {
    await runCli(['init'], { cwd: testDir })
    const content = fs.readFileSync(path.join(testDir, 'CHANGELOG.md'), 'utf8')
    const now = new Date()
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    assert(content.includes(`## 1.0.0 - ${localDate}`))
  })

  it('exits 1 if CHANGELOG.md already exists', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), 'existing')
    const result = await runCli(['init'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
    assert.match(result.stderr, /already exists/)
  })

  it('creates custom filename when specified', async () => {
    const result = await runCli(['init', '--file', 'CHANGES.md'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    assert(fs.existsSync(path.join(testDir, 'CHANGES.md')))
    assert(!fs.existsSync(path.join(testDir, 'CHANGELOG.md')))
  })
})

describe('flatlog validate', () => {
  let testDir

  beforeEach(() => { testDir = tmpTestDir('validate') })
  afterEach(() => { fs.rmSync(testDir, { recursive: true }) })

  it('exits 0 for valid changelog', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    const result = await runCli(['validate'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
  })

  it('exits 1 when file not found', async () => {
    const result = await runCli(['validate'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
  })

  it('exits 0 for changelog with placeholder', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), CHANGELOG_WITH_PLACEHOLDER)
    const result = await runCli(['validate'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
  })

  it('--json outputs valid JSON on success', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    const result = await runCli(['validate', '--json'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    const parsed = JSON.parse(result.stdout)
    assert.strictEqual(parsed.success, true)
    assert(Array.isArray(parsed.errors))
    assert(Array.isArray(parsed.warnings))
  })

  it('--json reports releasesChecked and topmostVersion', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    const result = await runCli(['validate', '--json'], { cwd: testDir })
    const parsed = JSON.parse(result.stdout)
    assert.strictEqual(parsed.metadata.releasesChecked, 1)
    assert.strictEqual(parsed.metadata.topmostVersion, '1.0.0')
  })

  it('--json reports errors for invalid file', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), 'not a valid changelog\n')
    const result = await runCli(['validate', '--json'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
    const parsed = JSON.parse(result.stdout)
    assert.strictEqual(parsed.success, false)
    assert(parsed.errors.length > 0)
  })

  it('--json reports file not found error', async () => {
    const result = await runCli(['validate', '--json'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
    const parsed = JSON.parse(result.stdout)
    assert.strictEqual(parsed.success, false)
    assert(parsed.errors.some(e => /not found/.test(e.message)))
  })

  it('exits 1 for indented bullet items', async () => {
    const indented = '# Test Changelog\n\n## 1.0.0 - 2024-01-01\n  - Initial release\n'
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), indented)
    const result = await runCli(['validate', '--json'], { cwd: testDir })
    const parsed = JSON.parse(result.stdout)
    assert.strictEqual(parsed.success, false)
    assert(parsed.errors.some(e => /[Ii]ndent/.test(e.message)))
  })

  it('exits 1 for duplicate version entries', async () => {
    const duped = '# Test Changelog\n\n## 1.0.0 - 2024-01-01\n- Initial release\n\n## 1.0.0 - 2024-01-01\n- Initial release\n'
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), duped)
    const result = await runCli(['validate', '--json'], { cwd: testDir })
    const parsed = JSON.parse(result.stdout)
    assert.strictEqual(parsed.success, false)
    assert(parsed.errors.some(e => /[Dd]uplicate|more than once/.test(e.message)))
    assert.strictEqual(parsed.metadata.releasesChecked, 1)
  })

  it('exits 1 for out-of-order versions', async () => {
    const outOfOrder = '# Test Changelog\n\n## 1.0.0 - 2024-01-01\n- Initial release\n\n## 2.0.0 - 2024-06-01\n- Added: Something new.\n'
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), outOfOrder)
    const result = await runCli(['validate', '--json'], { cwd: testDir })
    const parsed = JSON.parse(result.stdout)
    assert.strictEqual(parsed.success, false)
    assert(parsed.errors.some(e => /out of order/.test(e.message)))
  })

  it('exits 1 for an invalid calendar date', async () => {
    const badDate = '# Test Changelog\n\n## 1.0.0 - 2024-13-45\n- Initial release\n'
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), badDate)
    const result = await runCli(['validate', '--json'], { cwd: testDir })
    const parsed = JSON.parse(result.stdout)
    assert.strictEqual(parsed.success, false)
    assert(parsed.errors.some(e => /[Ii]nvalid date/.test(e.message)))
  })

  it('exits 0 for a valid calendar date', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    const result = await runCli(['validate', '--json'], { cwd: testDir })
    const parsed = JSON.parse(result.stdout)
    assert.strictEqual(parsed.success, true)
    assert(!parsed.errors.some(e => /calendar/.test(e.message)))
  })

  it('warns when date order contradicts version order', async () => {
    const hotfix = '# Test Changelog\n\n## 1.1.0 - 2024-06-01\n- Added: Feature.\n\n## 1.0.1 - 2024-06-15\n- Fixed: Hotfix.\n'
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), hotfix)
    const result = await runCli(['validate', '--json'], { cwd: testDir })
    const parsed = JSON.parse(result.stdout)
    assert.strictEqual(parsed.success, true)
    assert(parsed.warnings.some(w => /newer than/.test(w.message)))
  })

  it('does not warn when date order matches version order', async () => {
    const ordered = '# Test Changelog\n\n## 2.0.0 - 2024-06-01\n- Added: Feature.\n\n## 1.0.0 - 2024-01-01\n- Initial release\n'
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), ordered)
    const result = await runCli(['validate', '--json'], { cwd: testDir })
    const parsed = JSON.parse(result.stdout)
    assert.strictEqual(parsed.success, true)
    assert(!parsed.warnings.some(w => /contradicts/.test(w.message)))
  })

  it('--quiet suppresses output on success', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    const result = await runCli(['validate', '--quiet'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    assert.strictEqual(result.stdout.trim(), '')
    assert.strictEqual(result.stderr.trim(), '')
  })

  it('--quiet still prints errors on failure', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), 'not a valid changelog\n')
    const result = await runCli(['validate', '--quiet'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
    assert(result.stderr.length > 0)
  })

  it('--quiet still prints warnings on success', async () => {
    const hotfix = '# Test Changelog\n\n## 1.1.0 - 2024-06-01\n- Added: Feature.\n\n## 1.0.1 - 2024-06-15\n- Fixed: Hotfix.\n'
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), hotfix)
    const result = await runCli(['validate', '--quiet'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    assert(result.stderr.length > 0)
    assert.strictEqual(result.stdout.trim(), '')
  })

  it('exits 1 for unexpected content', async () => {
    const stray = '# Test Changelog\n\nStray text here.\n\n## 1.0.0 - 2024-01-01\n- Initial release\n'
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), stray)
    const result = await runCli(['validate', '--json'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
    const parsed = JSON.parse(result.stdout)
    assert(parsed.errors.some(e => /Unexpected content/.test(e.message)))
  })

  it('exits 1 for a bullet before any version header', async () => {
    const orphan = '# Test Changelog\n\n- Added: Orphan bullet.\n\n## 1.0.0 - 2024-01-01\n- Initial release\n'
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), orphan)
    const result = await runCli(['validate', '--json'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
    const parsed = JSON.parse(result.stdout)
    assert(parsed.errors.some(e => /before any version header/.test(e.message)))
  })

  it('exits 1 when the target path is not a file', async () => {
    fs.mkdirSync(path.join(testDir, 'CHANGELOG.md'))
    const result = await runCli(['validate'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
    assert.match(result.stderr, /is not a file/)
  })

  it('validates a changelog using CRLF line endings', async () => {
    const crlf = '# Test Changelog\r\n\r\n## 1.0.0 - 2024-01-01\r\n- Initial release\r\n'
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), crlf)
    const result = await runCli(['validate'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
  })
})

describe('flatlog bullet', () => {
  let testDir

  beforeEach(() => { testDir = tmpTestDir('bullet') })
  afterEach(() => { fs.rmSync(testDir, { recursive: true }) })

  it('exits 1 if changelog does not exist', async () => {
    const result = await runCli(['bullet', 'Fixed: typo'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
    assert.match(result.stderr, /does not exist/)
  })

  it('exits 1 if no bullet text given', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    const result = await runCli(['bullet'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
    assert.match(result.stderr, /Bullet text required/)
  })

  it('exits 1 if prefix is invalid', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), CHANGELOG_WITH_PLACEHOLDER)
    const result = await runCli(['bullet', 'Blah: typo'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
    assert.match(result.stderr, /Invalid prefix/)
  })

  it('exits 0 on success', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), CHANGELOG_WITH_PLACEHOLDER)
    const result = await runCli(['bullet', 'Fixed: typo'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
  })

  it('inserts placeholder block when none exists', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    await runCli(['bullet', 'Changed: something'], { cwd: testDir })
    const content = fs.readFileSync(path.join(testDir, 'CHANGELOG.md'), 'utf8')
    assert.match(content, /## X\.X\.X - YYYY-MM-DD/)
  })

  it('inserts correct bullet text under existing placeholder', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), CHANGELOG_WITH_PLACEHOLDER)
    await runCli(['bullet', 'Fixed: typo'], { cwd: testDir })
    const lines = fs.readFileSync(path.join(testDir, 'CHANGELOG.md'), 'utf8').split('\n')
    const placeholderIdx = lines.findIndex(l => l.includes('X.X.X'))
    assert.strictEqual(lines[placeholderIdx + 1], '- Fixed: typo')
  })

  it('preserves existing release entries after inserting', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    await runCli(['bullet', 'Added: new thing'], { cwd: testDir })
    const content = fs.readFileSync(path.join(testDir, 'CHANGELOG.md'), 'utf8')
    assert.match(content, /## 1\.0\.0 - 2024-01-01/)
    assert.match(content, /Initial release/)
  })
})

describe('flatlog release', () => {
  let testDir

  beforeEach(() => { testDir = tmpTestDir('release') })
  afterEach(() => { fs.rmSync(testDir, { recursive: true }) })

  it('exits 1 if no version argument given', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), CHANGELOG_WITH_PLACEHOLDER)
    const result = await runCli(['release'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
    assert.match(result.stderr, /Version argument required/)
  })

  it('exits 1 if file not found', async () => {
    const result = await runCli(['release', '1.1.0'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
    assert.match(result.stderr, /not found/)
  })

  it('exits 1 if no placeholder exists', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    const result = await runCli(['release', '2.0.0'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
    assert.match(result.stderr, /No placeholder found/)
  })

  it('exits 1 if version already exists', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), CHANGELOG_WITH_PLACEHOLDER)
    const result = await runCli(['release', '1.0.0'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
    assert.match(result.stderr, /already exists/)
  })

  it('exits 0 and prints new header on success', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), CHANGELOG_WITH_PLACEHOLDER)
    const result = await runCli(['release', '2.1.0'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    assert.match(result.stdout, /✔.*Released 2\.1\.0/)
    assert.match(result.stdout, /## 2\.1\.0 - \d{4}-\d{2}-\d{2}/)
  })

  it('replaces placeholder with versioned header in file', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), CHANGELOG_WITH_PLACEHOLDER)
    await runCli(['release', '2.1.0'], { cwd: testDir })
    const content = fs.readFileSync(path.join(testDir, 'CHANGELOG.md'), 'utf8')
    assert.doesNotMatch(content, /X\.X\.X/)
    assert.match(content, /## 2\.1\.0 - \d{4}-\d{2}-\d{2}/)
  })

  it('preserves existing bullets after promotion', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), CHANGELOG_WITH_PLACEHOLDER)
    await runCli(['release', '2.1.0'], { cwd: testDir })
    const content = fs.readFileSync(path.join(testDir, 'CHANGELOG.md'), 'utf8')
    assert.match(content, /Setup layout configuration tracking bounds/)
    assert.match(content, /## 1\.0\.0 - 2024-01-01/)
    assert.match(content, /Initial release/)
  })

  it('--dry-run prints modified content without writing file', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), CHANGELOG_WITH_PLACEHOLDER)
    const result = await runCli(['release', '2.1.0', '--dry-run'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    assert.match(result.stdout, /## 2\.1\.0 - \d{4}-\d{2}-\d{2}/)
    const content = fs.readFileSync(path.join(testDir, 'CHANGELOG.md'), 'utf8')
    assert.match(content, /## X\.X\.X - YYYY-MM-DD/)
  })
})

describe('flatlog bullet --dry-run', () => {
  let testDir

  beforeEach(() => { testDir = tmpTestDir('bullet-dry') })
  afterEach(() => { fs.rmSync(testDir, { recursive: true }) })

  it('prints modified content without writing file', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), CHANGELOG_WITH_PLACEHOLDER)
    const result = await runCli(['bullet', 'Fixed: typo', '--dry-run'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    assert.match(result.stdout, /- Fixed: typo/)
    const content = fs.readFileSync(path.join(testDir, 'CHANGELOG.md'), 'utf8')
    assert(!content.includes('Fixed: typo'))
  })
})

describe('flatlog next', () => {
  let testDir

  beforeEach(() => { testDir = tmpTestDir('next') })
  afterEach(() => { fs.rmSync(testDir, { recursive: true }) })

  it('exits 1 if changelog does not exist', async () => {
    const result = await runCli(['next'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
    assert.match(result.stderr, /not found/)
  })

  it('exits 1 if an unreleased block already exists', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), CHANGELOG_WITH_PLACEHOLDER)
    const result = await runCli(['next'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
    assert.match(result.stderr, /already exists/)
  })

  it('exits 0 and inserts an unreleased block after the title', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    const result = await runCli(['next'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    const lines = fs.readFileSync(path.join(testDir, 'CHANGELOG.md'), 'utf8').split('\n')
    const titleIdx = lines.findIndex(l => /^# /.test(l))
    assert.strictEqual(lines[titleIdx + 1], '')
    assert.match(lines[titleIdx + 2], /## X\.X\.X - YYYY-MM-DD/)
  })

  it('preserves existing release entries', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    await runCli(['next'], { cwd: testDir })
    const content = fs.readFileSync(path.join(testDir, 'CHANGELOG.md'), 'utf8')
    assert.match(content, /## 1\.0\.0 - 2024-01-01/)
    assert.match(content, /Initial release/)
  })

  it('--dry-run prints modified content without writing file', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    const result = await runCli(['next', '--dry-run'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    assert.match(result.stdout, /## X\.X\.X - YYYY-MM-DD/)
    const content = fs.readFileSync(path.join(testDir, 'CHANGELOG.md'), 'utf8')
    assert(!content.includes('X.X.X'))
  })
})

describe('flatlog get-version', () => {
  let testDir

  beforeEach(() => { testDir = tmpTestDir('version') })
  afterEach(() => { fs.rmSync(testDir, { recursive: true }) })

  it('prints topmost version and exits 0', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    const result = await runCli(['get-version'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    assert.strictEqual(result.stdout.trim(), '1.0.0')
  })

  it('returns the highest (topmost) version from multi-release changelog', async () => {
    const multi = '# Test Changelog\n\n## 2.0.0 - 2024-06-01\n- Added: New feature.\n\n## 1.0.0 - 2024-01-01\n- Initial release\n'
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), multi)
    const result = await runCli(['get-version'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    assert.strictEqual(result.stdout.trim(), '2.0.0')
  })

  it('exits 1 when no stable version exists', async () => {
    const placeholderOnly = '# Test Changelog\n\n## X.X.X - YYYY-MM-DD\n- Added: Setup.\n'
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), placeholderOnly)
    const result = await runCli(['get-version'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
  })

  it('exits 1 when file not found', async () => {
    const result = await runCli(['get-version'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
  })
})

describe('flatlog validate <version>', () => {
  let testDir

  beforeEach(() => { testDir = tmpTestDir('validate-version') })
  afterEach(() => { fs.rmSync(testDir, { recursive: true }) })

  it('exits 0 when topmost version matches given version', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    const result = await runCli(['validate', '1.0.0'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
  })

  it('exits 1 when topmost version does not match given version', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    const result = await runCli(['validate', '2.0.0'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
    assert.match(result.stderr, /[Mm]ismatch/)
  })

  it('exits 1 when placeholder is present and a version is given', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), CHANGELOG_WITH_PLACEHOLDER)
    const result = await runCli(['validate', '1.0.0'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
    assert.match(result.stderr, /[Uu]nreleased/)
  })

  it('--json reports version mismatch in errors', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    const result = await runCli(['validate', '9.9.9', '--json'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
    const parsed = JSON.parse(result.stdout)
    assert.strictEqual(parsed.success, false)
    assert(parsed.errors.some(e => /mismatch/.test(e.message)))
  })

  it('exits 1 for an invalid version argument', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    const result = await runCli(['validate', 'not-a-version'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
    assert.match(result.stderr, /Invalid version "not-a-version"/)
  })

  it('--json reports an invalid version argument', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    const result = await runCli(['validate', 'not-a-version', '--json'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
    const parsed = JSON.parse(result.stdout)
    assert.strictEqual(parsed.success, false)
    assert(parsed.errors.some(e => /Invalid version/.test(e.message)))
  })
})

describe('flatlog unknown command', () => {
  it('exits 1 with error message for unknown command', async () => {
    const result = await runCli(['foobar'])
    assert.strictEqual(result.code, 1)
    assert.match(result.stderr, /Unknown command/)
  })
})

describe('flatlog --help and --version', () => {
  it('--help exits 0 and prints usage', async () => {
    const result = await runCli(['--help'])
    assert.strictEqual(result.code, 0)
    assert.match(result.stdout, /Usage: flatlog/)
  })

  it('-h alias exits 0 and prints usage', async () => {
    const result = await runCli(['-h'])
    assert.strictEqual(result.code, 0)
    assert.match(result.stdout, /Usage: flatlog/)
  })

  it('help command exits 0 and prints usage', async () => {
    const result = await runCli(['help'])
    assert.strictEqual(result.code, 0)
    assert.match(result.stdout, /Usage: flatlog/)
  })

  it('--version exits 0 and prints a semver', async () => {
    const result = await runCli(['--version'])
    assert.strictEqual(result.code, 0)
    assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+$/)
  })

  it('-v alias exits 0 and prints a semver', async () => {
    const result = await runCli(['-v'])
    assert.strictEqual(result.code, 0)
    assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+$/)
  })
})

describe('flatlog unknown option', () => {
  let testDir

  beforeEach(() => { testDir = tmpTestDir('unknown-option') })
  afterEach(() => { fs.rmSync(testDir, { recursive: true }) })

  it('exits 1 with an error for an unknown flag', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    const result = await runCli(['validate', '--bogus'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
    assert.match(result.stderr, /Unknown option "--bogus"/)
  })
})

describe('flatlog --file / -f', () => {
  let testDir

  beforeEach(() => { testDir = tmpTestDir('file-flag') })
  afterEach(() => { fs.rmSync(testDir, { recursive: true }) })

  it('validate --file targets the given file', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGES.md'), VALID_CHANGELOG)
    const result = await runCli(['validate', '--file', 'CHANGES.md'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
  })

  it('validate -f targets the given file', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGES.md'), VALID_CHANGELOG)
    const result = await runCli(['validate', '-f', 'CHANGES.md'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
  })

  it('exits 1 when the given file is missing', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    const result = await runCli(['validate', '--file', 'CHANGES.md'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
    assert.match(result.stderr, /CHANGES\.md" not found/)
  })

  it('bullet writes to the given file and leaves the default untouched', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGES.md'), CHANGELOG_WITH_PLACEHOLDER)
    const result = await runCli(['bullet', 'Fixed: typo', '--file', 'CHANGES.md'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    const content = fs.readFileSync(path.join(testDir, 'CHANGES.md'), 'utf8')
    assert(content.includes('- Fixed: typo'))
    assert(!fs.existsSync(path.join(testDir, 'CHANGELOG.md')))
  })

  it('release writes to the file selected by -f', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGES.md'), CHANGELOG_WITH_PLACEHOLDER)
    const result = await runCli(['release', '2.0.0', '-f', 'CHANGES.md'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    const content = fs.readFileSync(path.join(testDir, 'CHANGES.md'), 'utf8')
    assert.match(content, /## 2\.0\.0 - \d{4}-\d{2}-\d{2}/)
    assert(!fs.existsSync(path.join(testDir, 'CHANGELOG.md')))
  })

  it('next writes to the file selected by --file', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGES.md'), VALID_CHANGELOG)
    const result = await runCli(['next', '--file', 'CHANGES.md'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    const content = fs.readFileSync(path.join(testDir, 'CHANGES.md'), 'utf8')
    assert(content.includes('## X.X.X - YYYY-MM-DD'))
    assert(!fs.existsSync(path.join(testDir, 'CHANGELOG.md')))
  })

  it('get-version reads from the file selected by --file', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGES.md'), VALID_CHANGELOG)
    const result = await runCli(['get-version', '--file', 'CHANGES.md'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    assert.strictEqual(result.stdout.trim(), '1.0.0')
  })

  it('get-release-notes reads from the file selected by --file', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGES.md'), VALID_CHANGELOG)
    const result = await runCli(['get-release-notes', '--file', 'CHANGES.md'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    assert.match(result.stdout, /Initial release/)
  })
})

describe('flatlog release semver validation', () => {
  let testDir

  beforeEach(() => { testDir = tmpTestDir('release-semver') })
  afterEach(() => { fs.rmSync(testDir, { recursive: true }) })

  it('exits 1 for non-semver version argument', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), CHANGELOG_WITH_PLACEHOLDER)
    const result = await runCli(['release', 'not-a-version'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
    assert.match(result.stderr, /[Ii]nvalid version/)
  })

  it('exits 1 for partial semver like "1.0"', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), CHANGELOG_WITH_PLACEHOLDER)
    const result = await runCli(['release', '1.0'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
    assert.match(result.stderr, /Invalid version "1\.0"/)
  })

  it('exits 0 for valid semver', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), CHANGELOG_WITH_PLACEHOLDER)
    const result = await runCli(['release', '1.1.0'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
  })
})

describe('flatlog get-release-notes', () => {
  let testDir

  beforeEach(() => { testDir = tmpTestDir('notes') })
  afterEach(() => { fs.rmSync(testDir, { recursive: true }) })

  it('prints release notes for latest version', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    const result = await runCli(['get-release-notes'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    assert.match(result.stdout, /Initial release/)
  })

  it('prints only notes for topmost version in multi-release changelog', async () => {
    const multi = '# Test Changelog\n\n## 2.0.0 - 2024-06-01\n- Added: New feature.\n\n## 1.0.0 - 2024-01-01\n- Initial release\n'
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), multi)
    const result = await runCli(['get-release-notes'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    assert.match(result.stdout, /New feature/)
    assert(!result.stdout.includes('Initial release'))
  })

  it('exits 1 when no stable version found', async () => {
    const placeholderOnly = '# Test Changelog\n\n## X.X.X - YYYY-MM-DD\n- Added: Setup.\n'
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), placeholderOnly)
    const result = await runCli(['get-release-notes'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
  })

  it('exits 1 when file not found', async () => {
    const result = await runCli(['get-release-notes'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
  })

  it('prints notes for a specific version argument', async () => {
    const multi = '# Test Changelog\n\n## 2.0.0 - 2024-06-01\n- Added: New feature.\n\n## 1.0.0 - 2024-01-01\n- Initial release\n'
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), multi)
    const result = await runCli(['get-release-notes', '1.0.0'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    assert.match(result.stdout, /Initial release/)
    assert(!result.stdout.includes('New feature'))
  })

  it('exits 1 when specified version is not found', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    const result = await runCli(['get-release-notes', '9.9.9'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
  })

  it('skips the placeholder and prints notes for the topmost release', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), CHANGELOG_WITH_PLACEHOLDER)
    const result = await runCli(['get-release-notes'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    assert.match(result.stdout, /Initial release/)
    assert(!result.stdout.includes('Setup layout configuration tracking bounds'))
  })
})

describe('flatlog date-first versionPattern', () => {
  let testDir

  const DATE_FIRST_CHANGELOG = `# Test Changelog

2026-07-23 - version 2.0.4
- Fixed: Something.
`

  const DATE_FIRST_WITH_PLACEHOLDER = `# Test Changelog

YYYY-MM-DD - version X.X.X
- Added: Setup.

2026-07-23 - version 2.0.4
- Fixed: Something.
`

  beforeEach(() => {
    testDir = tmpTestDir('date-first')
    fs.writeFileSync(path.join(testDir, '.flatlogrc.json'), JSON.stringify({ versionPattern: 'YYYY-MM-DD - version {{version}}' }))
  })
  afterEach(() => { fs.rmSync(testDir, { recursive: true }) })

  it('validate exits 0 when date placeholder comes before version placeholder', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), DATE_FIRST_CHANGELOG)
    const result = await runCli(['validate'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
  })

  it('validate reports invalid date, not invalid version, for a bad calendar date', async () => {
    const badDate = '# Test Changelog\n\n2024-13-45 - version 2.0.4\n- Fixed: Something.\n'
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), badDate)
    const result = await runCli(['validate', '--json'], { cwd: testDir })
    const parsed = JSON.parse(result.stdout)
    assert.strictEqual(parsed.success, false)
    assert(parsed.errors.some(e => /Invalid date: 2024-13-45/.test(e.message)))
  })

  it('get-version prints the version, not the date', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), DATE_FIRST_CHANGELOG)
    const result = await runCli(['get-version'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    assert.strictEqual(result.stdout.trim(), '2.0.4')
  })

  it('get-release-notes returns the correct release body', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), DATE_FIRST_CHANGELOG)
    const result = await runCli(['get-release-notes'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
    assert.match(result.stdout, /Fixed: Something/)
  })

  it('release exits 1 when the version already exists', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), DATE_FIRST_WITH_PLACEHOLDER)
    const result = await runCli(['release', '2.0.4'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
    assert.match(result.stderr, /already exists/)
  })
})
