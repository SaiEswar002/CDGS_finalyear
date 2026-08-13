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

export function detectLanguage(filePath: string): ParsedCodeFile['language'] {
  const ext = path.extname(filePath).toLowerCase()
  if (['.ts', '.tsx'].includes(ext)) return 'typescript'
  if (['.js', '.jsx', '.mjs', '.cjs'].includes(ext)) return 'javascript'
  if (ext === '.py') return 'python'
  if (ext === '.java') return 'java'
  if (ext === '.go') return 'go'
  if (ext === '.rs') return 'rust'
  if (ext === '.cs') return 'csharp'
  if (['.cpp', '.hpp', '.cc', '.c', '.h'].includes(ext)) return 'cpp'
  if (ext === '.sql') return 'sql'
  if (['.md', '.markdown'].includes(ext)) return 'markdown'
  return 'other'
}

const EXCLUDE_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'target', '.idea', '.vscode', 'vendor', '__pycache__', '.next'])

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
 * Categorizes and parses source files from a workspace.
 */
export async function parseWorkspaceFiles(
  workspaceDir: string,
  changeset: ChangeSet,
): Promise<ParsedCodeFile[]> {
  const parsedFiles: ParsedCodeFile[] = []
  const processedPaths = new Set<string>()

  // 1. Process files in ChangeSet first
  for (const file of changeset.files) {
    if (file.status === 'deleted') continue
    processedPaths.add(file.path)

    const fileResult = await parseSingleFile(workspaceDir, file.path)
    if (fileResult) parsedFiles.push(fileResult)
  }

  // 2. Fallback: If changeset returned 0 code symbols or few files, scan repository workspace
  const totalSymbols = parsedFiles.reduce((acc, f) => acc + f.symbols.length, 0)
  if (totalSymbols === 0 || parsedFiles.length === 0) {
    const allRepoFiles = await getAllSourceFiles(workspaceDir)
    for (const relPath of allRepoFiles) {
      if (processedPaths.has(relPath)) continue
      const lang = detectLanguage(relPath)
      if (lang === 'other' || lang === 'markdown') continue

      const fileResult = await parseSingleFile(workspaceDir, relPath)
      if (fileResult && fileResult.symbols.length > 0) {
        parsedFiles.push(fileResult)
      }
    }
  }

  return parsedFiles
}

async function parseSingleFile(workspaceDir: string, relPath: string): Promise<ParsedCodeFile | null> {
  const fullPath = path.join(workspaceDir, relPath)
  try {
    const stat = await fs.stat(fullPath).catch(() => null)
    if (!stat || !stat.isFile()) return null

    const content = await fs.readFile(fullPath, 'utf8')
    const language = detectLanguage(relPath)
    const symbols = extractSymbolsFromCode(content, language)
    const hasSwaggerAnnotations = /@swagger|@openapi|@RestController|@GetMapping|@PostMapping|@RequestMapping/i.test(content)

    return {
      filePath: relPath,
      language,
      symbols,
      hasSwaggerAnnotations,
    }
  } catch (err) {
    logger.warn({ err, file: relPath }, 'Failed to parse file for documentation')
    return null
  }
}

/**
 * Extracts functions, classes, interfaces, and routes across languages.
 */
export function extractSymbolsFromCode(
  code: string,
  language: ParsedCodeFile['language'],
): ExtractedSymbol[] {
  const symbols: ExtractedSymbol[] = []
  let match: RegExpExecArray | null

  if (language === 'typescript' || language === 'javascript') {
    // Exported functions
    const fnRegex = /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/g
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
  } else if (language === 'java') {
    // Java Classes & Interfaces
    const classRegex = /(?:public|protected|private)?\s*(?:static\s+)?(?:final\s+|abstract\s+)?(class|interface|enum)\s+([A-Za-z0-9_]+)/g
    while ((match = classRegex.exec(code)) !== null) {
      symbols.push({ name: match[2], kind: match[1] === 'interface' ? 'interface' : 'class' })
    }

    // Java Spring Boot REST Route Annotations
    const springRouteRegex = /@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?["']([^"']+)["']/g
    while ((match = springRouteRegex.exec(code)) !== null) {
      const method = match[1].replace('Mapping', '').toUpperCase()
      symbols.push({ name: `${method === 'REQUEST' ? 'GET' : method} ${match[2]}`, kind: 'route' })
    }

    // Java Methods
    const methodRegex = /(?:public|protected|private|static|\s)+[\w<>\[\]\?]+\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*(?:throws\s+[\w\s,]+)?\s*\{/g
    while ((match = methodRegex.exec(code)) !== null) {
      const name = match[1]
      if (!['if', 'for', 'while', 'switch', 'catch', 'return'].includes(name)) {
        symbols.push({ name, kind: 'function' })
      }
    }
  } else if (language === 'python') {
    // Python Classes
    const classRegex = /class\s+([A-Za-z0-9_]+)/g
    while ((match = classRegex.exec(code)) !== null) {
      symbols.push({ name: match[1], kind: 'class' })
    }

    // Python Functions
    const pyDef = /def\s+([A-Za-z0-9_]+)\s*\(([^)]*)\):/g
    while ((match = pyDef.exec(code)) !== null) {
      symbols.push({ name: match[1], kind: 'function' })
    }

    // Python Flask / FastAPI Routes
    const pyRoute = /@(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g
    while ((match = pyRoute.exec(code)) !== null) {
      symbols.push({ name: `${match[1].toUpperCase()} ${match[2]}`, kind: 'route' })
    }
  } else if (language === 'go') {
    // Go Functions & Methods
    const goFunc = /func\s+(?:\([^)]+\)\s+)?([A-Za-z0-9_]+)\s*\(([^)]*)\)/g
    while ((match = goFunc.exec(code)) !== null) {
      symbols.push({ name: match[1], kind: 'function' })
    }

    // Go Structs & Interfaces
    const goType = /type\s+([A-Za-z0-9_]+)\s+(struct|interface)/g
    while ((match = goType.exec(code)) !== null) {
      symbols.push({ name: match[1], kind: match[2] === 'interface' ? 'interface' : 'class' })
    }
  } else if (language === 'rust') {
    const rsFn = /pub\s+fn\s+([A-Za-z0-9_]+)/g
    while ((match = rsFn.exec(code)) !== null) {
      symbols.push({ name: match[1], kind: 'function' })
    }
    const rsType = /pub\s+(struct|trait|enum)\s+([A-Za-z0-9_]+)/g
    while ((match = rsType.exec(code)) !== null) {
      symbols.push({ name: match[2], kind: match[1] === 'trait' ? 'interface' : 'class' })
    }
  } else if (language === 'csharp' || language === 'cpp') {
    const classRegex = /(?:class|struct|interface)\s+([A-Za-z0-9_]+)/g
    while ((match = classRegex.exec(code)) !== null) {
      symbols.push({ name: match[1], kind: 'class' })
    }
  } else if (language === 'sql') {
    const sqlObj = /CREATE\s+(?:OR\s+REPLACE\s+)?(TABLE|PROCEDURE|FUNCTION|VIEW)\s+([A-Za-z0-9_"\.]+)/gi
    while ((match = sqlObj.exec(code)) !== null) {
      symbols.push({ name: match[2], kind: match[1].toUpperCase() === 'TABLE' ? 'class' : 'function' })
    }
  }

  return symbols
}
