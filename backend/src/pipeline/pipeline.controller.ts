import { type Request, type Response, type NextFunction } from 'express'
import { validate } from '../middleware/validate'
import {
  listPipelineRunsQuerySchema,
  pipelineRunIdParamSchema,
  createPipelineRunBodySchema,
  updateStageBodySchema,
  completeRunBodySchema,
} from './pipeline.schema'
import {
  listPipelineRuns,
  getPipelineRunById,
  createPipelineRun,
  updateStageProgress,
  completePipelineRun,
} from './pipeline.service'

// ── Validation middleware instances ────────────────────────────────────────

export const validateListQuery = validate({ query: listPipelineRunsQuerySchema })
export const validateRunIdParam = validate({ params: pipelineRunIdParamSchema })
export const validateCreateBody = validate({ body: createPipelineRunBodySchema })
export const validateUpdateStageBody = validate({ body: updateStageBodySchema })
export const validateCompleteBody = validate({ body: completeRunBodySchema })

// ── Controllers ────────────────────────────────────────────────────────────

/**
 * GET /api/v1/pipeline-runs
 * List pipeline runs for the authenticated user's repositories.
 */
export async function listPipelineRunsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { repositoryId, status, limit, offset } = req.query as any
    const result = await listPipelineRuns(req.user!.id, {
      repositoryId,
      status,
      limit: Number(limit ?? 20),
      offset: Number(offset ?? 0),
    })

    res.json({
      success: true,
      message: 'Pipeline runs retrieved.',
      data: result,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/pipeline-runs/:id
 * Get pipeline run details by ID (enforces ownership).
 */
export async function getPipelineRunByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await getPipelineRunById(req.user!.id, req.params.id)

    res.json({
      success: true,
      message: 'Pipeline run retrieved.',
      data: result,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/pipeline-runs/create
 * Internal service endpoint for creating a pipeline run (used by Hari's webhook handler).
 */
export async function createPipelineRunHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const run = await createPipelineRun({
      repositoryId: req.body.repositoryId,
      commitSha: req.body.commitSha,
      beforeSha: req.body.beforeSha,
      branch: req.body.branch,
      triggeredBy: req.user?.id,
      triggerType: req.body.triggerType,
    })

    res.status(201).json({
      success: true,
      message: 'Pipeline run created.',
      data: { run },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/pipeline-runs/stage
 * Internal service endpoint for updating stage progress (used by Lokesh's worker).
 */
export async function updateStageHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const run = await updateStageProgress({
      runId: req.body.runId,
      stage: req.body.stage,
      status: req.body.status,
      errorMessage: req.body.errorMessage,
      retryCount: req.body.retryCount,
    })

    res.json({
      success: true,
      message: 'Stage progress updated.',
      data: { run },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/pipeline-runs/complete
 * Internal service endpoint for completing a pipeline run and saving ChangeSet (used by Lokesh's worker).
 */
export async function completeRunHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const run = await completePipelineRun({
      runId: req.body.runId,
      status: req.body.status,
      errorMessage: req.body.errorMessage,
      changeset: req.body.changeset,
    })

    res.json({
      success: true,
      message: 'Pipeline run completed.',
      data: { run },
    })
  } catch (err) {
    next(err)
  }
}
