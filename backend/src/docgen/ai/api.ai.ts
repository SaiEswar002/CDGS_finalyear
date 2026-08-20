import type { UCMRoute } from '../ucm.types'
import { callOpenAIStructured, computeCacheKey, type AIResponse } from './client'

export interface StructuredEndpointExplanation {
  routeKey: string
  purpose: string
  description: string
  authentication: string
  executionFlowSummary: string
}

export interface StructuredAPIData {
  endpoints: StructuredEndpointExplanation[]
}

export async function generateAIAPIData(
  routes: UCMRoute[],
): Promise<AIResponse<StructuredAPIData>> {
  const routeFacts = routes.map((r) => ({
    key: `${r.method} ${r.path}`,
    method: r.method,
    path: r.path,
    handler: r.handlerName,
    controller: r.controllerName,
    service: r.serviceName,
    repository: r.repositoryName,
    databaseTable: r.targetDatabaseTable,
    filePath: r.filePath,
    parameters: r.parameters,
    responses: r.responses,
    authRequired: r.authRequired,
  }))

  const context = { routes: routeFacts }
  const cacheKey = computeCacheKey('api', context)

  const systemPrompt = `You are an API documentation expert. Generate precise, evidence-based descriptions for API endpoints.`

  const userPrompt = `Analyze the following API endpoints extracted from repository static analysis:

${JSON.stringify(context, null, 2)}

Return a JSON object with this exact structure:
{
  "endpoints": [
    {
      "routeKey": "GET /api/example",
      "purpose": "High-level endpoint purpose",
      "description": "Technical description of endpoint payload and operation",
      "authentication": "Description of auth requirements if authRequired is true, or 'None' if false",
      "executionFlowSummary": "Trace summary from Route -> Handler -> Service -> Database"
    }
  ]
}`

  return callOpenAIStructured<StructuredAPIData>(systemPrompt, userPrompt, cacheKey)
}
