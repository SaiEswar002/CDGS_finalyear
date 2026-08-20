import type { UniversalCodeModel } from '../ucm.types'
import { callOpenAIStructured, computeCacheKey, type AIResponse } from './client'

export interface StructuredOverviewData {
  purpose: string
  problemSolved: string
  keyFeatures: string[]
  architectureSummary: string
  securitySummary: string
}

export async function generateAIOverviewData(
  ucm: UniversalCodeModel,
): Promise<AIResponse<StructuredOverviewData>> {
  const meta = ucm.metadata

  const context = {
    repoName: meta.repoName,
    primaryLanguage: meta.primaryLanguage,
    frameworks: meta.frameworks,
    projectType: meta.projectType,
    totalFiles: meta.totalFiles,
    configFiles: meta.configFiles,
    hasAuth: meta.hasAuth,
    hasDocker: meta.hasDocker,
    hasTests: meta.hasTests,
    topEntities: ucm.entities.slice(0, 15).map((e) => ({ name: e.name, kind: e.kind, file: e.filePath })),
    routesCount: ucm.routes.length,
    dbTablesCount: ucm.databaseTables.length,
  }

  const cacheKey = computeCacheKey('overview', context)

  const systemPrompt = `You are a software architect analyzing static code metadata. Generate a technical JSON overview.`

  const userPrompt = `Synthesize a technical overview for the project based on the following verified analysis facts:

Project Info: ${JSON.stringify(context, null, 2)}

Return a JSON object matching this schema:
{
  "purpose": "High-level technical purpose of this system",
  "problemSolved": "Clear statement of what problem this system addresses",
  "keyFeatures": ["Feature 1", "Feature 2"],
  "architectureSummary": "Summary of component design",
  "securitySummary": "Authentication/security capabilities"
}`

  return callOpenAIStructured<StructuredOverviewData>(systemPrompt, userPrompt, cacheKey)
}
