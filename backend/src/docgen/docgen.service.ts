import { getSupabaseClient } from '../db/supabaseClient'
import { analyzeWorkspaceAndBuildUCM } from './parser.service'
import { generateOverviewDoc } from './generators/overview.generator'
import { generateGettingStartedDoc } from './generators/getting_started.generator'
import { generateAPIDoc } from './generators/api.generator'
import { generateSwaggerDoc } from './swagger.generator'
import { generateModulesDoc } from './generators/modules.generator'
import { generateDatabaseDoc } from './generators/database.generator'
import { generateArchitectureDoc } from './generators/architecture.generator'
import { generateTestingDoc } from './generators/testing.generator'
import { generateDeploymentDoc } from './generators/deployment.generator'
import { generateComponentsDoc } from './generators/components.generator'
import { validateDocumentationQuality } from './quality.service'
import { synthesizeAISummary } from './ai.service'
import type { ChangeSet } from '../pipeline/pipeline.types'
import type { DocumentationResult, GeneratedDocument } from './docgen.types'
import { logger } from '../logger'

/**
 * Main orchestrator for Language-Agnostic Industry-Level Software Documentation Generation.
 * Analyzes workspace into UCM, generates dynamic artifacts based on repository contents,
 * validates documentation quality via Quality Gate, and persists versioned snapshots in Supabase.
 */
export async function generateAndPersistDocumentation(
  repositoryId: string,
  repoFullName: string,
  runId: string,
  commitSha: string,
  workspaceDir: string,
  changeset: ChangeSet,
): Promise<DocumentationResult> {
  logger.info({ repositoryId, repoFullName, commitSha }, 'Starting Industry-Level Documentation Generation Engine')

  // 1. Build Universal Code Model (UCM) from repository workspace
  const ucm = await analyzeWorkspaceAndBuildUCM(repoFullName, commitSha, workspaceDir, changeset)

  // 2. Synthesize AI summary / release notes
  const aiResult = await synthesizeAISummary(repoFullName, changeset)

  // 3. Generate Dynamic Documentation Artifacts based on UCM discovery
  const generatedDocs: GeneratedDocument[] = []
  let totalTokenCount = aiResult.tokensUsed

  // Overview Page
  const overviewDoc = await generateOverviewDoc(ucm, changeset, aiResult.summaryText)
  if (overviewDoc.tokenCount) totalTokenCount += overviewDoc.tokenCount
  generatedDocs.push(overviewDoc)

  // Getting Started & Config Setup Guide
  const gettingStartedDoc = generateGettingStartedDoc(ucm)
  generatedDocs.push(gettingStartedDoc)

  // Architecture Diagram Page
  const archDoc = await generateArchitectureDoc(ucm)
  if (archDoc.tokenCount) totalTokenCount += archDoc.tokenCount
  generatedDocs.push(archDoc)

  // API Reference (if endpoints exist)
  const apiDoc = await generateAPIDoc(ucm)
  if (apiDoc) {
    if (apiDoc.tokenCount) totalTokenCount += apiDoc.tokenCount
    generatedDocs.push(apiDoc)
  }

  // OpenAPI Specification (if endpoints exist)
  const swaggerDoc = generateSwaggerDoc(repoFullName, ucm)
  if (swaggerDoc) generatedDocs.push(swaggerDoc)

  // Code Modules Reference
  const modulesDoc = await generateModulesDoc(ucm)
  if (modulesDoc.tokenCount) totalTokenCount += modulesDoc.tokenCount
  generatedDocs.push(modulesDoc)

  // Frontend Components Reference (if React/Vue components exist)
  const componentsDoc = generateComponentsDoc(ucm)
  if (componentsDoc) generatedDocs.push(componentsDoc)

  // Database & ER Diagram (if DB tables exist)
  const dbDoc = await generateDatabaseDoc(ucm)
  if (dbDoc) {
    if (dbDoc.tokenCount) totalTokenCount += dbDoc.tokenCount
    generatedDocs.push(dbDoc)
  }

  // Testing Strategy (if tests detected)
  const testingDoc = generateTestingDoc(ucm)
  if (testingDoc) generatedDocs.push(testingDoc)

  // Deployment Guide (if Docker detected)
  const deploymentDoc = generateDeploymentDoc(ucm)
  if (deploymentDoc) generatedDocs.push(deploymentDoc)

  // 4. Run Documentation Quality Gate & Audit Validation (Phase 17)
  const { qualityDoc } = validateDocumentationQuality(ucm, generatedDocs)
  generatedDocs.push(qualityDoc)

  // 5. Persist Versioned Snapshot to Supabase PostgreSQL
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

  // Ensure runId exists in documentation_runs table for backwards compatibility
  try {
    await supabase
      .from('documentation_runs')
      .upsert({
        id: runId,
        repository_id: repositoryId,
        trigger_type: 'manual',
        commit_sha: commitSha,
        status: 'running',
      })
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

  // Insert individual document artifacts
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
        ai_model: doc.aiModel || aiResult.modelUsed,
        token_count: doc.tokenCount || aiResult.tokensUsed,
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
    totalTokens: totalTokenCount,
  }

  logger.info(
    { repositoryId, versionNumber: newVersionNumber, totalDocs: generatedDocs.length },
    'Industry-Level Documentation Generation & Persistence complete',
  )

  return result
}
