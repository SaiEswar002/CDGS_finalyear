import { getSupabaseClient } from '../db/supabaseClient'
import { parseWorkspaceFiles } from './parser.service'
import { generateSwaggerDoc } from './swagger.generator'
import { generateJSDocDoc } from './jsdoc.generator'
import { generateMKDocsDoc } from './mkdocs.generator'
import { synthesizeAISummary } from './ai.service'
import type { ChangeSet } from '../pipeline/pipeline.types'
import type { DocumentationResult, GeneratedDocument } from './docgen.types'
import { logger } from '../logger'

/**
 * Main orchestrator for Phase 4 Documentation Generation.
 * Generates Swagger, JSDoc, MKDocs, AI release notes, and stores
 * versioned snapshots in Supabase documentation_versions & documents.
 */
export async function generateAndPersistDocumentation(
  repositoryId: string,
  repoFullName: string,
  runId: string,
  commitSha: string,
  workspaceDir: string,
  changeset: ChangeSet,
): Promise<DocumentationResult> {
  logger.info({ repositoryId, repoFullName, commitSha }, 'Starting Phase 4 Documentation Generation')

  // 1. Parse changed workspace files
  const parsedFiles = await parseWorkspaceFiles(workspaceDir, changeset)

  // 2. Generate Swagger, JSDoc, and MKDocs artifacts
  const generatedDocs: GeneratedDocument[] = []

  const swaggerDoc = generateSwaggerDoc(repoFullName, parsedFiles)
  if (swaggerDoc) generatedDocs.push(swaggerDoc)

  const jsdocDocs = generateJSDocDoc(parsedFiles)
  generatedDocs.push(...jsdocDocs)

  const mkdocsHome = generateMKDocsDoc(repoFullName, changeset, generatedDocs)
  generatedDocs.unshift(mkdocsHome)

  // 3. Synthesize AI summary / release notes
  const aiResult = await synthesizeAISummary(repoFullName, changeset)

  // 4. Persist Versioned Snapshot to Supabase PostgreSQL
  const supabase = getSupabaseClient()

  // Get max version_number for repo
  const { data: latestVersion } = await supabase
    .from('documentation_versions')
    .select('version_number')
    .eq('repository_id', repositoryId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const newVersionNumber = (latestVersion?.version_number || 0) + 1

  // Insert documentation_versions record
  const { data: versionRecord, error: versionErr } = await supabase
    .from('documentation_versions')
    .insert({
      run_id: runId,
      repository_id: repositoryId,
      version_number: newVersionNumber,
      commit_sha: commitSha,
      is_published: true,
      published_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (versionErr || !versionRecord) {
    logger.error({ err: versionErr }, 'Failed to insert documentation_version record')
  }

  // Insert individual documents
  if (versionRecord) {
    for (const doc of generatedDocs) {
      try {
        await supabase.from('documents').insert({
          version_id: versionRecord.id,
          repository_id: repositoryId,
          file_path: doc.filePath,
          doc_type: doc.docType,
          title: doc.title,
          content: doc.content,
          content_hash: doc.contentHash,
          ai_model: aiResult.modelUsed,
          token_count: aiResult.tokensUsed,
        })
      } catch (err: unknown) {
        logger.warn({ err, file: doc.filePath }, 'Failed to insert document artifact')
      }
    }
  }

  const result: DocumentationResult = {
    versionNumber: newVersionNumber,
    documents: generatedDocs,
    summaryText: aiResult.summaryText,
    totalTokens: aiResult.tokensUsed,
  }

  logger.info(
    { repositoryId, versionNumber: newVersionNumber, totalDocs: generatedDocs.length },
    'Phase 4 Documentation Generation complete',
  )

  return result
}
