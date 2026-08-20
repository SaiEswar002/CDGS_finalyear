import type { ChangeSet } from '../pipeline/pipeline.types'
import { generateAIChangeSummary, type StructuredChangeSummary } from './ai/change.ai'
import { isAIConfigured } from './ai/client'

export * from './ai/client'
export * from './ai/overview.ai'
export * from './ai/module.ai'
export * from './ai/api.ai'
export * from './ai/architecture.ai'
export * from './ai/database.ai'
export * from './ai/change.ai'

export interface AISummaryResult {
  summaryText: string
  modelUsed: string
  tokensUsed: number
  structuredData?: StructuredChangeSummary | null
}

/**
 * Synthesizes release notes and documentation summaries using official OpenAI SDK
 * or falls back gracefully to a deterministic template if API keys are missing/invalid.
 */
export async function synthesizeAISummary(
  repoName: string,
  changeset: ChangeSet,
): Promise<AISummaryResult> {
  if (isAIConfigured()) {
    const aiRes = await generateAIChangeSummary(repoName, changeset)
    if (aiRes.data) {
      const s = aiRes.data
      const formattedLines: string[] = [
        `## 🔄 Release Summary: \`${changeset.afterSha.slice(0, 7)}\``,
        '',
        s.releaseSummary,
        '',
      ]

      if (s.majorChanges && s.majorChanges.length > 0) {
        formattedLines.push('### Major Changes', '', s.majorChanges.map((c) => `- ${c}`).join('\n'), '')
      }

      if (s.apiChanges && (s.apiChanges.added.length || s.apiChanges.modified.length || s.apiChanges.removed.length)) {
        formattedLines.push('### API Changes', '')
        if (s.apiChanges.added.length) formattedLines.push(`**Added**: ${s.apiChanges.added.join(', ')}`)
        if (s.apiChanges.modified.length) formattedLines.push(`**Modified**: ${s.apiChanges.modified.join(', ')}`)
        if (s.apiChanges.removed.length) formattedLines.push(`**Removed**: ${s.apiChanges.removed.join(', ')}`)
        formattedLines.push('')
      }

      if (s.architectureChanges && s.architectureChanges.length > 0) {
        formattedLines.push('### Architecture Changes', '', s.architectureChanges.map((c) => `- ${c}`).join('\n'), '')
      }

      if (s.databaseChanges && s.databaseChanges.length > 0) {
        formattedLines.push('### Database Changes', '', s.databaseChanges.map((c) => `- ${c}`).join('\n'), '')
      }

      if (s.configChanges && s.configChanges.length > 0) {
        formattedLines.push('### Configuration Changes', '', s.configChanges.map((c) => `- ${c}`).join('\n'), '')
      }

      return {
        summaryText: formattedLines.join('\n'),
        modelUsed: aiRes.modelUsed,
        tokensUsed: aiRes.tokensUsed,
        structuredData: s,
      }
    }
  }

  // Fallback: Deterministic AST-based Release Notes Template
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
    structuredData: null,
  }
}
