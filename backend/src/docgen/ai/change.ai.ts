import type { ChangeSet } from '../../pipeline/pipeline.types'
import { callOpenAIStructured, computeCacheKey, type AIResponse } from './client'

export interface StructuredChangeSummary {
  releaseSummary: string
  majorChanges: string[]
  apiChanges: { added: string[]; modified: string[]; removed: string[] }
  architectureChanges: string[]
  databaseChanges: string[]
  configChanges: string[]
}

export async function generateAIChangeSummary(
  repoName: string,
  changeset: ChangeSet,
): Promise<AIResponse<StructuredChangeSummary>> {
  const context = {
    repoName,
    commitSha: changeset.afterSha,
    summary: changeset.summary,
    files: changeset.files.slice(0, 40).map((f) => ({
      path: f.path,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
    })),
  }

  const cacheKey = computeCacheKey('change', context)

  const systemPrompt = `You are a release engineer. Synthesize concise, professional release notes from a Git changeset.`

  const userPrompt = `Synthesize release notes for ${repoName} at commit ${changeset.afterSha.slice(0, 7)}:

${JSON.stringify(context, null, 2)}

Return a JSON object with this exact structure:
{
  "releaseSummary": "Executive overview of changes introduced in this commit",
  "majorChanges": ["Major change bullet 1", "Major change bullet 2"],
  "apiChanges": {
    "added": [],
    "modified": [],
    "removed": []
  },
  "architectureChanges": [],
  "databaseChanges": [],
  "configChanges": []
}`

  return callOpenAIStructured<StructuredChangeSummary>(systemPrompt, userPrompt, cacheKey)
}
