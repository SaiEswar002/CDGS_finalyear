import path from 'path'
import fs from 'fs/promises'
import { createHash } from 'crypto'
import type { ChangeSet } from '../pipeline/pipeline.types'
import type { ParsedCodeFile, ExtractedSymbol } from './docgen.types'
import { logger } from '../logger'

/** Computes sha256 content hash */
export function computeContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

/**
 * Categorizes and parses changed source files from a workspace.
 */
export async function parseWorkspaceFiles(
  workspaceDir: string,
  changeset: ChangeSet,
): Promise<ParsedCodeFile[]> {
  const parsedFiles: ParsedCodeFile[] = []

  for (const file of changeset.files) {
    if (file.status === 'deleted') continue

    const fullPath = path.join(workspaceDir, file.path)
    try {
      const stat = await fs.stat(fullPath).catch(() => null)
      if (!stat || !stat.isFile()) continue

      const content = await fs.readFile(fullPath, 'utf8')
      const ext = path.extname(file.path).toLowerCase()

      let language: ParsedCodeFile['language'] = 'other'
      if (['.ts', '.tsx'].includes(ext)) language = 'typescript'
      else if (['.js', '.jsx'].includes(ext)) language = 'javascript'
      else if (ext === '.py') language = 'python'
      else if (ext === '.sql') language = 'sql'
      else if (['.md', '.markdown'].includes(ext)) language = 'markdown'

      const symbols = extractSymbolsFromCode(content, language)
      const hasSwaggerAnnotations = /@swagger|@openapi/i.test(content)

      parsedFiles.push({
        filePath: file.path,
        language,
        symbols,
        hasSwaggerAnnotations,
      })
    } catch (err) {
      logger.warn({ err, file: file.path }, 'Failed to parse file for documentation')
    }
  }

  return parsedFiles
}

/**
 * Extracts exported functions, classes, interfaces, and routes using regex pattern matching.
 */
export function extractSymbolsFromCode(
  code: string,
  language: ParsedCodeFile['language'],
): ExtractedSymbol[] {
  const symbols: ExtractedSymbol[] = []

  if (language === 'typescript' || language === 'javascript') {
    // Exported functions
    const fnRegex = /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/g
    let match: RegExpExecArray | null
    while ((match = fnRegex.exec(code)) !== null) {
      symbols.push({
        name: match[1],
        kind: 'function',
        params: match[2]
          ? match[2].split(',').map((p) => ({ name: p.trim().split(':')[0].trim(), type: 'any' }))
          : [],
      })
    }

    // Exported classes
    const classRegex = /export\s+class\s+([A-Za-z0-9_]+)/g
    while ((match = classRegex.exec(code)) !== null) {
      symbols.push({ name: match[1], kind: 'class' })
    }

    // Exported interfaces / types
    const typeRegex = /export\s+(?:interface|type)\s+([A-Za-z0-9_]+)/g
    while ((match = typeRegex.exec(code)) !== null) {
      symbols.push({ name: match[1], kind: 'interface' })
    }

    // Express routes
    const routeRegex = /(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi
    while ((match = routeRegex.exec(code)) !== null) {
      symbols.push({
        name: `${match[1].toUpperCase()} ${match[2]}`,
        kind: 'route',
      })
    }
  } else if (language === 'python') {
    // Python def / class
    const pyDef = /def\s+([A-Za-z0-9_]+)\s*\(([^)]*)\):/g
    let match: RegExpExecArray | null
    while ((match = pyDef.exec(code)) !== null) {
      symbols.push({ name: match[1], kind: 'function' })
    }
  }

  return symbols
}
