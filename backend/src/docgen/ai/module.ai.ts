import type { UCMEntity } from '../ucm.types'
import { callOpenAIStructured, computeCacheKey, type AIResponse } from './client'

export interface StructuredModuleData {
  purpose: string
  responsibilities: string[]
  symbolExplanations: Record<string, string>
}

export async function generateAIModuleData(
  filePath: string,
  entities: UCMEntity[],
): Promise<AIResponse<StructuredModuleData>> {
  const symbolSummaries = entities.map((e) => ({
    name: e.name,
    kind: e.kind,
    line: e.startLine ? `L${e.startLine}` : undefined,
    parameters: e.parameters?.map((p) => `${p.name}: ${p.type || 'any'}`),
    returnType: e.returnType,
    calls: e.calls,
    usedBy: e.usedBy,
    relatedTables: e.relatedDatabaseTables,
    snippet: e.sourceCodeSnippet ? e.sourceCodeSnippet.slice(0, 300) : undefined,
  }))

  const context = { filePath, symbols: symbolSummaries }
  const cacheKey = computeCacheKey('module', context)

  const systemPrompt = `You are a software engineer analyzing code module symbols. Generate meaningful semantic descriptions derived ONLY from static analysis facts.`

  const userPrompt = `Analyze the following file module and its symbols:

${JSON.stringify(context, null, 2)}

Return a JSON object with this exact schema:
{
  "purpose": "Precise explanation of what this file module does based on its symbols",
  "responsibilities": ["Primary responsibility 1", "Primary responsibility 2"],
  "symbolExplanations": {
    "SymbolName": "Clear explanation of what this specific symbol does"
  }
}`

  return callOpenAIStructured<StructuredModuleData>(systemPrompt, userPrompt, cacheKey)
}
