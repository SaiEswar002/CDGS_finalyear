import { Router } from 'express'
import express from 'express'
import { githubWebhookHandler } from './webhook.handler'

export const webhookRouter = Router()

/**
 * @route POST /api/v1/webhooks/github
 * @desc  Receives GitHub push events, verifies HMAC signature, creates pipeline run.
 *
 * IMPORTANT: Uses express.raw() middleware to get the raw Buffer before JSON parsing.
 * The X-Hub-Signature-256 HMAC must be computed against the raw bytes.
 */
webhookRouter.post(
  '/github',
  express.raw({ type: 'application/json', limit: '10mb' }),
  githubWebhookHandler,
)
