import { z } from 'zod'

/** Validation schema for GET /api/v1/pipeline-runs query params */
export const listPipelineRunsQuerySchema = z.object({
  repositoryId: z.string().uuid('Invalid repository ID').optional(),
  status: z.enum(['queued', 'running', 'success', 'failed', 'retrying']).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
})

/** Validation schema for pipeline run ID param */
export const pipelineRunIdParamSchema = z.object({
  id: z.string().uuid('Invalid pipeline run ID'),
})

/** Validation schema for POST /api/v1/pipeline-runs/create */
export const createPipelineRunBodySchema = z.object({
  repositoryId: z.string().uuid('Invalid repository ID'),
  commitSha: z.string().min(1, 'commitSha is required'),
  beforeSha: z.string().optional(),
  branch: z.string().min(1, 'branch is required').default('main'),
  triggerType: z.enum(['webhook', 'manual', 'scheduled']).default('webhook'),
})

/** Validation schema for POST /api/v1/pipeline-runs/stage */
export const updateStageBodySchema = z.object({
  runId: z.string().uuid('Invalid run ID'),
  stage: z.enum(['webhook', 'clone', 'diff']),
  status: z.enum(['queued', 'running', 'success', 'failed', 'retrying']),
  errorMessage: z.string().optional(),
  retryCount: z.number().int().min(0).optional(),
})

/** Validation schema for POST /api/v1/pipeline-runs/complete */
export const completeRunBodySchema = z.object({
  runId: z.string().uuid('Invalid run ID'),
  status: z.enum(['success', 'failed']),
  errorMessage: z.string().optional(),
  changeset: z
    .object({
      beforeSha: z.string(),
      afterSha: z.string(),
      files: z.array(
        z.object({
          path: z.string(),
          status: z.enum(['added', 'modified', 'deleted']),
          additions: z.number(),
          deletions: z.number(),
        }),
      ),
      summary: z.object({
        added: z.number(),
        modified: z.number(),
        deleted: z.number(),
      }),
    })
    .optional(),
})
