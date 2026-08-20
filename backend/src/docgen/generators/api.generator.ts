import type { UniversalCodeModel } from '../ucm.types'
import type { GeneratedDocument } from '../docgen.types'
import { computeContentHash } from '../parser.service'
import { generateAIAPIData } from '../ai/api.ai'

/**
 * Generates Detailed API Reference Documentation (`docs/api.md`).
 * Traces API Endpoint -> Handler -> Service -> Repository -> Database Table.
 * Enforces NO hardcoded 200/400/401/500 status codes unless explicitly detected.
 */
export async function generateAPIDoc(ucm: UniversalCodeModel): Promise<GeneratedDocument | null> {
  if (ucm.routes.length === 0) return null

  const aiApiRes = await generateAIAPIData(ucm.routes)
  const aiData = aiApiRes.data

  const lines: string[] = [
    `# ${ucm.metadata.repoName} — API Reference Documentation`,
    '',
    `Total Discovered Endpoints: **${ucm.routes.length}**`,
    '',
    '---',
    '',
  ]

  for (const route of ucm.routes) {
    const routeKey = `${route.method} ${route.path}`
    const aiEndpoint = aiData?.endpoints?.find((e) => e.routeKey === routeKey || e.routeKey.includes(route.path))

    const methodBadge = route.method === 'GET'
      ? '🟢 GET'
      : route.method === 'POST'
      ? '🔵 POST'
      : route.method === 'PUT'
      ? '🟠 PUT'
      : route.method === 'DELETE'
      ? '🔴 DELETE'
      : `🟣 ${route.method}`

    lines.push(
      `## ${methodBadge} \`${route.path}\``,
      '',
      `### Purpose`,
      aiEndpoint?.purpose || route.summary || `${route.method} ${route.path} endpoint handler.`,
      '',
      `### Description`,
      aiEndpoint?.description || route.description || 'Not available from repository analysis.',
      '',
      `### Authentication`,
      aiEndpoint?.authentication || (route.authRequired ? '🔒 Authentication Token Required' : 'Public / Unauthenticated'),
      '',
    )

    // Parameters
    if (route.parameters && route.parameters.length > 0) {
      lines.push(
        '### Parameters',
        '',
        '| Parameter Name | Location | Type | Required | Description |',
        '|---|---|---|---|---|',
      )
      for (const p of route.parameters) {
        lines.push(`| \`${p.name}\` | \`${p.in}\` | \`${p.type}\` | ${p.required ? 'Yes' : 'No'} | ${p.description || '-'} |`)
      }
      lines.push('')
    } else {
      lines.push('### Parameters', 'No path or query parameters required.', '')
    }

    // Request Schema
    const reqEntity = ucm.entities.find((e) => e.name === route.requestSchemaName || e.id === route.requestSchemaId)
    if (reqEntity && reqEntity.fields && reqEntity.fields.length > 0) {
      lines.push(
        '### Request Body Schema',
        `**Schema Name**: \`${reqEntity.name}\``,
        '',
        '| Field Name | Type | Required | Nullable | Default | Description |',
        '|---|---|---|---|---|---|',
      )
      for (const f of reqEntity.fields) {
        lines.push(`| \`${f.name}\` | \`${f.type || 'string'}\` | Yes | ${f.isNullable ? 'Yes' : 'No'} | ${f.defaultValue ? `\`${f.defaultValue}\`` : '-'} | ${f.description || '-'} |`)
      }
      lines.push('')
    }

    // Response Schema
    const resEntity = ucm.entities.find((e) => e.name === route.responseSchemaName || e.id === route.responseSchemaId)
    if (resEntity && resEntity.fields && resEntity.fields.length > 0) {
      lines.push(
        '### Response Payload Schema',
        `**Schema Name**: \`${resEntity.name}\``,
        '',
        '| Field Name | Type | Required | Nullable | Default | Description |',
        '|---|---|---|---|---|---|',
      )
      for (const f of resEntity.fields) {
        lines.push(`| \`${f.name}\` | \`${f.type || 'string'}\` | Yes | ${f.isNullable ? 'Yes' : 'No'} | ${f.defaultValue ? `\`${f.defaultValue}\`` : '-'} | ${f.description || '-'} |`)
      }
      lines.push('')
    }

    // Status Codes (Strictly detected only, no hardcoding!)
    lines.push('### HTTP Status Codes & Responses', '')
    if (route.responses && route.responses.length > 0) {
      lines.push(
        '| Status Code | Description | Payload Schema |',
        '|---|---|---|',
      )
      for (const res of route.responses) {
        lines.push(`| \`${res.statusCode}\` | ${res.description} | \`${res.schemaName || 'JSON Payload'}\` |`)
      }
      lines.push('')
    } else {
      lines.push('Status code information not explicitly determined from repository analysis.', '')
    }

    // Implementation Components
    lines.push(
      '### Implementation Structure',
      `- **Controller / Handler**: \`${route.handlerName}\` (${route.filePath}${route.startLine ? `:L${route.startLine}` : ''})`,
      `- **Controller Class**: \`${route.controllerName || 'Not explicitly declared'}\``,
      `- **Service Layer**: \`${route.serviceName || 'Not explicitly declared'}\``,
      `- **Repository Layer**: \`${route.repositoryName || 'Not explicitly declared'}\``,
      `- **Target Database Table**: \`${route.targetDatabaseTable || 'None / Not persisted directly'}\``,
      '',
      '### Execution Flow Trace',
      '```text',
      `${route.method} ${route.path}`,
      `    └─ Handler: ${route.handlerName}`,
      `        └─ Controller: ${route.controllerName || 'Direct Router'}`,
      `           └─ Service: ${route.serviceName || 'Domain Service'}`,
      `              └─ Repository: ${route.repositoryName || 'ORM / Data Repository'}`,
      `                 └─ Database Table: ${route.targetDatabaseTable || 'Storage Engine'}`,
      '```',
      '',
      '---',
      '',
    )
  }

  lines.push('*Generated by CDGS API & Relationship Analysis Engine.*')

  const content = lines.join('\n')

  return {
    filePath: 'docs/api.md',
    docType: 'api',
    title: 'API Reference & Endpoints',
    content,
    contentHash: computeContentHash(content),
    aiModel: aiApiRes.modelUsed,
    tokenCount: aiApiRes.tokensUsed,
  }
}
