import type { Request, Response, NextFunction } from 'express'
import { getSupabaseClient } from '../db/supabaseClient'
import { logger } from '../logger'

/**
 * GET /api/v1/repositories/:id/docs/versions
 * List all generated documentation version snapshots for a repository.
 */
export async function getRepoDocVersionsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const repositoryId = req.params.id
    const userId = req.user!.id
    const supabase = getSupabaseClient()

    // 1. Verify ownership of repository
    const { data: repo, error: repoErr } = await supabase
      .from('repositories')
      .select('id')
      .eq('id', repositoryId)
      .eq('user_id', userId)
      .single()

    if (repoErr || !repo) {
      res.status(404).json({ success: false, error: 'Repository not found or access denied.' })
      return
    }

    // 2. Fetch documentation versions
    const { data: versions, error: versionErr } = await supabase
      .from('documentation_versions')
      .select(`
        id,
        run_id,
        version_number,
        commit_sha,
        is_published,
        published_at,
        created_at
      `)
      .eq('repository_id', repositoryId)
      .order('version_number', { ascending: false })

    if (versionErr) {
      logger.error({ err: versionErr, repositoryId }, 'Failed to fetch documentation versions')
      res.status(500).json({ success: false, error: 'Database error fetching documentation versions.' })
      return
    }

    res.json({
      success: true,
      data: { versions: versions ?? [] },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/repositories/:id/docs/latest
 * Get the latest published documentation snapshot and documents for a repository.
 */
export async function getLatestRepoDocsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const repositoryId = req.params.id
    const userId = req.user!.id
    const supabase = getSupabaseClient()

    // 1. Verify ownership of repository
    const { data: repo, error: repoErr } = await supabase
      .from('repositories')
      .select('id, name, owner, selected_branch')
      .eq('id', repositoryId)
      .eq('user_id', userId)
      .single()

    if (repoErr || !repo) {
      res.status(404).json({ success: false, error: 'Repository not found or access denied.' })
      return
    }

    // 2. Fetch latest version
    const { data: latestVersion, error: versionErr } = await supabase
      .from('documentation_versions')
      .select('*')
      .eq('repository_id', repositoryId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (versionErr) {
      logger.error({ err: versionErr, repositoryId }, 'Failed to fetch latest documentation version')
      res.status(500).json({ success: false, error: 'Database error.' })
      return
    }

    if (!latestVersion) {
      res.json({
        success: true,
        data: {
          version: null,
          documents: [],
        },
      })
      return
    }

    // 3. Fetch documents for this version
    const { data: documents, error: docsErr } = await supabase
      .from('documents')
      .select('*')
      .eq('version_id', latestVersion.id)
      .order('doc_type', { ascending: true })

    if (docsErr) {
      logger.error({ err: docsErr, versionId: latestVersion.id }, 'Failed to fetch version documents')
      res.status(500).json({ success: false, error: 'Database error.' })
      return
    }

    res.json({
      success: true,
      data: {
        version: latestVersion,
        documents: documents ?? [],
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/repositories/:id/docs/versions/:versionId
 * Get a specific documentation version snapshot and documents.
 */
export async function getDocVersionByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: repositoryId, versionId } = req.params
    const userId = req.user!.id
    const supabase = getSupabaseClient()

    // 1. Verify ownership of repository
    const { data: repo, error: repoErr } = await supabase
      .from('repositories')
      .select('id')
      .eq('id', repositoryId)
      .eq('user_id', userId)
      .single()

    if (repoErr || !repo) {
      res.status(404).json({ success: false, error: 'Repository not found or access denied.' })
      return
    }

    // 2. Fetch specific version (resilient to UUID, version_number, 'latest', or fallback)
    let versionRecord: any = null
    if (versionId === 'latest') {
      const { data } = await supabase
        .from('documentation_versions')
        .select('*')
        .eq('repository_id', repositoryId)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle()
      versionRecord = data
    } else if (/^\d+$/.test(versionId)) {
      const { data } = await supabase
        .from('documentation_versions')
        .select('*')
        .eq('repository_id', repositoryId)
        .eq('version_number', parseInt(versionId, 10))
        .limit(1)
        .maybeSingle()
      versionRecord = data
    } else {
      const { data } = await supabase
        .from('documentation_versions')
        .select('*')
        .eq('id', versionId)
        .eq('repository_id', repositoryId)
        .maybeSingle()
      versionRecord = data
    }

    if (!versionRecord) {
      const { data: latestData } = await supabase
        .from('documentation_versions')
        .select('*')
        .eq('repository_id', repositoryId)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle()
      versionRecord = latestData
    }

    if (!versionRecord) {
      res.status(404).json({ success: false, error: 'Documentation version not found.' })
      return
    }

    // 3. Fetch documents for this version
    const { data: documents, error: docsErr } = await supabase
      .from('documents')
      .select('*')
      .eq('version_id', versionRecord.id)

    if (docsErr) {
      logger.error({ err: docsErr, versionId }, 'Failed to fetch version documents')
      res.status(500).json({ success: false, error: 'Database error.' })
      return
    }

    res.json({
      success: true,
      data: {
        version: versionRecord,
        documents: documents ?? [],
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/repositories/:id/docs/latest/pdf
 * Export latest generated documentation snapshot as a professional PDF.
 */
export async function downloadLatestDocPdfHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const repositoryId = req.params.id
    const userId = req.user!.id
    const supabase = getSupabaseClient()

    // 1. Verify ownership of repository
    const { data: repo, error: repoErr } = await supabase
      .from('repositories')
      .select('id, name, owner, full_name')
      .eq('id', repositoryId)
      .eq('user_id', userId)
      .single()

    if (repoErr || !repo) {
      res.status(404).json({ success: false, error: 'Repository not found or access denied.' })
      return
    }

    // 2. Fetch latest version
    const { data: latestVersion, error: versionErr } = await supabase
      .from('documentation_versions')
      .select('*')
      .eq('repository_id', repositoryId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (versionErr || !latestVersion) {
      res.status(404).json({ success: false, error: 'No documentation snapshot found for this repository.' })
      return
    }

    // 3. Fetch documents
    const { data: documents, error: docsErr } = await supabase
      .from('documents')
      .select('*')
      .eq('version_id', latestVersion.id)
      .order('doc_type', { ascending: true })

    if (docsErr || !documents || documents.length === 0) {
      res.status(404).json({ success: false, error: 'No documentation artifacts found.' })
      return
    }

    // 4. Generate PDF
    const { generateDocumentationPDF } = await import('../docgen/pdf.service')
    const pdfBuffer = await generateDocumentationPDF({
      repoFullName: repo.full_name || `${repo.owner}/${repo.name}`,
      commitSha: latestVersion.commit_sha,
      versionNumber: latestVersion.version_number,
      publishedAt: latestVersion.published_at || latestVersion.created_at,
      documents: documents.map((d) => ({
        title: d.title || d.file_path,
        docType: d.doc_type,
        filePath: d.file_path,
        content: d.content || '',
      })),
    })

    const safeRepoName = (repo.name || 'repository').replace(/[^a-zA-Z0-9_-]/g, '_')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeRepoName}-documentation-v${latestVersion.version_number}.pdf"`,
    )
    res.setHeader('Content-Length', pdfBuffer.length)
    res.send(pdfBuffer)
  } catch (err) {
    logger.error({ err }, 'Failed to download latest documentation PDF')
    next(err)
  }
}

/**
 * GET /api/v1/repositories/:id/docs/versions/:versionId/pdf
 * Export specific generated documentation version snapshot as a professional PDF.
 */
export async function downloadVersionDocPdfHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: repositoryId, versionId } = req.params
    const userId = req.user!.id
    const supabase = getSupabaseClient()

    // 1. Verify ownership
    const { data: repo, error: repoErr } = await supabase
      .from('repositories')
      .select('id, name, owner, full_name')
      .eq('id', repositoryId)
      .eq('user_id', userId)
      .single()

    if (repoErr || !repo) {
      res.status(404).json({ success: false, error: 'Repository not found or access denied.' })
      return
    }

    // 2. Fetch specific version (resilient resolution)
    let versionRecord: any = null
    if (versionId === 'latest') {
      const { data } = await supabase
        .from('documentation_versions')
        .select('*')
        .eq('repository_id', repositoryId)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle()
      versionRecord = data
    } else if (/^\d+$/.test(versionId)) {
      const { data } = await supabase
        .from('documentation_versions')
        .select('*')
        .eq('repository_id', repositoryId)
        .eq('version_number', parseInt(versionId, 10))
        .limit(1)
        .maybeSingle()
      versionRecord = data
    } else {
      const { data } = await supabase
        .from('documentation_versions')
        .select('*')
        .eq('id', versionId)
        .eq('repository_id', repositoryId)
        .maybeSingle()
      versionRecord = data
    }

    if (!versionRecord) {
      const { data: latestData } = await supabase
        .from('documentation_versions')
        .select('*')
        .eq('repository_id', repositoryId)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle()
      versionRecord = latestData
    }

    if (!versionRecord) {
      res.status(404).json({ success: false, error: 'Documentation version snapshot not found. Please click "Run Pipeline & Build Docs" first.' })
      return
    }

    // 3. Fetch documents
    const { data: documents, error: docsErr } = await supabase
      .from('documents')
      .select('*')
      .eq('version_id', versionRecord.id)

    if (docsErr || !documents || documents.length === 0) {
      res.status(404).json({ success: false, error: 'No documentation artifacts found.' })
      return
    }

    // 4. Generate PDF
    const { generateDocumentationPDF } = await import('../docgen/pdf.service')
    const pdfBuffer = await generateDocumentationPDF({
      repoFullName: repo.full_name || `${repo.owner}/${repo.name}`,
      commitSha: versionRecord.commit_sha,
      versionNumber: versionRecord.version_number,
      publishedAt: versionRecord.published_at || versionRecord.created_at,
      documents: documents.map((d) => ({
        title: d.title || d.file_path,
        docType: d.doc_type,
        filePath: d.file_path,
        content: d.content || '',
      })),
    })

    const safeRepoName = (repo.name || 'repository').replace(/[^a-zA-Z0-9_-]/g, '_')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeRepoName}-documentation-v${versionRecord.version_number}.pdf"`,
    )
    res.setHeader('Content-Length', pdfBuffer.length)
    res.send(pdfBuffer)
  } catch (err) {
    logger.error({ err }, 'Failed to download version documentation PDF')
    next(err)
  }
}
