#!/usr/bin/env bun
/******************************************************************************
 * This file is part of the CD2027 project.
 *
 * File: scripts/update-file-headers.mjs
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-06
 * Last modified: 2026-10-06
 *
 * Copyright © 2026 Christian Denat
 ******************************************************************************/

import { existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const EXCLUDED_DIRECTORY_NAMES = new Set([
  '.build',
  '.data',
  '.git',
  '.idea',
  '_site',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'vendor',
])
const HEADER_TEXT = [
  'This file is part of the CD2027 project.',
  '',
  'File: {filePath}',
  '',
  'Author: Christian Denat',
  'Email: christian.denat@orange.fr',
  '',
  'Created on: {createdDate}',
  'Last modified: {modifiedDate}',
  '',
  'Copyright © {year} Christian Denat',
]
const GENERIC_PACKAGE_HEADER_TEXT = [
  'This file is part of the wp-awesome package.',
  '',
  'File: {filePath}',
  '',
  'Author: Christian Denat',
  '',
  'Created on: {createdDate}',
  'Last modified: {modifiedDate}',
  '',
  'Copyright © {year} Christian Denat',
]

/**
 * Return whether a path belongs to the reusable package and must remain site-neutral.
 *
 * @param {string} filePath Repository-relative file path.
 * @returns {boolean} True for reusable package source and its architecture document.
 */
const isGenericPackageFile = (filePath) => {
  const normalizedPath = filePath.replaceAll('\\', '/')
  return normalizedPath === 'docs/reusable-wordpress-eleventy-content-pipeline.md'
}

/**
 * Run a Git command from the repository root.
 *
 * @param {string[]} argumentsList Git command arguments.
 * @returns {{status: number, stdout: string, stderr: string}} Git command result.
 */
export const runGit = (argumentsList) => {
  const result = spawnSync('git', argumentsList, {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  })

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? result.error?.message ?? '',
  }
}

/**
 * Return today's date in the project date format and timezone.
 *
 * @returns {string} Current date formatted as YYYY-MM-DD in Europe/Paris.
 */
export const getCurrentDate = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Europe/Paris',
    year: 'numeric',
  }).formatToParts(new Date()).reduce((values, part) => {
    values[part.type] = part.value
    return values
  }, {})

  return `${parts.year}-${parts.month}-${parts.day}`
}

/**
 * Return the supported comment syntax for a first-party text file.
 *
 * @param {string} filePath Repository-relative file path.
 * @returns {'block'|'html'|'nunjucks'|'line'|null} Header syntax, or null when excluded.
 */
const getHeaderKind = (filePath) => {
  const normalizedPath = filePath.replaceAll('\\', '/')
  const segments = normalizedPath.split('/')
  const basename = segments.at(-1).toLowerCase()

  if (segments.some((segment) => EXCLUDED_DIRECTORY_NAMES.has(segment.toLowerCase()))) return null
  if (segments[0] === '.githooks' && ['pre-commit', 'prepare-commit-msg', 'commit-msg', 'post-commit'].includes(basename)) return 'line'
  if (basename === '.gitignore' || basename === '.htaccess') return 'line'

  const extension = extname(basename).toLowerCase()
  if (extension === '.njk') return 'nunjucks'
  if (['.js', '.cjs', '.mjs', '.jsx', '.ts', '.tsx', '.css', '.php', '.jsonc', '.json5'].includes(extension)) return 'block'
  if (['.html', '.htm', '.md', '.svg', '.xml'].includes(extension)) return 'html'
  if (['.sh', '.yml', '.yaml', '.toml', '.ini', '.conf'].includes(extension)) return 'line'

  return null
}

/**
 * Return whether a path is eligible for a source-file header.
 *
 * @param {string} filePath Repository-relative file path.
 * @returns {boolean} True when the file has a supported comment syntax.
 */
export const isSupportedSourceFile = (filePath) => getHeaderKind(filePath) !== null

/**
 * Convert an input path into a normalized repository-relative Git path.
 *
 * @param {string} filePath File path supplied by Git or the command line.
 * @returns {string|null} Normalized repository-relative path, or null if outside the repository.
 */
const toRepositoryPath = (filePath) => {
  const absolutePath = isAbsolute(filePath) ? resolve(filePath) : resolve(REPOSITORY_ROOT, filePath)
  const relativePath = relative(REPOSITORY_ROOT, absolutePath)

  if (relativePath === '..' || relativePath.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(relativePath)) {
    return null
  }

  return relativePath.replaceAll('\\', '/')
}

/**
 * Return the last non-empty line from Git output.
 *
 * @param {string} output Git command output.
 * @returns {string} Last non-empty output line.
 */
const lastOutputLine = (output) => output.trim().split('\n').filter(Boolean).at(-1) ?? ''

/**
 * Return the date of the first commit that introduced a file.
 *
 * @param {string} filePath Repository-relative file path.
 * @param {string} fallbackDate Date used when the file has no Git history.
 * @returns {string} File creation date.
 */
export const getCreatedDate = (filePath, fallbackDate = getCurrentDate()) => {
  const result = runGit(['log', '--follow', '--diff-filter=A', '--format=%cs', '--date=short', '--', filePath])
  return lastOutputLine(result.stdout) || fallbackDate
}

/**
 * Return the date of the latest committed change to a file.
 *
 * @param {string} filePath Repository-relative file path.
 * @param {string} fallbackDate Date used when the file has no Git history.
 * @returns {string} Latest committed modification date.
 */
export const getLastCommittedDate = (filePath, fallbackDate = getCurrentDate()) => {
  const result = runGit(['log', '--follow', '-1', '--format=%cs', '--date=short', '--', filePath])
  return lastOutputLine(result.stdout) || fallbackDate
}

/**
 * Return the delimiters used by the file's comment syntax.
 *
 * @param {'block'|'html'|'nunjucks'|'line'} kind Header comment syntax.
 * @returns {{start: string, end: string}} Opening and closing header markers.
 */
const getHeaderMarkers = (kind) => {
  const border = '*'.repeat(77)
  if (kind === 'block') return { start: `/${border}*`, end: ` ${border}*/` }
  if (kind === 'html') return { start: '<!--', end: '-->' }
  if (kind === 'nunjucks') return { start: '{#', end: '#}' }
  return { start: `# ${border}*`, end: `# ${border}*` }
}

/**
 * Build the canonical project header for one file.
 *
 * @param {string} filePath Repository-relative file path.
 * @param {string} createdDate File creation date.
 * @param {string} modifiedDate File modification date.
 * @returns {string} Header text without a trailing newline.
 */
export const buildHeader = (filePath, createdDate, modifiedDate) => {
  const kind = getHeaderKind(filePath)
  if (!kind) throw new Error(`Unsupported file type for a project header: ${filePath}`)

  const markers = getHeaderMarkers(kind)
  const values = {
    filePath: filePath.replaceAll('\\', '/'),
    createdDate,
    modifiedDate,
    year: modifiedDate.slice(0, 4),
  }
  const headerText = isGenericPackageFile(filePath) ? GENERIC_PACKAGE_HEADER_TEXT : HEADER_TEXT
  const lines = headerText.map((line) => line.replace(/\{(filePath|createdDate|modifiedDate|year)\}/g, (_, key) => values[key]))

  if (kind === 'block') return [markers.start, ...lines.map((line) => ` *${line ? ` ${line}` : ''}`), markers.end].join('\n')
  if (kind === 'line') return [markers.start, ...lines.map((line) => `#${line ? ` ${line}` : ''}`), markers.end].join('\n')
  return [markers.start, ...lines.map((line) => ` *${line ? ` ${line}` : ''}`), markers.end].join('\n')
}

/**
 * Preserve syntax-sensitive content that must remain before the header.
 *
 * @param {string} content Current file content.
 * @param {string} filePath Repository-relative file path.
 * @returns {string} Prefix containing a BOM, shebang, front matter, declaration, or PHP opening tag.
 */
const getPreservedPrefix = (content, filePath) => {
  let remainder = content
  let prefix = ''
  const kind = getHeaderKind(filePath)

  if (remainder.startsWith('\uFEFF')) {
    prefix += '\uFEFF'
    remainder = remainder.slice(1)
  }

  let matched = true
  while (matched) {
    matched = false
    const candidates = [
      /^#![^\r\n]*(?:\r?\n|$)/,
      /^\/\/ @vitest-environment[^\r\n]*(?:\r?\n|$)/,
      ...(kind === 'block' ? [/^<\?php(?:[ \t]*\r?\n|[ \t]*(?=\S)|$)/] : []),
      /^<\?xml\s+[^?]*\?>[ \t]*(?:\r?\n|$)/i,
      /^<!doctype\b[^>]*>[ \t]*(?:\r?\n|$)/i,
      /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/,
    ]

    for (const pattern of candidates) {
      const match = remainder.match(pattern)
      if (!match) continue
      prefix += match[0]
      remainder = remainder.slice(match[0].length)
      matched = true
      break
    }
  }

  return prefix
}

/**
 * Remove a generated project or package-neutral header after the preserved prefix.
 *
 * @param {string} content Content following the preserved prefix.
 * @param {'block'|'html'|'nunjucks'|'line'} kind Header comment syntax.
 * @param {string} newline File newline sequence.
 * @returns {{content: string, found: boolean}} Remaining content and whether a known header was removed.
 */
const removeExistingHeader = (content, kind, newline) => {
  const markers = getHeaderMarkers(kind)
  const startToken = `${markers.start}${newline}`
  if (!content.startsWith(startToken)) return { content, found: false }

  const endToken = `${newline}${markers.end}`
  const closingIndex = content.indexOf(endToken, startToken.length)
  if (closingIndex < 0) return { content, found: false }

  const headerText = content.slice(startToken.length, closingIndex)
  if (!/This file is part of (?:the CD2027 project|the wp-awesome package|the wordpress-eleventy-content package)\./.test(headerText)) {
    return { content, found: false }
  }

  let remainingContent = content.slice(closingIndex + endToken.length)
  if (remainingContent.startsWith(newline.repeat(2))) remainingContent = remainingContent.slice(newline.length * 2)
  else if (remainingContent.startsWith(newline)) remainingContent = remainingContent.slice(newline.length)
  return { content: remainingContent, found: true }
}

/**
 * Remove a project header while preserving the file's source body for change-date comparisons.
 *
 * @param {string} content Complete file content.
 * @param {string} filePath Repository-relative file path.
 * @returns {string} Content with the generated header and its separator removed.
 */
const removeProjectHeader = (content, filePath) => {
  const kind = getHeaderKind(filePath)
  const newline = content.includes('\r\n') ? '\r\n' : '\n'
  const prefix = getPreservedPrefix(content, filePath)
  const remainder = removeExistingHeader(content.slice(prefix.length), kind, newline)
  return `${prefix}${remainder.content}`
}

/**
 * Compare current source content with HEAD while ignoring only the generated project header.
 *
 * @param {string} filePath Repository-relative file path.
 * @returns {boolean} True when the source body is new or differs from HEAD.
 */
const hasSourceBodyChange = (filePath) => {
  const absolutePath = resolve(REPOSITORY_ROOT, filePath)
  if (!existsSync(absolutePath)) return true

  const committedContent = runGit(['show', `HEAD:${filePath}`])
  if (committedContent.status !== 0) return true

  const currentBody = removeProjectHeader(readFileSync(absolutePath, 'utf8'), filePath).replaceAll('\r\n', '\n')
  const committedBody = removeProjectHeader(committedContent.stdout, filePath).replaceAll('\r\n', '\n')
  return currentBody !== committedBody
}

/**
 * Replace or insert a canonical project header without changing syntax-sensitive prefixes.
 *
 * @param {string} content Current file content.
 * @param {string} filePath Repository-relative file path.
 * @param {string} createdDate File creation date.
 * @param {string} modifiedDate File modification date.
 * @returns {string} Updated file content.
 */
export const updateHeader = (content, filePath, createdDate, modifiedDate) => {
  const kind = getHeaderKind(filePath)
  if (!kind) throw new Error(`Unsupported file type for a project header: ${filePath}`)

  const newline = content.includes('\r\n') ? '\r\n' : '\n'
  const prefix = getPreservedPrefix(content, filePath)
  const bodyWithoutHeader = removeExistingHeader(content.slice(prefix.length), kind, newline)
  const body = bodyWithoutHeader.content
  const header = buildHeader(filePath, createdDate, modifiedDate).replaceAll('\n', newline)
  const prefixSeparator = prefix && !prefix.endsWith('\n') ? newline : ''

  return body
    ? `${prefix}${prefixSeparator}${header}${newline}${newline}${body}`
    : `${prefix}${prefixSeparator}${header}${newline}`
}

/**
 * Return staged repository paths selected for header processing.
 *
 * @returns {string[]} Staged, added, copied, modified, or renamed paths.
 */
export const getStagedFiles = () => runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']).stdout
  .split('\0')
  .map(toRepositoryPath)
  .filter(Boolean)
  .filter(isSupportedSourceFile)

/**
 * Return tracked and non-ignored untracked repository paths for a complete header audit.
 *
 * @returns {string[]} Repository paths currently present in the working tree.
 */
export const getAllFiles = () => runGit(['ls-files', '--cached', '--others', '--exclude-standard', '-z']).stdout
  .split('\0')
  .map(toRepositoryPath)
  .filter(Boolean)
  .filter(isSupportedSourceFile)
  .filter((filePath) => existsSync(resolve(REPOSITORY_ROOT, filePath)))

/**
 * Return whether the worktree copy matches the staged index for one path.
 *
 * @param {string} filePath Repository-relative file path.
 * @returns {boolean} True when there are no unstaged changes for this path.
 */
export const isWorktreeSynchronized = (filePath) => runGit(['diff', '--quiet', '--', filePath]).status === 0

/**
 * Update or validate one supported file and optionally stage its new header.
 *
 * @param {string} filePath Repository-relative file path.
 * @param {boolean} checkOnly Report outdated headers without writing.
 * @param {boolean} stageChanges Stage the updated file after writing.
 * @returns {boolean} True when the file is valid or was updated successfully.
 */
export const processFile = (filePath, checkOnly, stageChanges) => {
  const absolutePath = resolve(REPOSITORY_ROOT, filePath)
  if (!existsSync(absolutePath) || !lstatSync(absolutePath).isFile()) return true

  const currentDate = getCurrentDate()
  const createdDate = getCreatedDate(filePath, currentDate)
  const modifiedDate = hasSourceBodyChange(filePath) ? currentDate : getLastCommittedDate(filePath, currentDate)
  const content = readFileSync(absolutePath, 'utf8')
  const updatedContent = updateHeader(content, filePath, createdDate, modifiedDate)

  if (content === updatedContent) return true

  console.log(`${checkOnly ? 'Missing or outdated header' : 'Updating header'}: ${filePath}`)
  if (checkOnly) return false

  writeFileSync(absolutePath, updatedContent)
  if (!stageChanges) return true

  // Re-stage only the already-staged file so the generated date ships with its source change.
  const stageResult = runGit(['add', '-f', '--', filePath])
  if (stageResult.status === 0) return true

  console.error(stageResult.stderr.trim() || `Unable to stage ${filePath}`)
  return false
}

/**
 * Process all selected files while reporting every failure.
 *
 * @param {string[]} filePaths Repository-relative paths.
 * @param {(filePath: string) => boolean} fileProcessor File processing callback.
 * @returns {boolean} True when every file was processed successfully.
 */
export const processFiles = (filePaths, fileProcessor) => {
  let success = true
  filePaths.forEach((filePath) => {
    if (!fileProcessor(filePath)) success = false
  })
  return success
}

/**
 * Parse the updater command-line options.
 *
 * @param {string[]} argumentsList Command-line arguments.
 * @returns {{all: boolean, checkOnly: boolean, filePaths: string[], stageChanges: boolean, staged: boolean}} Parsed options.
 */
export const parseArguments = (argumentsList) => ({
  all: argumentsList.includes('--all'),
  checkOnly: argumentsList.includes('--check'),
  filePaths: argumentsList.filter((argument) => !argument.startsWith('--')),
  stageChanges: argumentsList.includes('--stage'),
  staged: argumentsList.includes('--staged'),
})

/**
 * Run the source-file header updater.
 *
 * @param {string[]} argumentsList Command-line arguments.
 * @returns {number} Process exit code.
 */
export const main = (argumentsList) => {
  const options = parseArguments(argumentsList)
  if (Number(options.all) + Number(options.staged) > 1) {
    console.error('Choose only one of --all or --staged.')
    return 1
  }

  const requestedPaths = options.staged ? getStagedFiles() : options.all ? getAllFiles() : options.filePaths
  const filePaths = requestedPaths
    .map(toRepositoryPath)
    .filter(Boolean)
    .filter(isSupportedSourceFile)
  const unsynchronizedFiles = options.staged ? filePaths.filter((filePath) => !isWorktreeSynchronized(filePath)) : []

  if (unsynchronizedFiles.length > 0) {
    console.error('Header update aborted because staged files also contain unstaged changes:')
    unsynchronizedFiles.forEach((filePath) => console.error(`- ${filePath}`))
    return 1
  }

  const success = processFiles(filePaths, (filePath) => processFile(filePath, options.checkOnly, options.stageChanges))
  return success ? 0 : 1
}

if (import.meta.main) process.exit(main(process.argv.slice(2)))
