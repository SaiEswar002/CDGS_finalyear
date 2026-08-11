/**
 * Options passed to workspace git checkout operations.
 */
export interface GitCheckoutOptions {
  pipelineRunId: string
  owner: string
  repo: string
  branch: string
  beforeSha: string
  afterSha: string
  encryptedToken?: string | null
}

/**
 * Result of workspace git checkout operation.
 */
export interface GitCheckoutResult {
  workspaceDir: string
  beforeSha: string
  afterSha: string
}
