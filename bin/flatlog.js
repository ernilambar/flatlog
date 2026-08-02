#!/usr/bin/env node

/**
 * flatlog - The Customizable, Flat Changelog Utility Belt
 * Commands:
 * - init                         : Generates a baseline configuration and CHANGELOG.md.
 * - add                          : Intelligently inserts a placeholder block or an active bullet item.
 * - validate [<version>] [--json] : Audits structural integrity, layout conventions, and rules.
 * - get-version                  : Extracts the highest parsed stable release version string.
 * - get-release-notes            : Isolates markdown bullet content for the latest release.
 */

const fs = require('fs')
const path = require('path')
const minimist = require('minimist')

// 1. Core Default Configuration Matrix
const defaultConfig = {
  titlePattern: '^# .*Changelog$',
  versionPattern: '## {{version}} - YYYY-MM-DD',
  bulletSign: '- ',
  allowedPrefixes: ['Added:', 'Changed:', 'Fixed:'],
  initialReleaseText: 'Initial release',
  maxLineLength: 120
}

// 2. Load Configuration Overrides if Present
const configSchema = {
  titlePattern: 'string',
  versionPattern: 'string',
  bulletSign: 'string',
  allowedPrefixes: 'array',
  initialReleaseText: 'string',
  maxLineLength: 'number'
}

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RESET = '\x1b[0m'

let config = { ...defaultConfig }
const configPath = path.resolve(process.cwd(), '.flatlogrc.json')
if (fs.existsSync(configPath)) {
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    const validated = {}
    for (const [key, value] of Object.entries(raw)) {
      if (!(key in configSchema)) {
        console.warn(`${YELLOW}Warning: Unknown config key "${key}". Ignored.${RESET}`)
        continue
      }
      const expected = configSchema[key]
      const actual = Array.isArray(value) ? 'array' : typeof value
      if (actual !== expected) {
        console.warn(`${YELLOW}Warning: Config "${key}" expects ${expected}, got ${actual}. Using default.${RESET}`)
        continue
      }
      if (key === 'allowedPrefixes' && value.length === 0) {
        console.warn(`${YELLOW}Warning: Config "allowedPrefixes" cannot be empty. Using default.${RESET}`)
        continue
      }
      if (key === 'versionPattern' && (!value.includes('{{version}}') || !value.includes('YYYY-MM-DD'))) {
        console.warn(`${YELLOW}Warning: Config "versionPattern" must contain "{{version}}" and "YYYY-MM-DD". Using default.${RESET}`)
        continue
      }
      validated[key] = value
    }
    config = { ...defaultConfig, ...validated }
  } catch (e) {
    console.warn(`${YELLOW}Warning: .flatlogrc.json is invalid. Using defaults.${RESET}`)
  }
}

// 3. Process CLI Parameters
const argv = minimist(process.argv.slice(2), {
  boolean: ['json', 'quiet', 'dry-run', 'help', 'version'],
  string: ['file'],
  alias: { f: 'file', h: 'help', v: 'version' }
})

const knownFlags = new Set(['_', 'json', 'quiet', 'dry-run', 'help', 'version', 'file', 'f', 'h', 'v'])
const unknownFlag = Object.keys(argv).find(key => !knownFlags.has(key))
if (unknownFlag) {
  console.error(`${RED}Error: Unknown option "--${unknownFlag}". Run "flatlog --help" for usage.${RESET}`)
  process.exit(1)
}

const command = argv._[0]

const isJsonMode = argv.json
const isQuiet = argv.quiet
const isDryRun = argv['dry-run']
const positionalArgs = argv._

if (argv.version) {
  const pkg = require('../package.json')
  console.log(pkg.version)
  process.exit(0)
}

if (argv.help || command === 'help') {
  console.log(`
Usage: flatlog <command> [options]

Commands:
  init                   Create a new changelog
  bullet "<Prefix: text>" Insert a bullet item (e.g. "Fixed: typo")
  release <version>      Promote placeholder to a versioned release header
  next                   Add a new unreleased block (use this after a release)
  validate [<version>]   Validate changelog structure. If <version> is given,
                          also enforce the topmost version matches it
  get-version            Print the topmost stable version
  get-release-notes      Print bullet notes for the latest release
  get-release-notes <v>  Print bullet notes for a specific version

Options:
  --file, -f <file>      Target changelog file (default: CHANGELOG.md)
  --json                 Output results as JSON (validate only)
  --quiet                Suppress output on success (validate only)
  --dry-run              Preview changes without writing (bullet, release, next)
  --version, -v          Print flatlog version
  --help, -h             Show this help message
`.trim())
  process.exit(0)
}

// --- INTELLIGENT COMPILER ENGINE FOR VERSION PLACEHOLDERS ---
const today = new Date().toISOString().split('T')[0]
const escapeRegex = (str) => str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

const versionPart = 'v?\\d+(?:\\.\\d+)+(?:-[\\w.]+)?'
const versionInputRegex = new RegExp(`^${versionPart}$`)

const compareVersions = (a, b) => {
  const parse = (v) => {
    const [core, pre] = v.replace(/^v/, '').split(/-(.+)/)
    return { nums: core.split('.').map(Number), pre: pre || null }
  }
  const pa = parse(a)
  const pb = parse(b)
  const len = Math.max(pa.nums.length, pb.nums.length)
  for (let i = 0; i < len; i++) {
    const x = pa.nums[i] ?? 0
    const y = pb.nums[i] ?? 0
    if (x !== y) return x - y
  }
  if (!pa.pre && pb.pre) return 1
  if (pa.pre && !pb.pre) return -1
  if (pa.pre === pb.pre) return 0
  return pa.pre < pb.pre ? -1 : 1
}

const universalToken = 'X.X.X'

// Generate the literal placeholder line (keeps YYYY-MM-DD untouched as structural text)
const livePlaceholderText = config.versionPattern.replace('{{version}}', universalToken)

const assembledInitialRelease = `${config.bulletSign}${config.initialReleaseText}`

// Compile high-fidelity regular expressions for tracking/validation loops
const escapedPattern = escapeRegex(config.versionPattern)
const compiledVersionRegex = new RegExp(`^${escapedPattern.replace('YYYY\\-MM\\-DD', '(\\d{4}-\\d{2}-\\d{2})').replace('\\{\\{version\\}\\}', `(${versionPart})`)}$`)
const compiledPlaceholderRegex = new RegExp(`^${escapedPattern.replace('\\{\\{version\\}\\}', escapeRegex(universalToken))}$`)

const titleRegex = new RegExp(config.titlePattern)
const prefixEscaped = config.allowedPrefixes.map(escapeRegex).join('|')
const bulletEscaped = escapeRegex(config.bulletSign)
const validationRegex = new RegExp(`^${bulletEscaped}(${prefixEscaped})\\s.*$`)

const knownCommands = ['init', 'bullet', 'release', 'next', 'validate', 'get-version', 'get-release-notes']
if (command && !knownCommands.includes(command)) {
  console.error(`${RED}Error: Unknown command "${command}". Run "flatlog --help" for usage.${RESET}`)
  process.exit(1)
}

// --- COMMAND: INIT ---
if (command === 'init') {
  const targetFile = argv.file || 'CHANGELOG.md'
  const destinationPath = path.resolve(process.cwd(), targetFile)

  if (fs.existsSync(destinationPath)) {
    console.error(`${RED}Error: A file named "${targetFile}" already exists.${RESET}`)
    process.exit(1)
  }

  const customTitle = 'Changelog'
  const initialVersion = '1.0.0'

  const liveInitialReleaseHeader = config.versionPattern
    .replace('{{version}}', initialVersion)
    .replace('YYYY-MM-DD', today)

  const boilerplate = `# ${customTitle}

${livePlaceholderText}

${liveInitialReleaseHeader}
${assembledInitialRelease}
`

  try {
    fs.writeFileSync(destinationPath, boilerplate, 'utf8')
    console.log(`\n${GREEN}✔ Success:${RESET} Spawned clean "${targetFile}"!`)
    process.exit(0)
  } catch (error) {
    console.error(`${RED}Error: Failed to write file. ${error.message}${RESET}`)
    process.exit(1)
  }
}

// --- RESOLVE TARGET FILE FOR REMAINING ENGINE ACTIONS ---
const isExplicitCmd = ['validate', 'bullet', 'release', 'get-version', 'get-release-notes'].includes(command)
if (isExplicitCmd) {
  positionalArgs.shift()
}

const targetFile = argv.file || 'CHANGELOG.md'
const filePath = path.resolve(process.cwd(), targetFile)

if (fs.existsSync(filePath) && !fs.statSync(filePath).isFile()) {
  console.error(`${RED}Error: "${targetFile}" is not a file.${RESET}`)
  process.exit(1)
}

// --- COMMAND: BULLET ---
if (command === 'bullet') {
  if (!fs.existsSync(filePath)) {
    console.error(`${RED}Error: "${targetFile}" does not exist. Run "flatlog init" first.${RESET}`)
    process.exit(1)
  }

  const bulletText = positionalArgs[0]
  if (!bulletText) {
    console.error(`${RED}Error: Bullet text required. Usage: flatlog bullet "Fixed: typo"${RESET}`)
    process.exit(1)
  }

  const bulletLine = `${config.bulletSign}${bulletText}`
  if (!validationRegex.test(bulletLine)) {
    console.error(`${RED}Error: Invalid prefix. Allowed: ${config.allowedPrefixes.join(', ')}${RESET}`)
    process.exit(1)
  }

  const fileContent = fs.readFileSync(filePath, 'utf8')
  const fileLines = fileContent.split(/\r?\n/)

  const placeholderIdx = fileLines.findIndex(line => compiledPlaceholderRegex.test(line.trim()))

  if (placeholderIdx !== -1) {
    fileLines.splice(placeholderIdx + 1, 0, bulletLine)
  } else {
    const titleIdx = fileLines.findIndex(line => titleRegex.test(line.trim()))
    const injectionBlock = ['', livePlaceholderText, bulletLine]
    const targetInsertIdx = titleIdx !== -1 ? titleIdx + 1 : 0
    fileLines.splice(targetInsertIdx, 0, ...injectionBlock)
  }

  if (isDryRun) {
    process.stdout.write(fileLines.join('\n'))
  } else {
    fs.writeFileSync(filePath, fileLines.join('\n'), 'utf8')
    console.log(`${GREEN}✔${RESET} Bullet added.`)
  }
  process.exit(0)
}

// --- COMMAND: RELEASE ---
if (command === 'release') {
  const releaseVersion = positionalArgs[0]
  if (!releaseVersion) {
    console.error(`${RED}Error: Version argument required. Usage: flatlog release <version>${RESET}`)
    process.exit(1)
  }

  if (!versionInputRegex.test(releaseVersion)) {
    console.error(`${RED}Error: Invalid version "${releaseVersion}". Expected format: X.Y.Z (optionally prefixed with "v" or suffixed with prerelease, e.g. v1.2.3-beta.1)${RESET}`)
    process.exit(1)
  }

  if (!fs.existsSync(filePath)) {
    console.error(`${RED}Error: "${targetFile}" not found. Run "flatlog init" first.${RESET}`)
    process.exit(1)
  }

  const releaseContent = fs.readFileSync(filePath, 'utf8')
  const releaseLines = releaseContent.split(/\r?\n/)

  const placeholderIdx = releaseLines.findIndex(line => compiledPlaceholderRegex.test(line.trim()))
  if (placeholderIdx === -1) {
    console.error(`${RED}Error: No placeholder found. Add a placeholder block first.${RESET}`)
    process.exit(1)
  }

  const alreadyExists = releaseLines.some(line => {
    const m = line.trim().match(compiledVersionRegex)
    return m && m[1] === releaseVersion
  })
  if (alreadyExists) {
    console.error(`${RED}Error: Version ${releaseVersion} already exists in "${targetFile}".${RESET}`)
    process.exit(1)
  }

  const newHeader = config.versionPattern.replace('{{version}}', releaseVersion).replace('YYYY-MM-DD', today)
  releaseLines[placeholderIdx] = newHeader
  if (isDryRun) {
    process.stdout.write(releaseLines.join('\n'))
  } else {
    fs.writeFileSync(filePath, releaseLines.join('\n'), 'utf8')
    console.log(newHeader)
  }
  process.exit(0)
}

// --- COMMAND: NEXT ---
if (command === 'next') {
  if (!fs.existsSync(filePath)) {
    console.error(`${RED}Error: "${targetFile}" not found. Run "flatlog init" first.${RESET}`)
    process.exit(1)
  }

  const nextContent = fs.readFileSync(filePath, 'utf8')
  const nextLines = nextContent.split(/\r?\n/)

  const existingPlaceholder = nextLines.findIndex(line => compiledPlaceholderRegex.test(line.trim()))
  if (existingPlaceholder !== -1) {
    console.error(`${RED}Error: An unreleased block already exists. Use "flatlog bullet" to add entries.${RESET}`)
    process.exit(1)
  }

  const titleIdx = nextLines.findIndex(line => titleRegex.test(line.trim()))
  const insertAt = titleIdx !== -1 ? titleIdx + 1 : 0
  nextLines.splice(insertAt, 0, '', livePlaceholderText)

  if (isDryRun) {
    process.stdout.write(nextLines.join('\n'))
  } else {
    fs.writeFileSync(filePath, nextLines.join('\n'), 'utf8')
    console.log(`${GREEN}✔${RESET} Unreleased block added.`)
  }
  process.exit(0)
}

// --- PIPELINE: DATA PARSING & ANALYTICS STREAM ENGINE ---
if (!fs.existsSync(filePath)) {
  if (isJsonMode) {
    console.log(JSON.stringify({ success: false, errors: [{ line: 0, message: `"${targetFile}" not found.` }], warnings: [] }))
  } else {
    console.error(`${RED}Error: "${targetFile}" not found.${RESET}`)
  }
  process.exit(1)
}

const expectedVersion = positionalArgs[0] || null

const content = fs.readFileSync(filePath, 'utf8')
const lines = content.split(/\r?\n/)

const report = { success: true, errors: [], warnings: [], metadata: { releasesChecked: 0, topmostVersion: null } }
let titleFound = false
let currentVersion = null
let currentVersionDate = null
let hasPlaceholder = false
const versionsFound = []

lines.forEach((rawLine, index) => {
  const lineNum = index + 1
  const line = rawLine.trim()
  if (!line) return

  if (titleRegex.test(line)) {
    if (titleFound) report.errors.push({ line: lineNum, message: 'Duplicate title found.' })
    titleFound = true
    return
  }

  if (rawLine.startsWith('  ') || rawLine.startsWith('\t')) {
    if (line.startsWith(config.bulletSign)) {
      report.errors.push({ line: lineNum, message: 'Indented bullets are not allowed. Use flat lists only.' })
      return
    }
  }

  if (compiledPlaceholderRegex.test(line)) {
    if (versionsFound.length > 0 || currentVersion) {
      report.errors.push({ line: lineNum, message: 'Unreleased block must be at the top of the changelog.' })
    }
    currentVersion = 'placeholder'
    hasPlaceholder = true
    return
  }

  if (compiledVersionRegex.test(line)) {
    const versionMatch = line.match(compiledVersionRegex)
    const extractedVersion = versionMatch[1]
    const extractedDate = versionMatch[2]
    if (!report.metadata.topmostVersion) report.metadata.topmostVersion = extractedVersion

    if (isNaN(new Date(extractedDate))) {
      report.errors.push({ line: lineNum, message: `Invalid date: ${extractedDate}` })
    }

    if (versionsFound.includes(extractedVersion)) {
      report.errors.push({ line: lineNum, message: `Version ${extractedVersion} is listed more than once.` })
    } else if (currentVersion && currentVersion !== 'placeholder') {
      const isOlder = compareVersions(extractedVersion, currentVersion) < 0
      if (!isOlder) {
        report.errors.push({ line: lineNum, message: `Version ${extractedVersion} is out of order (should come before ${currentVersion}).` })
      }

      if (currentVersionDate && !isNaN(new Date(extractedDate)) && new Date(extractedDate) > new Date(currentVersionDate)) {
        report.warnings.push({ line: lineNum, message: `Date ${extractedDate} is newer than ${currentVersionDate} but the version is older.` })
      }
    }

    currentVersion = extractedVersion
    currentVersionDate = extractedDate
    versionsFound.push(extractedVersion)
    return
  }

  if (line.startsWith(config.bulletSign)) {
    if (!currentVersion) {
      report.errors.push({ line: lineNum, message: 'Bullet found before any version header.' })
      return
    }

    const isInitialRelease = line === assembledInitialRelease
    const isValidPrefix = validationRegex.test(line)

    if (!isValidPrefix && !isInitialRelease) {
      report.errors.push({ line: lineNum, message: `Invalid prefix. Allowed: ${config.allowedPrefixes.join(', ')}` })
    }

    if (line.length > config.maxLineLength) {
      report.warnings.push({ line: lineNum, message: `Line too long (${line.length} chars, max ${config.maxLineLength}).` })
    }
    return
  }

  if (!titleFound && index === 0) {
    report.errors.push({ line: lineNum, message: 'File must start with a valid title.' })
  } else {
    if (!titleRegex.test(line) && !compiledVersionRegex.test(line) && !compiledPlaceholderRegex.test(line) && !line.startsWith(config.bulletSign)) {
      report.errors.push({ line: lineNum, message: 'Unexpected content.' })
    }
  }
})

report.metadata.releasesChecked = versionsFound.length

if (expectedVersion) {
  if (hasPlaceholder) {
    report.errors.push({ line: 0, message: 'Unreleased block found. Run "flatlog release <version>" before publishing.' })
  } else if (report.metadata.topmostVersion && expectedVersion !== report.metadata.topmostVersion) {
    report.errors.push({ line: 0, message: `Version mismatch: expected ${expectedVersion} but changelog has ${report.metadata.topmostVersion}.` })
  }
}

if (report.errors.length > 0) report.success = false

// --- COMMAND: GET-VERSION ---
if (command === 'get-version') {
  if (!report.metadata.topmostVersion) process.exit(1)
  console.log(report.metadata.topmostVersion)
  process.exit(0)
}

// --- COMMAND: GET-RELEASE-NOTES ---
if (command === 'get-release-notes') {
  const requestedVersion = positionalArgs[0] || null
  const targetVersion = requestedVersion || report.metadata.topmostVersion
  if (!targetVersion) process.exit(1)

  let capture = false
  let found = false
  const notes = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    const versionMatch = line.match(compiledVersionRegex)
    const isPlaceholder = compiledPlaceholderRegex.test(line)

    if (versionMatch || isPlaceholder) {
      if (capture) break
      if (versionMatch && versionMatch[1] === targetVersion) {
        capture = true
        found = true
      }
      continue
    }
    if (capture && line.startsWith(config.bulletSign)) {
      notes.push(rawLine)
    }
  }

  if (!found) process.exit(1)
  console.log(notes.join('\n'))
  process.exit(0)
}

// --- COMMAND: VALIDATE OUTPUT EMITTER (DEFAULT) ---
if (isJsonMode) {
  console.log(JSON.stringify(report))
  process.exit(report.success ? 0 : 1)
}

report.errors.forEach(e => console.error(`${RED}${targetFile}${e.line ? `:${e.line}` : ''}: error: ${e.message}${RESET}`))
report.warnings.forEach(w => console.warn(`${YELLOW}${targetFile}${w.line ? `:${w.line}` : ''}: warning: ${w.message}${RESET}`))

if (!report.success) {
  process.exit(1)
} else if (report.metadata.releasesChecked === 0 && currentVersion !== 'placeholder') {
  if (!isQuiet) console.warn(`${YELLOW}No releases found.${RESET}`)
  process.exit(0)
} else {
  if (!isQuiet) {
    let contextMeta = `${report.metadata.releasesChecked} release${report.metadata.releasesChecked !== 1 ? 's' : ''}`
    if (expectedVersion) contextMeta += `, checked v${expectedVersion}`
    console.log(`${GREEN}✔${RESET} Valid (${contextMeta})`)
  }
  process.exit(0)
}
