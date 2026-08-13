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

    // 2. Fetch specific version
    const { data: versionRecord, error: versionErr } = await supabase
      .from('documentation_versions')
      .select('*')
      .eq('id', versionId)
      .eq('repository_id', repositoryId)
      .single()

    if (versionErr || !versionRecord) {
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
