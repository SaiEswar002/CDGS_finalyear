/**
 * Documentation Engine Types & Interfaces
 */

export type DocType =
  | 'readme'
  | 'api'
  | 'module'
  | 'function'
  | 'class'
  | 'database'
  | 'architecture'
  | 'other'

/** Individual generated documentation file */
export interface GeneratedDocument {
  filePath: string
  docType: DocType
  title: string
  content: string
  contentHash: string
  aiModel?: string
  tokenCount?: number
}

/** Complete documentation result produced for a pipeline run */
export interface DocumentationResult {
  versionNumber: number
  documents: GeneratedDocument[]
  summaryText: string
  totalTokens: number
}

/** Analyzed file symbol extracted by parser */
export interface ExtractedSymbol {
  name: string
  kind: 'function' | 'class' | 'interface' | 'type' | 'route' | 'variable'
  description?: string
  params?: Array<{ name: string; type: string; description?: string }>
  returnType?: string
}

/** Analyzed code file result */
export interface ParsedCodeFile {
  filePath: string
  language: string
  symbols: ExtractedSymbol[]
  hasSwaggerAnnotations: boolean
}
