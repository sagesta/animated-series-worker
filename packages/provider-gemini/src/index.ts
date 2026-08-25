import { z } from 'zod'
import {
  CREATIVE_DRAFT_JSON_SCHEMA,
  CreativeDraftContentSchema,
  WritingModelOptionSchema,
  WritingProviderDraftInputSchema,
  WritingProviderDraftResponseSchema,
  type WritingModelOption,
  type WritingProviderDraftInput,
  type WritingProviderDraftResponse
} from '@studio/contracts'

export type GeminiProviderErrorCode =
  | 'invalid-key'
  | 'insufficient-permissions'
  | 'timed-out'
  | 'rate-limited'
  | 'provider-unavailable'
  | 'invalid-response'
  | 'unsupported-model'

export class GeminiProviderError extends Error {
  readonly code: GeminiProviderErrorCode

  constructor(code: GeminiProviderErrorCode, message: string) {
    super(message)
    this.name = 'GeminiProviderError'
    this.code = code
  }
}

export interface GeminiClientOptions {
  fetchImpl?: typeof fetch
  baseUrl?: string
  timeoutMs?: number
  generationTimeoutMs?: number
}

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000
const DEFAULT_GENERATION_TIMEOUT_MS = 300_000

const ModelsResponseSchema = z.object({
  models: z.array(
    z
      .object({
        name: z.string().min(1),
        displayName: z.string().min(1).optional(),
        supportedGenerationMethods: z.array(z.string()).optional()
      })
      .passthrough()
  )
})

const GenerateContentResponseSchema = z
  .object({
    responseId: z.string().min(1),
    candidates: z.array(
      z
        .object({
          finishReason: z.string().optional(),
          content: z
            .object({
              parts: z.array(z.object({ text: z.string().optional() }).passthrough())
            })
            .passthrough()
            .optional()
        })
        .passthrough()
    ),
    usageMetadata: z
      .object({
        promptTokenCount: z.number().int().nonnegative().default(0),
        candidatesTokenCount: z.number().int().nonnegative().default(0),
        totalTokenCount: z.number().int().nonnegative().default(0),
        cachedContentTokenCount: z.number().int().nonnegative().default(0)
      })
      .passthrough()
      .optional()
  })
  .passthrough()

function errorForStatus(status: number, operation: 'models' | 'generate'): GeminiProviderError {
  if (status === 401 || (status === 400 && operation === 'models')) {
    return new GeminiProviderError(
      'invalid-key',
      'Google Gemini rejected that API key. Check it and try again.'
    )
  }
  if (status === 403) {
    return new GeminiProviderError(
      'insufficient-permissions',
      'That Gemini key cannot perform this action. Check its Google AI project permissions.'
    )
  }
  if (status === 404) {
    return new GeminiProviderError(
      'unsupported-model',
      'Gemini could not use the selected model. Refresh the available models and choose again.'
    )
  }
  if (status === 429) {
    return new GeminiProviderError(
      'rate-limited',
      'Gemini is temporarily limiting requests or the account needs quota attention. Try again after checking the account.'
    )
  }
  if (status >= 500) {
    return new GeminiProviderError(
      'provider-unavailable',
      'Gemini is temporarily unavailable. The local project was not changed.'
    )
  }
  return new GeminiProviderError(
    'invalid-response',
    'Gemini could not complete that request. Review the model and request, then try again.'
  )
}

export class GeminiClient {
  private readonly fetchImpl: typeof fetch
  private readonly baseUrl: string
  private readonly requestTimeoutMs: number
  private readonly generationTimeoutMs: number

  constructor(options: GeminiClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch
    this.baseUrl = (options.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta').replace(
      /\/$/,
      ''
    )
    this.requestTimeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
    this.generationTimeoutMs =
      options.generationTimeoutMs ?? options.timeoutMs ?? DEFAULT_GENERATION_TIMEOUT_MS
  }

  async listModels(apiKey: string): Promise<WritingModelOption[]> {
    const response = await this.request(
      '/models?pageSize=1000',
      apiKey,
      { method: 'GET' },
      'models',
      this.requestTimeoutMs
    )
    const payload = ModelsResponseSchema.safeParse(await this.readJson(response))
    if (!payload.success) {
      throw new GeminiProviderError(
        'invalid-response',
        'Gemini returned an unexpected model list. Nothing was saved.'
      )
    }
    const models = payload.data.models
      .filter(
        (model) =>
          model.name.startsWith('models/gemini-') &&
          model.supportedGenerationMethods?.includes('generateContent')
      )
      .map((model) => ({
        id: model.name.replace(/^models\//, ''),
        displayName: model.displayName ?? model.name.replace(/^models\//, '')
      }))
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(0, 100)
    if (models.length === 0) {
      throw new GeminiProviderError(
        'insufficient-permissions',
        'The Gemini key worked, but no compatible writing models were available to it.'
      )
    }
    return WritingModelOptionSchema.array().max(100).parse(models)
  }

  async generateDraft(
    apiKey: string,
    unknownInput: WritingProviderDraftInput
  ): Promise<WritingProviderDraftResponse> {
    const input = WritingProviderDraftInputSchema.parse(unknownInput)
    const response = await this.request(
      `/models/${encodeURIComponent(input.model)}:generateContent`,
      apiKey,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: input.systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: input.userPrompt }] }],
          generationConfig: {
            maxOutputTokens: input.maxOutputTokens,
            responseMimeType: 'application/json',
            responseJsonSchema: CREATIVE_DRAFT_JSON_SCHEMA,
            thinkingConfig: {
              thinkingLevel: input.maxOutputTokens <= 2_000 ? 'low' : 'medium'
            }
          }
        })
      },
      'generate',
      this.generationTimeoutMs
    )
    const payload = GenerateContentResponseSchema.safeParse(await this.readJson(response))
    if (!payload.success) {
      throw new GeminiProviderError(
        'invalid-response',
        'Gemini returned an unexpected response. No draft was saved.'
      )
    }
    const candidate = payload.data.candidates[0]
    if (!candidate || candidate.finishReason !== 'STOP') {
      throw new GeminiProviderError(
        'invalid-response',
        'Gemini did not finish a usable structured draft. No partial writing was saved.'
      )
    }
    const outputText = candidate.content?.parts.find((part) => part.text)?.text
    if (!outputText) {
      throw new GeminiProviderError(
        'invalid-response',
        'Gemini did not return a usable writing draft. No draft was saved.'
      )
    }

    let output: unknown
    try {
      output = JSON.parse(outputText)
    } catch {
      throw new GeminiProviderError(
        'invalid-response',
        'Gemini returned incomplete structured writing. No draft was saved.'
      )
    }
    const parsedOutput = CreativeDraftContentSchema.safeParse(output)
    if (!parsedOutput.success) {
      throw new GeminiProviderError(
        'invalid-response',
        'Gemini returned writing that did not match the safe proposal format. No draft was saved.'
      )
    }
    const usage = payload.data.usageMetadata
    const inputTokens = usage?.promptTokenCount ?? 0
    const outputTokens = usage?.candidatesTokenCount ?? 0
    return WritingProviderDraftResponseSchema.parse({
      output: parsedOutput.data,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: usage?.totalTokenCount ?? inputTokens + outputTokens,
        cachedInputTokens: usage?.cachedContentTokenCount ?? 0
      },
      requestId: payload.data.responseId
    })
  }

  private async request(
    path: string,
    apiKey: string,
    init: RequestInit,
    operation: 'models' | 'generate',
    timeoutMs: number
  ): Promise<Response> {
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers: { 'x-goog-api-key': apiKey, ...init.headers },
        signal: AbortSignal.timeout(timeoutMs)
      })
      if (!response.ok) throw errorForStatus(response.status, operation)
      return response
    } catch (error) {
      if (error instanceof GeminiProviderError) throw error
      if (
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError')
      ) {
        throw new GeminiProviderError(
          'timed-out',
          'Gemini did not finish the writing request in time. Try again; no proposal was saved and the local project was not changed.'
        )
      }
      throw new GeminiProviderError(
        'provider-unavailable',
        'Gemini could not be reached. Check the internet connection and try again.'
      )
    }
  }

  private async readJson(response: Response): Promise<unknown> {
    try {
      return await response.json()
    } catch {
      throw new GeminiProviderError(
        'invalid-response',
        'Gemini returned unreadable information. No local setting or draft was changed.'
      )
    }
  }
}
