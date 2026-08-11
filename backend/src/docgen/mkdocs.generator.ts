import type { ChangeSet } from '../pipeline/pipeline.types'
import type { GeneratedDocument } from './docgen.types'
import { computeContentHash } from './parser.service'

/**
 * Generates structured MkDocs documentation overview pages.
 */
export function generateMKDocsDoc(
  repoName: string,
  changeset: ChangeSet,
  generatedDocs: GeneratedDocument[],
): GeneratedDocument {
  const lines: string[] = [
    `# ${repoName} — Documentation Overview`,
    '',
    `> Automated documentation snapshot generated for commit \`${changeset.afterSha.slice(0, 7)}\`.`,
    '',
    '## Change Detection Summary',
    '',
    `- **Files Added**: ${changeset.summary.added}`,
    `- **Files Modified**: ${changeset.summary.modified}`,
    `- **Files Deleted**: ${changeset.summary.deleted}`,
    `- **Total Changed Files**: ${changeset.files.length}`,
    '',
    '## Generated Documentation Pages',
    '',
  ]

  for (const doc of generatedDocs) {
    lines.push(`- [${doc.title}](${doc.filePath}) (\`${doc.docType}\`)`)
  }

  lines.push('', '---', 'Powered by CDGS — Continuous Documentation Generation System.')

  const content = lines.join('\n')

  return {
    filePath: 'docs/index.md',
    docType: 'readme',
    title: `${repoName} Documentation Home`,
    content,
    contentHash: computeContentHash(content),
  }
}
