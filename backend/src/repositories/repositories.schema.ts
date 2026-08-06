import { z } from 'zod'

/**
 * Schema for POST /api/v1/repositories — import a repository.
 */
export const importRepositorySchema = z.object({
  github_repo_id: z
    .number({ required_error: 'github_repo_id is required' })
    .int('github_repo_id must be an integer')
    .positive('github_repo_id must be positive'),
  owner: z.string().min(1, 'owner is required').max(100),
  name: z.string().min(1, 'name is required').max(100),
})

export type ImportRepositoryBody = z.infer<typeof importRepositorySchema>

/**
 * Schema for GET /api/v1/repositories/:id — validate UUID param.
 */
export const repositoryIdParamSchema = z.object({
  id: z.string().uuid('Repository ID must be a valid UUID'),
})
