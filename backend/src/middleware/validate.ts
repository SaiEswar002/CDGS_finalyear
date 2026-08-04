import { type Request, type Response, type NextFunction, type RequestHandler } from 'express'
import { type ZodSchema, ZodError } from 'zod'
import { HttpError } from './errorHandler'

/**
 * Target locations in a request to validate.
 */
type ValidationTarget = 'body' | 'params' | 'query'

/**
 * Schema map for multi-target validation.
 */
type SchemaMap = Partial<Record<ValidationTarget, ZodSchema>>

/**
 * Zod validation middleware factory.
 *
 * Accepts a schema map and returns an Express middleware that validates
 * the specified targets. On failure, calls `next(HttpError)` with a
 * `VALIDATION_ERROR` code and the formatted zod issues as `details`.
 *
 * @example
 * ```ts
 * router.post(
 *   '/repos',
 *   validate({ body: createRepoSchema }),
 *   createRepoHandler,
 * )
 * ```
 *
 * @param schemas - A map of validation targets to their Zod schemas
 * @returns Express middleware
 */
export function validate(schemas: SchemaMap): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const targets: ValidationTarget[] = ['body', 'params', 'query']

    for (const target of targets) {
      const schema = schemas[target]
      if (!schema) continue

      const result = schema.safeParse(req[target])

      if (!result.success) {
        const details = formatZodError(result.error)
        return next(
          new HttpError(
            400,
            'VALIDATION_ERROR',
            `Invalid ${target}: ${details.map((d) => d.message).join(', ')}`,
            details,
          ),
        )
      }

      // Replace the raw input with the parsed (coerced) value
      ;(req as unknown as Record<string, unknown>)[target] = result.data
    }

    next()
  }
}

/** Formats a ZodError into a serialisable array of issue objects. */
function formatZodError(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }))
}
