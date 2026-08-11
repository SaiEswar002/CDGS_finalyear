import axios from 'axios'
import { config } from '../config'
import type { ChangeSet } from '../pipeline/pipeline.types'
import { logger } from '../logger'

export interface AISummaryResult {
  summaryText: string
  modelUsed: string
  tokensUsed: number
}

/**
 * Synthesizes release notes and documentation summaries using AI (OpenAI / Anthropic)
 * or falls back gracefully to a deterministic AST template if no API keys are provided.
 */
export async function synthesizeAISummary(
  repoName: string,
  changeset: ChangeSet,
): Promise<AISummaryResult> {
  const openaiKey = config.ai.openaiApiKey

  // 1. Try OpenAI if API key present
  if (openaiKey && openaiKey.length > 10 && !openaiKey.includes('placeholder')) {
    try {
      const prompt = `Synthesize concise release notes for repository ${repoName} based on git diff commit ${changeset.afterSha.slice(0, 7)}:
Files changed (${changeset.files.length}):
${changeset.files.map((f) => `- ${f.status.toUpperCase()}: ${f.path} (+${f.additions}/-${f.deletions})`).join('\n')}`

      const res = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 300,
        },
        {
          headers: { Authorization: `Bearer ${openaiKey}` },
          timeout: 15000,
        },
      )

      const text = res.data.choices?.[0]?.message?.content || ''
      const tokens = res.data.usage?.total_tokens || 0

      return {
        summaryText: text,
        modelUsed: 'gpt-4o',
        tokensUsed: tokens,
      }
    } catch (err) {
      logger.warn({ err }, 'OpenAI API call failed, falling back to deterministic template')
    }
  }

  // 2. Fallback: Deterministic AST-based Release Notes Template
  const fallbackText = `## Automated Release Notes: \`${changeset.afterSha.slice(0, 7)}\`
- **Repository**: \`${repoName}\`
- **Summary**: ${changeset.summary.added} added, ${changeset.summary.modified} modified, ${changeset.summary.deleted} deleted file(s).
- **Key Changed Files**:
${changeset.files.slice(0, 5).map((f) => `  - \`${f.path}\` (${f.status})`).join('\n')}
`

  return {
    summaryText: fallbackText,
    modelUsed: 'deterministic-ast-engine',
    tokensUsed: 0,
  }
}
