import { Router } from 'express'
import { authenticate } from '../middleware/authenticate'
import {
  validateListQuery,
  validateRunIdParam,
  validateCreateBody,
  validateUpdateStageBody,
  validateCompleteBody,
  listPipelineRunsHandler,
  getPipelineRunByIdHandler,
  createPipelineRunHandler,
  updateStageHandler,
  completeRunHandler,
} from './pipeline.controller'

export const pipelineRouter = Router()

// All pipeline routes require authentication
pipelineRouter.use(authenticate)

/**
 * @route GET /api/v1/pipeline-runs
 * @desc  List pipeline runs for authenticated user
 */
pipelineRouter.get('/', validateListQuery, listPipelineRunsHandler)

/**
 * @route GET /api/v1/pipeline-runs/:id
 * @desc  Get pipeline run details by ID
 */
pipelineRouter.get('/:id', validateRunIdParam, getPipelineRunByIdHandler)

/**
 * @route POST /api/v1/pipeline-runs/create
 * @desc  Create a new pipeline run (Service API for Webhook Handler)
 */
pipelineRouter.post('/create', validateCreateBody, createPipelineRunHandler)

/**
 * @route POST /api/v1/pipeline-runs/stage
 * @desc  Update stage progress (Service API for Worker)
 */
pipelineRouter.post('/stage', validateUpdateStageBody, updateStageHandler)

/**
 * @route POST /api/v1/pipeline-runs/complete
 * @desc  Complete run and persist ChangeSet (Service API for Worker)
 */
pipelineRouter.post('/complete', validateCompleteBody, completeRunHandler)
