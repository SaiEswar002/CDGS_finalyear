import path from 'path'
import fs from 'fs/promises'
import { createHash } from 'crypto'
import type { ChangeSet } from '../pipeline/pipeline.types'
import { detectRepositoryTechStack, detectLanguageFromExtension } from './detector.service'
import { deduplicateWorkspaceFiles } from './dedup.service'
import { parsePythonFile } from './parsers/python.parser'
import { parseTypeScriptFile } from './parsers/typescript.parser'
import { parseJavaFile } from './parsers/java.parser'
import { parseDatabaseFile } from './parsers/database.parser'
import { parseGenericFile } from './parsers/generic.parser'
import { buildUniversalCodeModel } from './semantic.service'
import type { UniversalCodeModel, UCMEntity, UCMRoute, UCMDatabaseTable } from './ucm.types'
import { logger } from '../logger'

/** Computes sha256 content hash */
export function computeContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

const EXCLUDE_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'target',
  '.idea',
  '.vscode',
  'vendor',
  '__pycache__',
  '.next',
  'venv',
  '.venv',
  'coverage',
])

export async function getAllSourceFiles(dir: string, baseDir: string = dir): Promise<string[]> {
  const files: string[] = []
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (EXCLUDE_DIRS.has(entry.name)) continue
        const subFiles = await getAllSourceFiles(path.join(dir, entry.name), baseDir)
        files.push(...subFiles)
      } else if (entry.isFile()) {
        const relPath = path.relative(baseDir, path.join(dir, entry.name)).replace(/\\/g, '/')
        files.push(relPath)
      }
    }
  } catch {
    // Ignore unreadable dirs
  }
  return files
}

/**
 * Analyzes workspace files and builds the language-agnostic Universal Code Model.
 */
export async function analyzeWorkspaceAndBuildUCM(
  repoName: string,
  commitSha: string,
  workspaceDir: string,
  _changeset?: ChangeSet,
): Promise<UniversalCodeModel> {
  const rawRepoFiles = await getAllSourceFiles(workspaceDir)

  // 1. Deduplicate files & resolve canonical relative paths (Phase 2)
  const { canonicalFiles } = deduplicateWorkspaceFiles(rawRepoFiles)

  // 2. Tech Stack & Language Detection
  const detection = await detectRepositoryTechStack(workspaceDir, canonicalFiles)

  const parsedItems: { entities: UCMEntity[]; routes: UCMRoute[]; databaseTables: UCMDatabaseTable[] }[] = []

  // 3. Parse canonical source files using specialized parsers
  for (const relPath of canonicalFiles) {
    const fullPath = path.join(workspaceDir, relPath)
    try {
      const content = await fs.readFile(fullPath, 'utf8')
      const lang = detectLanguageFromExtension(relPath)

      let result: { entities: UCMEntity[]; routes: UCMRoute[]; databaseTables?: UCMDatabaseTable[] } = {
        entities: [],
        routes: [],
        databaseTables: [],
      }

      if (lang === 'python') {
        result = parsePythonFile(relPath, content)
      } else if (lang === 'typescript' || lang === 'javascript') {
        result = parseTypeScriptFile(relPath, content)
      } else if (lang === 'java') {
        result = parseJavaFile(relPath, content)
      } else if (lang === 'sql' || relPath.endsWith('.prisma')) {
        const dbRes = parseDatabaseFile(relPath, content)
        result = { entities: dbRes.entities, routes: [], databaseTables: dbRes.databaseTables }
      } else {
        result = parseGenericFile(relPath, content, lang)
      }

      parsedItems.push({
        entities: result.entities || [],
        routes: result.routes || [],
        databaseTables: result.databaseTables || [],
      })
    } catch (err) {
      logger.warn({ err, file: relPath }, 'Failed to parse file during documentation analysis, skipping gracefully')
    }
  }

  // 4. Build Universal Code Model with semantic relationships
  return buildUniversalCodeModel(repoName, commitSha, detection, parsedItems)
}
