import type { UniversalCodeModel } from '../ucm.types'
import type { ChangeSet } from '../../pipeline/pipeline.types'
import type { GeneratedDocument } from '../docgen.types'
import { computeContentHash } from '../parser.service'
import { generateAIOverviewData } from '../ai/overview.ai'

/**
 * Generates Real Technical Overview Documentation (`docs/index.md`).
 */
export async function generateOverviewDoc(
  ucm: UniversalCodeModel,
  changeset: ChangeSet,
  summaryText: string,
): Promise<GeneratedDocument> {
  const meta = ucm.metadata
  const aiRes = await generateAIOverviewData(ucm)
  const aiData = aiRes.data

  const lines: string[] = [
    `# ${meta.repoName} — Comprehensive Technical Documentation`,
    '',
    `> **Technical Documentation Snapshot** automatically generated for commit \`${meta.commitSha.slice(0, 7)}\`.`,
    '',
    '---',
    '',
    '## 1. Project Overview',
    '',
    aiData?.purpose || `This project is a software application developed primarily in \`${meta.primaryLanguage}\` (${meta.projectType}).`,
    '',
    '## 2. Problem Statement',
    '',
    aiData?.problemSolved || `The system provides automated capabilities for handling software logic, managing data persistence, and servicing client operations in \`${meta.primaryLanguage}\`.`,
    '',
    '## 3. Key Features',
    '',
  ]

  if (aiData?.keyFeatures && aiData.keyFeatures.length > 0) {
    for (const feat of aiData.keyFeatures) {
      lines.push(`- ${feat}`)
    }
  } else {
    lines.push(`- Core \`${meta.primaryLanguage}\` application architecture and business domain logic.`)
    if (ucm.routes.length > 0) lines.push(`- Automated API route handling with ${ucm.routes.length} discovered endpoints.`)
    if (ucm.databaseTables.length > 0) lines.push(`- Relational/Document database schema management with ${ucm.databaseTables.length} tables.`)
    if (meta.hasDocker) lines.push('- Containerized deployment with Docker infrastructure support.')
    if (meta.hasTests) lines.push(`- Test suite organization powered by ${meta.testFramework || 'standard testing library'}.`)
  }

  lines.push(
    '',
    '## 4. Technology Stack',
    '',
    '| Layer | Technology | Status / Details |',
    '|---|---|---|',
    `| Primary Language | \`${meta.primaryLanguage}\` | ${meta.totalFiles} source files |`,
    `| Frameworks | ${meta.frameworks.length > 0 ? meta.frameworks.map((f) => `\`${f}\``).join(', ') : 'Standard Library'} | Detected from repository manifests |`,
    `| Project Type | ${meta.projectType} | Repository classification |`,
    `| Containerization | ${meta.hasDocker ? 'Docker / Docker Compose' : 'None detected'} | ${meta.hasDocker ? '✅ Active' : 'Not configured'} |`,
    `| Testing | ${meta.hasTests ? meta.testFramework || 'Active' : 'None detected'} | ${meta.hasTests ? '✅ Configured' : 'Not detected'} |`,
    `| Security / Auth | ${meta.hasAuth ? 'Authentication Guard Detected' : 'Standard'} | ${meta.hasAuth ? '🔒 Active' : 'Not explicitly declared'} |`,
    '',
    '### Languages Breakdown',
    '',
    '| Language | File Count | Percentage |',
    '|---|---|---|',
  )

  const totalLangFiles = Object.values(meta.languages).reduce((a, b) => a + b, 0) || 1
  for (const [lang, count] of Object.entries(meta.languages)) {
    const pct = ((count / totalLangFiles) * 100).toFixed(1)
    lines.push(`| \`${lang}\` | ${count} | ${pct}% |`)
  }

  lines.push(
    '',
    '## 5. Major Components & System Summary',
    '',
    `- **API Endpoints**: ${ucm.routes.length}`,
    `- **Code Symbols & Entities**: ${ucm.entities.length}`,
    `- **Database Tables / Entities**: ${ucm.databaseTables.length}`,
    `- **Inter-Component Dependencies**: ${ucm.dependencies.length}`,
    '',
    '## 6. Architecture & Data Flow Overview',
    '',
    aiData?.architectureSummary || `The project utilizes a ${meta.projectType} architectural structure connecting input handlers to underlying domain services and data persistence layers.`,
    '',
    '## 7. Security & Authentication',
    '',
    aiData?.securitySummary || (meta.hasAuth ? 'Authentication and authorization security guards detected within routing middleware.' : 'Security configuration is managed via environment parameters and framework defaults.'),
    '',
    '## 8. Repository Folder Structure',
    '',
    '```text',
    meta.repositoryTree || 'project/',
    '```',
    '',
    '## 9. Release & Change History',
    '',
    summaryText || `Commit SHA: \`${meta.commitSha.slice(0, 7)}\` — ${changeset.summary.added} added, ${changeset.summary.modified} modified, ${changeset.summary.deleted} deleted.`,
    '',
    '---',
    '*Powered by CDGS OpenAI Semantic Documentation Engine.*',
  )

  const content = lines.join('\n')

  return {
    filePath: 'docs/index.md',
    docType: 'readme',
    title: `${meta.repoName} Overview`,
    content,
    contentHash: computeContentHash(content),
    aiModel: aiRes.modelUsed,
    tokenCount: aiRes.tokensUsed,
  }
}
