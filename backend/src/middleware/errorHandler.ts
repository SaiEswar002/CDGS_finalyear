import { type Request, type Response, type NextFunction } from 'express'
import { logger } from '../logger'

/**
 * Standard API error response shape (Phase 2 spec).
 *
 * @example
 * ```json
 * {
 *   "success": false,
 *   "message": "Authentication failed.",
 *   "errors": []
 * }
 * ```
 */
export interface ApiErrorResponse {
  success: false
  message: string
  errors: Array<{ path?: string; message: string }>
}

/**
 * Standard API success response shape.
 *
 * @example
 * ```json
 * { "success": true, "message": "Repository imported successfully.", "data": {} }
 * ```
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true
  message: string
  data: T
}

/**
 * Custom error class that carries an HTTP status code.
 * Throw this anywhere in a route handler to trigger the centralized handler.
 *
 * @example
 * ```ts
 * throw new HttpError(404, 'NOT_FOUND', 'Repository not found')
 * throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid input', [{ path: 'name', message: 'required' }])
 * ```
 */
export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly errors: Array<{ path?: string; message: string }> = [],
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
 * - `HttpError` — operational errors with known status codes
 * - Unknown errors — returns 500
 *
 * All errors are returned in the standard Phase 2 response shape:
 * `{ success: false, message, errors }`
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // Express requires 4 params for error middleware — next is required even if unused
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    logger.warn(
      { code: err.code, status: err.statusCode },
      err.message,
    )

    const body: ApiErrorResponse = {
      success: false,
      message: err.message,
      errors: err.errors,
    }

    res.status(err.statusCode).json(body)
    return
  }

  // Unexpected / programmer errors
  logger.error({ err }, 'Unhandled error')

  const body: ApiErrorResponse = {
    success: false,
    message: 'An unexpected error occurred.',
    errors: [],
  }

  res.status(500).json(body)
}
