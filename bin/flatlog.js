#!/usr/bin/env node

/**
 * flatlog - The Customizable, Flat Changelog Utility Belt
 * Commands:
 * - init                         : Generates a baseline configuration and CHANGELOG.md.
 * - add                          : Intelligently inserts a placeholder block or an active bullet item.
 * - validate [--strict] [--json] : Audits structural integrity, layout conventions, and rules.
 * - get-version                  : Extracts the highest parsed stable release version string.
 * - get-release-notes            : Isolates markdown bullet content for the latest release.
 */

const fs = require('fs')
const path = require('path')

// 1. Core Default Configuration Matrix
const defaultConfig = {
  titlePattern: '^# .*Changelog$',
  versionPattern: '## {{version}} - YYYY-MM-DD',
  bulletSign: '- ',
  allowedPrefixes: ['Added:', 'Changed:', 'Fixed:'],
  initialReleaseText: 'Initial release.',
  maxLineLength: 120
}

// 2. Load Configuration Overrides if Present
let config = { ...defaultConfig }
const configPath = path.resolve(process.cwd(), '.flatlogrc.json')
if (fs.existsSync(configPath)) {
  try {
    config = { ...defaultConfig, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) }
  } catch (e) {
    console.warn('\x1b[33mflatlog Warning: Malformed .flatlogrc.json found. Falling back to defaults.\x1b[0m')
  }
}

// 3. Process CLI Parameters
const args = process.argv.slice(2)
const command = args[0]

const isJsonMode = args.includes('--json')
const isStrict = args.includes('--strict')
const positionalArgs = args.filter(arg => !arg.startsWith('--'))

// Standard ANSI Terminal Color Codes
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RESET = '\x1b[0m'

// --- INTELLIGENT COMPILER ENGINE FOR VERSION PLACEHOLDERS ---
const today = new Date().toISOString().split('T')[0]
const escapeRegex = (str) => str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

const universalToken = 'X.X.X'

// Generate the literal placeholder line (keeps YYYY-MM-DD untouched as structural text)
const livePlaceholderText = config.versionPattern.replace('{{version}}', universalToken)

// Generate the active release header line for initialization commands
const liveInitialReleaseHeader = config.versionPattern
  .replace('{{version}}', '1.0.0')
  .replace('YYYY-MM-DD', today)

const assembledInitialRelease = `${config.bulletSign}${config.initialReleaseText}`
const defaultBulletText = `${config.bulletSign}${config.allowedPrefixes[0]} `

// Compile high-fidelity regular expressions for tracking/validation loops
const escapedTemplateBase = escapeRegex(config.versionPattern).replace('YYYY\\-MM\\-DD', '\\d{4}-\\d{2}-\\d{2}')
const compiledVersionRegex = new RegExp(`^${escapedTemplateBase.replace('\\{\\{version\\}\\}', '(\\d+\\.\\d+\\.\\d+)')}$`)
const compiledPlaceholderRegex = new RegExp(`^${escapeRegex(config.versionPattern).replace('\\{\\{version\\}\\}', escapeRegex(universalToken))}$`)

const titleRegex = new RegExp(config.titlePattern)
const prefixEscaped = config.allowedPrefixes.map(escapeRegex).join('|')
const bulletEscaped = escapeRegex(config.bulletSign)
const validationRegex = new RegExp(`^${bulletEscaped}(${prefixEscaped})\\s\\S.*$`)

// --- COMMAND: INIT ---
if (command === 'init') {
  const targetFile = positionalArgs[1] || 'CHANGELOG.md'
  const destinationPath = path.resolve(process.cwd(), targetFile)

  if (fs.existsSync(destinationPath)) {
    console.error(`${RED}flatlog Error: A file named "${targetFile}" already exists.${RESET}`)
    process.exit(1)
  }

  // Attempt to sniff package name for dynamic branded title headers
  let customTitle = 'Changelog'
  const packageJsonPath = path.resolve(process.cwd(), 'package.json')
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
      if (pkg.name) {
        // Capitalize or clean up simple project slug strings smoothly
        const formattedName = pkg.name
          .split(/[-_]/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
        customTitle = `${formattedName} Changelog`
      }
    } catch (e) {}
  }

  const boilerplate = `# ${customTitle}

${livePlaceholderText}
${config.allowedPrefixes.map(p => `${config.bulletSign}${p}${p === config.allowedPrefixes[0] ? ' Setup layout configuration tracking bounds.' : ''}`).join('\n')}

${liveInitialReleaseHeader}
${assembledInitialRelease}
`

  try {
    fs.writeFileSync(destinationPath, boilerplate, 'utf8')
    console.log(`\n${GREEN}✔ Success:${RESET} Spawned clean "${targetFile}"!`)
    process.exit(0)
  } catch (error) {
    console.error(`${RED}flatlog Error: Failed to write files.${RESET} ${error.message}`)
    process.exit(1)
  }
}

// --- RESOLVE TARGET FILE FOR REMAINING ENGINE ACTIONS ---
const isExplicitCmd = ['validate', 'add', 'get-version', 'get-release-notes'].includes(command)
if (isExplicitCmd) {
  positionalArgs.shift()
}

const targetFile = positionalArgs[0] || 'CHANGELOG.md'
const filePath = path.resolve(process.cwd(), targetFile)

// --- COMMAND: ADD (SMART INJECTION RUNNER) ---
if (command === 'add') {
  if (!fs.existsSync(filePath)) {
    console.error(`${RED}flatlog Error: Cannot append. "${targetFile}" does not exist. Run "flatlog init" first.${RESET}`)
    process.exit(1)
  }

  const fileContent = fs.readFileSync(filePath, 'utf8')
  const fileLines = fileContent.split(/\r?\n/)

  const placeholderIdx = fileLines.findIndex(line => compiledPlaceholderRegex.test(line.trim()))

  if (placeholderIdx !== -1) {
    fileLines.splice(placeholderIdx + 1, 0, defaultBulletText)
    console.log(`${GREEN}✔ flatlog:${RESET} Appended empty item bullet under the active placeholder line.`)
  } else {
    const titleIdx = fileLines.findIndex(line => titleRegex.test(line.trim()))
    const injectionBlock = ['', livePlaceholderText, defaultBulletText]
    const targetInsertIdx = titleIdx !== -1 ? titleIdx + 1 : 0
    fileLines.splice(targetInsertIdx, 0, ...injectionBlock)
    console.log(`${GREEN}✔ flatlog:${RESET} Generated and inserted active development pattern block into file.`)
  }

  fs.writeFileSync(filePath, fileLines.join('\n'), 'utf8')
  process.exit(0)
}

// --- PIPELINE: DATA PARSING & ANALYTICS STREAM ENGINE ---
if (!fs.existsSync(filePath)) {
  if (isJsonMode) {
    console.log(JSON.stringify({ success: false, errors: [{ line: 0, message: 'Target changelog file not found.' }], warnings: [] }))
  } else {
    console.error(`${RED}flatlog Error: Target file not found at: ${filePath}${RESET}`)
  }
  process.exit(1)
}

let expectedVersion = positionalArgs[1] || null
if (isStrict && !expectedVersion) {
  const packageJsonPath = path.resolve(process.cwd(), 'package.json')
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
      if (pkg.version) expectedVersion = pkg.version
    } catch (e) {}
  }
}

const content = fs.readFileSync(filePath, 'utf8')
const lines = content.split(/\r?\n/)

const report = { success: true, errors: [], warnings: [], metadata: { releasesChecked: 0, topmostVersion: null }, internal: { hasPlaceholder: false } }
let titleFound = false
let currentVersion = null
const versionsFound = []

lines.forEach((rawLine, index) => {
  const lineNum = index + 1
  const line = rawLine.trim()
  if (!line) return

  if (titleRegex.test(line)) {
    if (titleFound) report.errors.push({ line: lineNum, message: 'Duplicate layout title block found.' })
    titleFound = true
    return
  }

  if (rawLine.startsWith('  ') || rawLine.startsWith('\t')) {
    if (line.startsWith(config.bulletSign)) {
      report.errors.push({ line: lineNum, message: 'Banned indentation layout detected! flatlog strictly requires completely flat lists.' })
      return
    }
  }

  if (compiledPlaceholderRegex.test(line)) {
    if (versionsFound.length > 0 || currentVersion) {
      report.errors.push({ line: lineNum, message: 'The active development placeholder line must strictly reside at the top.' })
    }
    currentVersion = 'placeholder'
    report.internal.hasPlaceholder = true
    return
  }

  if (compiledVersionRegex.test(line)) {
    const versionMatch = line.match(compiledVersionRegex)
    const extractedVersion = versionMatch[1]
    if (!report.metadata.topmostVersion) report.metadata.topmostVersion = extractedVersion

    if (currentVersion && currentVersion !== 'placeholder') {
      const [nMajor, nMinor, nPatch] = extractedVersion.split('.').map(Number)
      const [oMajor, oMinor, oPatch] = currentVersion.split('.').map(Number)
      const isOlder = nMajor !== oMajor ? nMajor < oMajor : (nMinor !== oMinor ? nMinor < oMinor : nPatch < oPatch)
      if (!isOlder) {
        report.errors.push({ line: lineNum, message: `Chronological ordering crash. Version ${extractedVersion} cannot follow version ${currentVersion}.` })
      }
    }

    if (versionsFound.includes(extractedVersion)) {
      report.errors.push({ line: lineNum, message: `Duplicate release entry detected for version ${extractedVersion}.` })
    }

    currentVersion = extractedVersion
    versionsFound.push(extractedVersion)
    return
  }

  if (line.startsWith(config.bulletSign)) {
    if (!currentVersion) {
      report.errors.push({ line: lineNum, message: 'Floating block element found before a structural version header was initialized.' })
      return
    }

    const isInitialRelease = line === assembledInitialRelease
    const isValidPrefix = validationRegex.test(line)

    if (!isValidPrefix && !isInitialRelease) {
      report.errors.push({ line: lineNum, message: `Invalid entry content prefix layout. Must match rules or use: ${config.allowedPrefixes.join(', ')}` })
    }

    if (line.length > config.maxLineLength) {
      report.warnings.push({ line: lineNum, message: `Entry is long (${line.length} characters). Truncate to match your configured limit of ${config.maxLineLength}.` })
    }
    return
  }

  if (!titleFound && index === 0) {
    report.errors.push({ line: lineNum, message: 'File stream must begin with a valid structural title header.' })
  } else {
    if (!titleRegex.test(line) && !compiledVersionRegex.test(line) && !compiledPlaceholderRegex.test(line) && !line.startsWith(config.bulletSign)) {
      report.errors.push({ line: lineNum, message: 'Unidentified data structure noise parsed.' })
    }
  }
})

report.metadata.releasesChecked = versionsFound.length

if (isStrict && expectedVersion) {
  if (report.internal.hasPlaceholder) {
    report.errors.push({ line: 0, message: `Strict enforcement failure: Active layout development placeholder "${livePlaceholderText}" is blocking release.` })
  } else if (report.metadata.topmostVersion && expectedVersion !== report.metadata.topmostVersion) {
    report.errors.push({ line: 0, message: `Strict version mismatch: Target environment requires "${expectedVersion}" but found "${report.metadata.topmostVersion}".` })
  }
}

delete report.internal
if (report.errors.length > 0) report.success = false

// --- COMMAND: GET-VERSION ---
if (command === 'get-version') {
  if (!report.metadata.topmostVersion) process.exit(1)
  console.log(report.metadata.topmostVersion)
  process.exit(0)
}

// --- COMMAND: GET-RELEASE-NOTES ---
if (command === 'get-release-notes') {
  if (!report.metadata.topmostVersion) process.exit(1)
  let capture = false
  const notes = []
  const genericHeaderStarterToken = config.versionPattern.split(' ')[0]

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line.startsWith(genericHeaderStarterToken)) {
      if (capture) break
      if (line.includes(report.metadata.topmostVersion)) capture = true
      continue
    }
    if (capture && line.startsWith(config.bulletSign)) {
      notes.push(rawLine)
    }
  }
  console.log(notes.join('\n'))
  process.exit(0)
}

// --- COMMAND: VALIDATE OUTPUT EMITTER (DEFAULT) ---
if (isJsonMode) {
  console.log(JSON.stringify(report))
  process.exit(report.success ? 0 : 1)
}

console.log('\n--- flatlog Verification Report ---')
report.errors.forEach(e => console.error(`${RED}Line ${e.line}:${RESET} ${e.message}`))
report.warnings.forEach(w => console.warn(`${YELLOW}Line ${w.line} Warning:${RESET} ${w.message}`))

if (!report.success) {
  console.error(`\n❌ ${RED}Validation Failed:${RESET} Correct formatting issues tracked above.\n`)
  process.exit(1)
} else if (report.metadata.releasesChecked === 0 && currentVersion !== 'placeholder') {
  console.warn(`⚠️  ${YELLOW}Verification Incomplete:${RESET} Structure valid, but no stable release chunks parsed.\n`)
  process.exit(0)
} else {
  let contextMeta = `(${report.metadata.releasesChecked} stable releases confirmed)`
  if (isStrict && expectedVersion) contextMeta += ` [Strict matched with version ${expectedVersion}]`
  console.log(`✔ ${GREEN}Success:${RESET} "${targetFile}" matches flat specifications perfectly! ${contextMeta}\n`)
  process.exit(0)
}
