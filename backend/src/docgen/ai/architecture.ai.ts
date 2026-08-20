import type { UniversalCodeModel } from '../ucm.types'
import { callOpenAIStructured, computeCacheKey, type AIResponse } from './client'

export interface StructuredArchitectureData {
  highLevelOverview: string
  dataFlowExplanation: string
  componentRelationships: Array<{ source: string; target: string; explanation: string }>
}

export async function generateAIArchitectureData(
  ucm: UniversalCodeModel,
): Promise<AIResponse<StructuredArchitectureData>> {
  const meta = ucm.metadata

  const context = {
    repoName: meta.repoName,
    primaryLanguage: meta.primaryLanguage,
    frameworks: meta.frameworks,
    projectType: meta.projectType,
    dependencies: ucm.dependencies.slice(0, 30),
    routes: ucm.routes.map((r) => ({ path: r.path, method: r.method, controller: r.controllerName, service: r.serviceName, db: r.targetDatabaseTable })),
    dbTables: ucm.databaseTables.map((t) => t.tableName),
  }

  const cacheKey = computeCacheKey('architecture', context)

  const systemPrompt = `You are a cloud solution architect. Explain the system component architecture based ONLY on static analysis dependency facts.`

  const userPrompt = `Analyze the component architecture facts for ${meta.repoName}:

${JSON.stringify(context, null, 2)}

Return a JSON object matching this schema:
{
  "highLevelOverview": "Technical description of overall architecture pattern (e.g., MVC, Layered Monolith, Microservices, Component-driven UI)",
  "dataFlowExplanation": "Step-by-step trace of how data flows from entry point to persistent storage",
  "componentRelationships": [
    {
      "source": "Source Component",
      "target": "Target Component",
      "explanation": "Technical interaction explanation"
    }
  ]
}`

  return callOpenAIStructured<StructuredArchitectureData>(systemPrompt, userPrompt, cacheKey)
}
