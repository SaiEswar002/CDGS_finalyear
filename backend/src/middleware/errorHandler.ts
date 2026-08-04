import { type Request, type Response, type NextFunction } from 'express'
import { logger } from '../logger'

/**
 * Standard API response shape for errors.
 *
 * @example
 * ```json
 * {
 *   "success": false,
 *   "error": {
 *     "code": "VALIDATION_ERROR",
 *     "message": "Request body is invalid",
 *     "details": [...]
 *   }
 * }
 * ```
 */
export interface ApiError {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

/**
 * Custom error class that carries an HTTP status code.
 * Throw this anywhere in a route handler to trigger the centralized handler.
 *
 * @example
 * ```ts
 * throw new HttpError(404, 'NOT_FOUND', 'Repository not found')
 * ```
 */
export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

/**
 * Centralized Express error-handling middleware.
 * Must be the last `app.use()` call in app.ts.
 *
 * Handles:
 * - `HttpError` instances (operational errors)
 * - Zod validation errors (forwarded by validate middleware)
 * - Unknown errors (returns 500)
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // Express requires 4 params for error middleware — next is required even if unused
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    logger.warn({ code: err.code, status: err.statusCode }, err.message)

    const body: ApiError = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    }

    res.status(err.statusCode).json(body)
    return
  }

  // Unexpected / programmer errors — log full stack in dev
  logger.error({ err }, 'Unhandled error')

  const body: ApiError = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  }

  res.status(500).json(body)
}
