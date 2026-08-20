import { describe, it, expect } from 'vitest'
import { parseTypeScriptFile } from '../src/docgen/parsers/typescript.parser'
import { parsePythonFile } from '../src/docgen/parsers/python.parser'
import { parseJavaFile } from '../src/docgen/parsers/java.parser'
import { parseDatabaseFile } from '../src/docgen/parsers/database.parser'
import { generateSwaggerDoc } from '../src/docgen/swagger.generator'
import { generateOverviewDoc } from '../src/docgen/generators/overview.generator'
import { generateArchitectureDoc } from '../src/docgen/generators/architecture.generator'
import { synthesizeAISummary } from '../src/docgen/ai.service'
import { buildUniversalCodeModel } from '../src/docgen/semantic.service'
import { deduplicateWorkspaceFiles } from '../src/docgen/dedup.service'
import { validateDocumentationQuality } from '../src/docgen/quality.service'
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

describe('Language-Agnostic Documentation Generation Engine', () => {
  describe('Repository Deduplication Engine', () => {
    it('eliminates nested duplicate file paths and produces canonical relative paths', () => {
      const sampleFiles = [
        'Q-Shield_DevTrails-main/Q-shield/backend/app.py',
        'Q-Shield_DevTrails-main/Q-shield/backend/app.py',
        'Q-Shield_DevTrails-main/Q-shield/backend/services/claimService.py',
      ]

      const { canonicalFiles, diagnostics } = deduplicateWorkspaceFiles(sampleFiles)

      expect(canonicalFiles).toHaveLength(2)
      expect(diagnostics.duplicateFilesIgnored).toBe(1)
      expect(canonicalFiles).toContain('backend/app.py')
      expect(canonicalFiles).toContain('backend/services/claimService.py')
    })
  })

  describe('TypeScript AST Parser', () => {
    it('extracts exported functions, classes, interfaces, and Express routes', () => {
      const code = `
        export async function getUser(id: string) { return id }
        export class UserService {}
        export interface UserProfile { id: string; name: string }
        router.get('/users/:id', handler)
      `
      const res = parseTypeScriptFile('src/routes/user.ts', code)

      expect(res.entities).toHaveLength(3)
      expect(res.entities.find((s) => s.name === 'getUser')?.kind).toBe('function')
      expect(res.entities.find((s) => s.name === 'UserService')?.kind).toBe('class')
      expect(res.entities.find((s) => s.name === 'UserProfile')?.kind).toBe('interface')
      expect(res.routes).toHaveLength(1)
      expect(res.routes[0].path).toBe('/users/{id}')
    })
  })

  describe('Python Parser', () => {
    it('extracts Python classes, docstrings, methods, and FastAPI routes', () => {
      const code = `
class FraudQuery(BaseModel):
    """Data model for transaction fraud prediction."""
    amount: float

@app.post("/api/predict_fraud")
def predict_fraud(query: FraudQuery):
    """Predicts whether a transaction is fraudulent based on supplied data."""
    return {"fraud": False}
      `
      const res = parsePythonFile('ai_engine/app.py', code)

      expect(res.entities.find((e) => e.name === 'FraudQuery')?.kind).toBe('model')
      expect(res.entities.find((e) => e.name === 'predict_fraud')?.description).toContain('Predicts whether a transaction')
      expect(res.routes).toHaveLength(1)
      expect(res.routes[0].method).toBe('POST')
      expect(res.routes[0].path).toBe('/api/predict_fraud')
    })
  })

  describe('Java Spring Boot Parser', () => {
    it('extracts Spring Boot controllers, annotations, Javadoc, and endpoints', () => {
      const code = `
@RestController
@RequestMapping("/api/v1/users")
public class UserController {
    /**
     * Creates a new user profile.
     */
    @PostMapping("/{id}")
    public UserResponse createUser(@PathVariable String id) {
        return new UserResponse();
    }
}
      `
      const res = parseJavaFile('com/example/UserController.java', code)

      expect(res.entities.find((e) => e.name === 'UserController')?.kind).toBe('controller')
      expect(res.routes).toHaveLength(1)
      expect(res.routes[0].path).toBe('/api/v1/users/{id}')
    })
  })

  describe('Database Schema Parser', () => {
    it('extracts SQL DDL tables, columns, primary/foreign keys', () => {
      const sql = `
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL
);
      `
      const res = parseDatabaseFile('db/schema.sql', sql)

      expect(res.databaseTables).toHaveLength(1)
      expect(res.databaseTables[0].tableName).toBe('users')
      expect(res.databaseTables[0].columns.find((c) => c.name === 'id')?.isPrimaryKey).toBe(true)
    })
  })

  describe('OpenAPI Specification Generator', () => {
    it('generates valid OpenAPI 3.0 specification with formatted path parameters and $ref components', () => {
      const tsCode = `router.get('/api/v1/users/:id', getUserHandler)`
      const parsed = parseTypeScriptFile('src/routes/user.ts', tsCode)

      const ucm = buildUniversalCodeModel('CDGS', 'abc123', {
        languages: { typescript: 1 },
        primaryLanguage: 'typescript',
        frameworks: ['Express'],
        projectType: 'REST API',
        configFiles: ['package.json'],
        totalFiles: 1,
        hasTests: false,
        hasDocker: false,
        hasAuth: false,
        envVars: [],
        runCommands: [],
        repositoryTree: 'project/',
      }, [parsed])

      const swaggerDoc = generateSwaggerDoc('CDGS', ucm)

      expect(swaggerDoc).not.toBeNull()
      expect(swaggerDoc?.docType).toBe('api')

      const spec = JSON.parse(swaggerDoc!.content)
      expect(spec.openapi).toBe('3.0.3')
      expect(spec.paths['/api/v1/users/{id}']).toBeDefined()
      expect(spec.paths['/api/v1/users/{id}'].get.parameters[0].name).toBe('id')
    })
  })

  describe('Documentation Quality Gate Engine', () => {
    it('calculates a 100% quality score for valid documentation artifacts', () => {
      const ucm = buildUniversalCodeModel('CDGS', 'abc123', {
        languages: { typescript: 1 },
        primaryLanguage: 'typescript',
        frameworks: [],
        projectType: 'Web App',
        configFiles: [],
        totalFiles: 1,
        hasTests: false,
        hasDocker: false,
        hasAuth: false,
        envVars: [],
        runCommands: [],
        repositoryTree: 'project/',
      }, [])

      const mockDocs = [
        { filePath: 'docs/index.md', docType: 'readme', title: 'Overview', content: 'Substantial content block with detailed description.', contentHash: 'hash1' },
      ]

      const { report, qualityDoc } = validateDocumentationQuality(ucm, mockDocs)

      expect(report.score).toBe(100)
      expect(report.passed).toBe(true)
      expect(qualityDoc.filePath).toBe('docs/quality.md')
      expect(qualityDoc.content).toContain('100%')
    })
  })

  describe('Overview & Architecture Generators', () => {
    it('generates rich Overview and Architecture diagram artifacts', async () => {
      const ucm = buildUniversalCodeModel('CDGS_finalyear', 'abc123d', {
        languages: { TypeScript: 10 },
        primaryLanguage: 'typescript',
        frameworks: ['React', 'Express'],
        projectType: 'Full Stack Web Application',
        configFiles: ['package.json', 'Dockerfile'],
        totalFiles: 10,
        hasTests: true,
        testFramework: 'Vitest',
        hasDocker: true,
        hasAuth: true,
        envVars: [],
        runCommands: [],
        repositoryTree: 'project/',
      }, [])

      const overview = await generateOverviewDoc(ucm, MOCK_CHANGESET, 'AI Summary Notes')
      expect(overview.filePath).toBe('docs/index.md')
      expect(overview.content).toContain('Overview')

      const arch = await generateArchitectureDoc(ucm)
      expect(arch.filePath).toBe('docs/architecture.md')
      expect(arch.content).toContain('```mermaid')
      expect(arch.content).toContain('graph TD')
    })
  })

  describe('AI Synthesis & Fallback Engine', () => {
    it('synthesizes release notes using deterministic AST engine fallback when no API key is set', async () => {
      const result = await synthesizeAISummary('CDGS_finalyear', MOCK_CHANGESET)

      expect(result.modelUsed).toBe('deterministic-ast-engine')
      expect(result.summaryText).toContain('Automated Release Notes: `abc123d`')
    })
  })
})
