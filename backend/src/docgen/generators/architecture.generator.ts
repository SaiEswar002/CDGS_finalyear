import type { UniversalCodeModel } from '../ucm.types'
import type { GeneratedDocument } from '../docgen.types'
import { computeContentHash } from '../parser.service'
import { generateAIArchitectureData } from '../ai/architecture.ai'

/**
 * Generates Dynamic Repository-Adapted Architecture & Data Flow Documentation (`docs/architecture.md`).
 */
export async function generateArchitectureDoc(ucm: UniversalCodeModel): Promise<GeneratedDocument> {
  const meta = ucm.metadata
  const aiArchRes = await generateAIArchitectureData(ucm)
  const aiData = aiArchRes.data

  const lines: string[] = [
    `# ${meta.repoName} — System Architecture & Data Flow`,
    '',
    `> **System Architecture & Dependency Relationships** dynamically derived from repository analysis for \`${meta.repoName}\`.`,
    '',
    '---',
    '',
    '## 1. High-Level Architecture Overview',
    '',
    aiData?.highLevelOverview || `This repository represents a \`${meta.projectType}\` developed in \`${meta.primaryLanguage}\` utilizing frameworks: ${meta.frameworks.join(', ') || 'Standard Library'}.`,
    '',
    '## 2. Component Relationship Diagram',
    '',
    '```mermaid',
    'graph TD',
  ]

  // Build dynamic Mermaid Diagram nodes based on detected technologies and entities
  const nodes = new Set<string>()
  const edges: string[] = []

  // 1. Client / Frontend layer
  const hasFrontendComp = ucm.entities.some((e) => e.kind === 'component' || e.kind === 'hook')
  const clientName = meta.frameworks.includes('React')
    ? 'React Frontend'
    : meta.frameworks.includes('Angular')
    ? 'Angular App'
    : meta.frameworks.includes('Vue')
    ? 'Vue.js App'
    : hasFrontendComp
    ? 'Frontend UI Layer'
    : 'Client Application'

  nodes.add(`    Client["${clientName}"]`)

  // 2. API / Backend Framework layer
  const serverName = meta.frameworks.includes('Express')
    ? 'Express API Service'
    : meta.frameworks.includes('Spring Boot')
    ? 'Spring Boot Service'
    : meta.frameworks.includes('FastAPI')
    ? 'FastAPI Service'
    : meta.frameworks.includes('Django')
    ? 'Django App'
    : meta.frameworks.includes('NestJS')
    ? 'NestJS Backend'
    : meta.frameworks.includes('Flask')
    ? 'Flask Server'
    : `${meta.primaryLanguage.charAt(0).toUpperCase() + meta.primaryLanguage.slice(1)} Backend API`

  nodes.add(`    API["${serverName}"]`)
  edges.push('    Client --> API')

  // 3. Domain Services / Controllers derived from UCM entities
  const services = ucm.entities.filter((e) => ['service', 'controller', 'repository'].includes(e.kind))
  if (services.length > 0) {
    for (const s of services.slice(0, 5)) {
      const nodeId = `S_${s.name.replace(/[^a-zA-Z0-9]/g, '_')}`
      nodes.add(`    ${nodeId}["${s.name}"]`)
      edges.push(`    API --> ${nodeId}`)
    }
  }

  // 4. Database Storage Engine
  if (ucm.databaseTables.length > 0) {
    const dbName = meta.configFiles.some((f) => f.includes('prisma') || f.includes('supabase') || f.includes('postgres'))
      ? 'PostgreSQL Database'
      : meta.configFiles.some((f) => f.includes('mongo'))
      ? 'MongoDB Database'
      : meta.configFiles.some((f) => f.includes('redis'))
      ? 'Redis Cache & Persistence'
      : 'Database Storage Engine'

    nodes.add(`    DB[(" ${dbName} ")]`)
    if (services.length > 0) {
      const lastServiceId = `S_${services[Math.min(services.length - 1, 4)].name.replace(/[^a-zA-Z0-9]/g, '_')}`
      edges.push(`    ${lastServiceId} --> DB`)
    } else {
      edges.push('    API --> DB')
    }
  }

  // Add all dynamic nodes and edges to lines
  lines.push(...Array.from(nodes))
  lines.push(...edges)

  lines.push(
    '```',
    '',
    '---',
    '',
    '## 3. End-to-End Data Flow Sequence',
    '',
    aiData?.dataFlowExplanation || 'HTTP requests originate at the client UI or API client, pass through controller authentication guards, execute business logic in domain services, and read/write to the database.',
    '',
    '```mermaid',
    'sequenceDiagram',
    '    autonumber',
    `    actor Client as ${clientName}`,
    `    participant API as ${serverName}`,
    '    participant Service as Domain Service Layer',
  )

  if (ucm.databaseTables.length > 0) {
    lines.push('    participant DB as Database Engine')
  }

  lines.push(
    '',
    '    Client->>API: HTTP Request (Method + Endpoint Payload)',
    '    API->>Service: Dispatch Request & Validate Payload',
  )

  if (ucm.databaseTables.length > 0) {
    lines.push(
      '    Service->>DB: Execute Query / Transaction',
      '    DB-->>Service: Return Query Result / Entity Record',
    )
  }

  lines.push(
    '    Service-->>API: Return Domain DTO Response',
    '    API-->>Client: HTTP JSON Response Payload',
    '```',
    '',
    '---',
    '',
    '## 4. Component Dependencies Graph',
    '',
  )

  if (ucm.dependencies.length > 0) {
    lines.push(
      '| Relationship Type | Source Component | Target Component | Description |',
      '|---|---|---|---|',
    )

    for (const dep of ucm.dependencies.slice(0, 30)) {
      lines.push(`| \`${dep.type}\` | \`${dep.source}\` | \`${dep.target}\` | ${dep.description || '-'} |`)
    }
    lines.push('')
  } else {
    lines.push('No custom internal dependency relationships declared outside standard package imports.', '')
  }

  lines.push(
    '---',
    '*Generated by CDGS Architecture & Data-Flow Analysis Engine.*',
  )

  const content = lines.join('\n')

  return {
    filePath: 'docs/architecture.md',
    docType: 'architecture',
    title: 'Architecture & Data Flow Diagram',
    content,
    contentHash: computeContentHash(content),
    aiModel: aiArchRes.modelUsed,
    tokenCount: aiArchRes.tokensUsed,
  }
}
