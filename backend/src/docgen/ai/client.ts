import OpenAI from 'openai'
import crypto from 'crypto'
import { config } from '../../config'
import { logger } from '../../logger'

let openaiInstance: OpenAI | null = null

export function getOpenAIClient(): OpenAI | null {
  const apiKey = config.ai.openaiApiKey
  if (!apiKey || apiKey.length < 10 || apiKey.includes('placeholder')) {
    return null
  }
  if (!openaiInstance) {
    openaiInstance = new OpenAI({ apiKey })
  }
  return openaiInstance
}

export function isAIConfigured(): boolean {
  return getOpenAIClient() !== null
}

// In-memory cache for AI responses based on input prompt hash
const aiCache = new Map<string, { data: any; model: string; tokens: number; timestamp: number }>()

export function computeCacheKey(prefix: string, payload: any): string {
  const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
  return `${prefix}:${hash}`
}

export interface AIResponse<T> {
  data: T | null
  modelUsed: string
  tokensUsed: number
  cached: boolean
}

/**
 * Call OpenAI Chat Completions returning structured JSON.
 * Operates with strict anti-hallucination system prompt and fallback.
 */
export async function callOpenAIStructured<T>(
  systemPrompt: string,
  userPrompt: string,
  cacheKey?: string,
): Promise<AIResponse<T>> {
  const model = config.ai.openaiModel || 'gpt-4o'

  if (cacheKey && aiCache.has(cacheKey)) {
    const cachedItem = aiCache.get(cacheKey)!
    logger.debug({ cacheKey }, 'Reusing cached AI semantic explanation')
    return {
      data: cachedItem.data as T,
      modelUsed: cachedItem.model,
      tokensUsed: 0,
      cached: true,
    }
  }

  const client = getOpenAIClient()
  if (!client) {
    logger.info('OpenAI API key missing or invalid; skipping AI call.')
    return { data: null, modelUsed: 'deterministic-ast-engine', tokensUsed: 0, cached: false }
  }

  const strictSystemPrompt = `${systemPrompt}

STRICT ANTI-HALLUCINATION RULES:
1. You are an expert technical documentation assistant.
2. Rely ONLY on the facts provided in the prompt derived from static analysis of the repository.
3. If information for a field or detail is not explicitly clear or present in the facts provided, set the field value to "Not available from repository analysis." or an empty array as appropriate.
4. NEVER invent APIs, endpoints, status codes, functions, classes, database tables, environment variables, commands, or dependencies.
5. Return strictly a valid JSON object.`

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: strictSystemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 2500,
    })

    const rawContent = response.choices[0]?.message?.content || '{}'
    const tokens = response.usage?.total_tokens || 0
    const parsedData = JSON.parse(rawContent) as T

    if (cacheKey) {
      aiCache.set(cacheKey, {
        data: parsedData,
        model,
        tokens,
        timestamp: Date.now(),
      })
    }

    return {
      data: parsedData,
      modelUsed: model,
      tokensUsed: tokens,
      cached: false,
    }
  } catch (err) {
    logger.warn({ err }, 'OpenAI API call failed; falling back to evidence-based deterministic engine')
    return { data: null, modelUsed: 'deterministic-ast-engine', tokensUsed: 0, cached: false }
  }
}
