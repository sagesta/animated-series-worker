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

export type OpenAiProviderErrorCode =
  | 'invalid-key'
  | 'insufficient-permissions'
  | 'timed-out'
  | 'rate-limited'
  | 'provider-unavailable'
  | 'invalid-response'
  | 'unsupported-model'

export class OpenAiProviderError extends Error {
  readonly code: OpenAiProviderErrorCode

  constructor(code: OpenAiProviderErrorCode, message: string) {
    super(message)
    this.name = 'OpenAiProviderError'
    this.code = code
  }
}

export interface OpenAiClientOptions {
  fetchImpl?: typeof fetch
  baseUrl?: string
  timeoutMs?: number
  generationTimeoutMs?: number
}

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000
const DEFAULT_GENERATION_TIMEOUT_MS = 300_000

const ModelsResponseSchema = z.object({
  data: z.array(z.object({ id: z.string().min(1) }).passthrough())
})

const ResponsesApiSchema = z
  .object({
    id: z.string().min(1),
    output: z.array(
      z
        .object({
          content: z
            .array(
              z
                .object({
                  type: z.string(),
                  text: z.string().optional()
                })
                .passthrough()
            )
            .optional()
        })
        .passthrough()
    ),
    usage: z
      .object({
        input_tokens: z.number().int().nonnegative().default(0),
        output_tokens: z.number().int().nonnegative().default(0),
        total_tokens: z.number().int().nonnegative().default(0),
        input_tokens_details: z
          .object({ cached_tokens: z.number().int().nonnegative().default(0) })
          .passthrough()
          .optional()
      })
      .passthrough()
      .optional()
  })
  .passthrough()

function isWritingModel(modelId: string): boolean {
  const id = modelId.toLowerCase()
  const excluded = [
    'audio',
    'image',
    'realtime',
    'transcribe',
    'tts',
    'embedding',
    'moderation',
    'search-preview'
  ]
  return /^(gpt-|chatgpt-|o\d)/.test(id) && !excluded.some((word) => id.includes(word))
}

function errorForStatus(status: number): OpenAiProviderError {
  if (status === 401) {
    return new OpenAiProviderError(
      'invalid-key',
      'OpenAI rejected that API key. Check it and try again.'
    )
  }
  if (status === 403) {
    return new OpenAiProviderError(
      'insufficient-permissions',
      'That OpenAI key cannot perform this action. Check its project permissions.'
    )
  }
  if (status === 404) {
    return new OpenAiProviderError(
      'unsupported-model',
      'OpenAI could not use the selected model. Refresh the available models and choose again.'
    )
  }
  if (status === 429) {
    return new OpenAiProviderError(
      'rate-limited',
      'OpenAI is temporarily limiting requests or the account needs billing attention. Try again after checking the account.'
    )
  }
  if (status >= 500) {
    return new OpenAiProviderError(
      'provider-unavailable',
      'OpenAI is temporarily unavailable. The local project was not changed.'
    )
  }
  return new OpenAiProviderError(
    'invalid-response',
    'OpenAI could not complete that request. Review the model and request, then try again.'
  )
}

export class OpenAiClient {
  private readonly fetchImpl: typeof fetch
  private readonly baseUrl: string
  private readonly requestTimeoutMs: number
  private readonly generationTimeoutMs: number

  constructor(options: OpenAiClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch
    this.baseUrl = (options.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '')
    this.requestTimeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
    this.generationTimeoutMs =
      options.generationTimeoutMs ?? options.timeoutMs ?? DEFAULT_GENERATION_TIMEOUT_MS
  }

  async listModels(apiKey: string): Promise<WritingModelOption[]> {
    const response = await this.request('/models', apiKey, { method: 'GET' }, this.requestTimeoutMs)
    const payload = ModelsResponseSchema.safeParse(await this.readJson(response))
    if (!payload.success) {
      throw new OpenAiProviderError(
        'invalid-response',
        'OpenAI returned an unexpected model list. Nothing was saved.'
      )
    }

    const models = payload.data.data
      .map((item) => item.id)
      .filter(isWritingModel)
      .sort((left, right) => left.localeCompare(right))
      .slice(0, 100)
      .map((id) => ({ id, displayName: id }))

    if (models.length === 0) {
      throw new OpenAiProviderError(
        'insufficient-permissions',
        'The OpenAI key worked, but no compatible writing models were available to it.'
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
      '/responses',
      apiKey,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: input.model,
          store: false,
          instructions: input.systemInstruction,
          input: input.userPrompt,
          max_output_tokens: input.maxOutputTokens,
          text: {
            format: {
              type: 'json_schema',
              name: 'creative_draft',
              strict: true,
              schema: CREATIVE_DRAFT_JSON_SCHEMA
            }
          }
        })
      },
      this.generationTimeoutMs
    )
    const payload = ResponsesApiSchema.safeParse(await this.readJson(response))
    if (!payload.success) {
      throw new OpenAiProviderError(
        'invalid-response',
        'OpenAI returned an unexpected response. No draft was saved.'
      )
    }

    const outputText = payload.data.output
      .flatMap((item) => item.content ?? [])
      .find((content) => content.type === 'output_text' && content.text)?.text
    if (!outputText) {
      throw new OpenAiProviderError(
        'invalid-response',
        'OpenAI did not return a usable writing draft. No draft was saved.'
      )
    }

    let output: unknown
    try {
      output = JSON.parse(outputText)
    } catch {
      throw new OpenAiProviderError(
        'invalid-response',
        'OpenAI returned incomplete structured writing. No draft was saved.'
      )
    }

    const parsedOutput = CreativeDraftContentSchema.safeParse(output)
    if (!parsedOutput.success) {
      throw new OpenAiProviderError(
        'invalid-response',
        'OpenAI returned writing that did not match the safe proposal format. No draft was saved.'
      )
    }
    const usage = payload.data.usage
    return WritingProviderDraftResponseSchema.parse({
      output: parsedOutput.data,
      usage: {
        inputTokens: usage?.input_tokens ?? 0,
        outputTokens: usage?.output_tokens ?? 0,
        totalTokens:
          usage?.total_tokens ?? (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
        cachedInputTokens: usage?.input_tokens_details?.cached_tokens ?? 0
      },
      requestId: response.headers.get('x-request-id') ?? payload.data.id
    })
  }

  private async request(
    path: string,
    apiKey: string,
    init: RequestInit,
    timeoutMs: number
  ): Promise<Response> {
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${apiKey}`,
          ...init.headers
        },
        signal: AbortSignal.timeout(timeoutMs)
      })
      if (!response.ok) throw errorForStatus(response.status)
      return response
    } catch (error) {
      if (error instanceof OpenAiProviderError) throw error
      if (
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError')
      ) {
        throw new OpenAiProviderError(
          'timed-out',
          'OpenAI took too long to respond. The local project was not changed.'
        )
      }
      throw new OpenAiProviderError(
        'provider-unavailable',
        'OpenAI could not be reached. Check the internet connection and try again.'
      )
    }
  }

  private async readJson(response: Response): Promise<unknown> {
    try {
      return await response.json()
    } catch {
      throw new OpenAiProviderError(
        'invalid-response',
        'OpenAI returned unreadable information. No local setting or draft was changed.'
      )
    }
  }
}
