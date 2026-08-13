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

  // Ensure runId exists in documentation_runs table for backwards-compatible DB schemas
  try {
    await supabase
      .from('documentation_runs')
      .upsert(
        {
          id: runId,
          repository_id: repositoryId,
          trigger_type: 'manual',
          commit_sha: commitSha,
          status: 'running',
        },
      )
  } catch (err: unknown) {
    logger.debug({ err, runId }, 'Optional documentation_runs upsert skipped')
  }

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
    throw new Error(`Failed to persist documentation_version record: ${versionErr?.message || 'DB Error'}`)
  }

  // Insert individual documents
  for (const doc of generatedDocs) {
    try {
      const { error: docErr } = await supabase.from('documents').insert({
        version_id: versionRecord.id,
        repository_id: repositoryId,
        file_path: doc.filePath,
        doc_type: doc.docType,
        title: doc.title || doc.filePath,
        content: doc.content || '',
        content_hash: doc.contentHash || 'hash',
        ai_model: aiResult.modelUsed,
        token_count: aiResult.tokensUsed,
      })
      if (docErr) {
        logger.warn({ err: docErr, file: doc.filePath }, 'Failed to insert document artifact')
      }
    } catch (err: unknown) {
      logger.warn({ err, file: doc.filePath }, 'Failed to insert document artifact')
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
