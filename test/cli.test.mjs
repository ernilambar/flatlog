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
- Initial release.
`

const CHANGELOG_WITH_PLACEHOLDER = `# Test Changelog

## X.X.X - YYYY-MM-DD
- Added: Setup layout configuration tracking bounds.

## 1.0.0 - 2024-01-01
- Initial release.
`

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

  it('created file contains initial release header with today\'s date', async () => {
    await runCli(['init'], { cwd: testDir })
    const content = fs.readFileSync(path.join(testDir, 'CHANGELOG.md'), 'utf8')
    assert.match(content, /## 1\.0\.0 - \d{4}-\d{2}-\d{2}/)
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

  it('uses package name in title when package.json present', async () => {
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({ name: 'my-project' }))
    await runCli(['init'], { cwd: testDir })
    const content = fs.readFileSync(path.join(testDir, 'CHANGELOG.md'), 'utf8')
    assert.match(content, /# My Project Changelog/)
  })

  it('falls back to generic title when package.json has no name', async () => {
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({ version: '1.0.0' }))
    await runCli(['init'], { cwd: testDir })
    const content = fs.readFileSync(path.join(testDir, 'CHANGELOG.md'), 'utf8')
    assert.match(content, /# Changelog/)
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
    const indented = '# Test Changelog\n\n## 1.0.0 - 2024-01-01\n  - Initial release.\n'
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), indented)
    const result = await runCli(['validate', '--json'], { cwd: testDir })
    const parsed = JSON.parse(result.stdout)
    assert.strictEqual(parsed.success, false)
    assert(parsed.errors.some(e => /indentation/.test(e.message)))
  })

  it('exits 1 for duplicate version entries', async () => {
    const duped = '# Test Changelog\n\n## 1.0.0 - 2024-01-01\n- Initial release.\n\n## 1.0.0 - 2024-01-01\n- Initial release.\n'
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), duped)
    const result = await runCli(['validate', '--json'], { cwd: testDir })
    const parsed = JSON.parse(result.stdout)
    assert.strictEqual(parsed.success, false)
    assert(parsed.errors.some(e => /[Dd]uplicate/.test(e.message)))
  })

  it('exits 1 for out-of-order versions', async () => {
    const outOfOrder = '# Test Changelog\n\n## 1.0.0 - 2024-01-01\n- Initial release.\n\n## 2.0.0 - 2024-06-01\n- Added: Something new.\n'
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), outOfOrder)
    const result = await runCli(['validate', '--json'], { cwd: testDir })
    const parsed = JSON.parse(result.stdout)
    assert.strictEqual(parsed.success, false)
    assert(parsed.errors.some(e => /[Cc]hronological|ordering/.test(e.message)))
  })
})

describe('flatlog add', () => {
  let testDir

  beforeEach(() => { testDir = tmpTestDir('add') })
  afterEach(() => { fs.rmSync(testDir, { recursive: true }) })

  it('exits 1 if changelog does not exist', async () => {
    const result = await runCli(['add'], { cwd: testDir })
    assert.strictEqual(result.code, 1)
    assert.match(result.stderr, /does not exist/)
  })

  it('exits 0 on success', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    const result = await runCli(['add'], { cwd: testDir })
    assert.strictEqual(result.code, 0)
  })

  it('inserts placeholder block when none exists', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    await runCli(['add'], { cwd: testDir })
    const content = fs.readFileSync(path.join(testDir, 'CHANGELOG.md'), 'utf8')
    assert.match(content, /## X\.X\.X - YYYY-MM-DD/)
  })

  it('adds bullet line under existing placeholder', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), CHANGELOG_WITH_PLACEHOLDER)
    await runCli(['add'], { cwd: testDir })
    const lines = fs.readFileSync(path.join(testDir, 'CHANGELOG.md'), 'utf8').split('\n')
    const placeholderIdx = lines.findIndex(l => l.includes('X.X.X'))
    assert(lines[placeholderIdx + 1].startsWith('- Added: '))
  })

  it('preserves existing release entries after adding', async () => {
    fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), VALID_CHANGELOG)
    await runCli(['add'], { cwd: testDir })
    const content = fs.readFileSync(path.join(testDir, 'CHANGELOG.md'), 'utf8')
    assert.match(content, /## 1\.0\.0 - 2024-01-01/)
    assert.match(content, /Initial release/)
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
    const multi = '# Test Changelog\n\n## 2.0.0 - 2024-06-01\n- Added: New feature.\n\n## 1.0.0 - 2024-01-01\n- Initial release.\n'
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
    const multi = '# Test Changelog\n\n## 2.0.0 - 2024-06-01\n- Added: New feature.\n\n## 1.0.0 - 2024-01-01\n- Initial release.\n'
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
    const multi = '# Test Changelog\n\n## 2.0.0 - 2024-06-01\n- Added: New feature.\n\n## 1.0.0 - 2024-01-01\n- Initial release.\n'
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
})
