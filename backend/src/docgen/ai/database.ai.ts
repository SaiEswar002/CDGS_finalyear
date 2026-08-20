import type { UCMDatabaseTable } from '../ucm.types'
import { callOpenAIStructured, computeCacheKey, type AIResponse } from './client'

export interface StructuredDatabaseData {
  overview: string
  entityPurposes: Record<string, string>
  relationshipExplanations: string[]
  dataLifecycle: string
}

export async function generateAIDatabaseData(
  tables: UCMDatabaseTable[],
): Promise<AIResponse<StructuredDatabaseData>> {
  const tableFacts = tables.map((t) => ({
    tableName: t.tableName,
    columns: t.columns.map((c) => ({ name: c.name, type: c.type, pk: c.isPrimaryKey, fk: c.isForeignKey, ref: c.references })),
    relationships: t.relationships,
  }))

  const context = { tables: tableFacts }
  const cacheKey = computeCacheKey('database', context)

  const systemPrompt = `You are a database architect. Enrich relational database metadata with clear semantic explanations based strictly on static table schemas.`

  const userPrompt = `Analyze the discovered database table schemas:

${JSON.stringify(context, null, 2)}

Return a JSON object with this structure:
{
  "overview": "High-level database design and schema overview",
  "entityPurposes": {
    "tableName": "Purpose and business domain entity represented by this table"
  },
  "relationshipExplanations": [
    "Explanation of foreign key / ER relationship between tables"
  ],
  "dataLifecycle": "Overview of how data is created, queried, and updated across entities"
}`

  return callOpenAIStructured<StructuredDatabaseData>(systemPrompt, userPrompt, cacheKey)
}
