import { describe, it, expect, vi, beforeEach } from 'vitest'
import { extractSymbolsFromCode } from '../src/docgen/parser.service'
import { generateSwaggerDoc } from '../src/docgen/swagger.generator'
import { generateJSDocDoc } from '../src/docgen/jsdoc.generator'
import { generateMKDocsDoc } from '../src/docgen/mkdocs.generator'
import { synthesizeAISummary } from '../src/docgen/ai.service'
import type { ChangeSet } from '../src/pipeline/pipeline.types'

const MOCK_CHANGESET: ChangeSet = {
  beforeSha: '0000000000000000000000000000000000000000',
  afterSha: 'abc123def456',
  files: [
    { path: 'src/routes/user.ts', status: 'modified', additions: 15, deletions: 2 },
    { path: 'src/services/user.service.ts', status: 'added', additions: 40, deletions: 0 },
  ],
  summary: { added: 1, modified: 1, deleted: 0 },
}

describe('Phase 4 Documentation Generation Engine', () => {
  describe('Symbol Extraction & Parsing', () => {
    it('extracts exported functions, classes, interfaces, and routes from TypeScript code', () => {
      const code = `
        export async function getUser(id: string) { return id }
        export class UserService {}
        export interface UserProfile {}
        router.get('/users/:id', handler)
      `
      const symbols = extractSymbolsFromCode(code, 'typescript')

      expect(symbols).toHaveLength(4)
      expect(symbols.find((s) => s.name === 'getUser')?.kind).toBe('function')
      expect(symbols.find((s) => s.name === 'UserService')?.kind).toBe('class')
      expect(symbols.find((s) => s.name === 'UserProfile')?.kind).toBe('interface')
      expect(symbols.find((s) => s.name === 'GET /users/:id')?.kind).toBe('route')
    })
  })

  describe('Swagger OpenAPI Specification Generator', () => {
    it('generates valid OpenAPI 3.0 specification from route symbols', () => {
      const parsedFiles = [
        {
          filePath: 'src/routes/user.ts',
          language: 'typescript' as const,
          symbols: [{ name: 'GET /api/v1/users', kind: 'route' as const }],
          hasSwaggerAnnotations: true,
        },
      ]

      const swaggerDoc = generateSwaggerDoc('CDGS', parsedFiles)

      expect(swaggerDoc).not.toBeNull()
      expect(swaggerDoc?.docType).toBe('api')

      const spec = JSON.parse(swaggerDoc!.content)
      expect(spec.openapi).toBe('3.0.3')
      expect(spec.paths['/api/v1/users']).toBeDefined()
    })
  })

  describe('JSDoc & Module Generator', () => {
    it('generates Markdown module reference documentation', () => {
      const parsedFiles = [
        {
          filePath: 'src/services/user.service.ts',
          language: 'typescript' as const,
          symbols: [{ name: 'findUserById', kind: 'function' as const }],
          hasSwaggerAnnotations: false,
        },
      ]

      const docs = generateJSDocDoc(parsedFiles)

      expect(docs).toHaveLength(1)
      expect(docs[0].content).toContain('# Module: `src/services/user.service.ts`')
      expect(docs[0].content).toContain('`findUserById`')
    })
  })

  describe('MkDocs Generator', () => {
    it('generates MkDocs documentation overview home page', () => {
      const generatedDocs = [
        {
          filePath: 'docs/api/src_services.md',
          docType: 'module' as const,
          title: 'API Reference: User Service',
          content: 'content',
          contentHash: 'hash123',
        },
      ]

      const mkdocsDoc = generateMKDocsDoc('CDGS_finalyear', MOCK_CHANGESET, generatedDocs)

      expect(mkdocsDoc.filePath).toBe('docs/index.md')
      expect(mkdocsDoc.content).toContain('# CDGS_finalyear — Documentation Overview')
      expect(mkdocsDoc.content).toContain('Files Added**: 1')
    })
  })

  describe('AI Synthesis & Fallback Engine', () => {
    it('synthesizes release notes using deterministic AST engine fallback when no API key is set', async () => {
      const result = await synthesizeAISummary('CDGS_finalyear', MOCK_CHANGESET)

      expect(result.modelUsed).toBe('deterministic-ast-engine')
      expect(result.summaryText).toContain('Automated Release Notes: `abc123d`')
      expect(result.summaryText).toContain('`src/routes/user.ts` (modified)')
    })
  })

  describe('Documentation API Routes', () => {
    it('has handlers defined for version snapshots and artifact listing', async () => {
      const { getRepoDocVersionsHandler, getLatestRepoDocsHandler, getDocVersionByIdHandler } = await import('../src/repositories/docgen.controller')
      expect(getRepoDocVersionsHandler).toBeDefined()
      expect(getLatestRepoDocsHandler).toBeDefined()
      expect(getDocVersionByIdHandler).toBeDefined()
    })
  })
})

