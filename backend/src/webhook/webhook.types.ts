/**
 * GitHub Push Event Payload Types
 * Only the fields we actually use — no need to import full @octokit types.
 */
export interface GitHubPushPayload {
  ref: string           // e.g. "refs/heads/main"
  before: string        // beforeSha
  after: string         // afterSha
  repository: {
    id: number
    full_name: string   // e.g. "SaiEswar002/CDGS_finalyear"
    name: string
    owner: {
      login: string
    }
    private: boolean
  }
  head_commit: {
    id: string
    message: string
    timestamp: string
    author: {
      name: string
      email: string
    }
  } | null
  commits: Array<{
    id: string
    message: string
  }>
  pusher: {
    name: string
    email: string
  }
}
