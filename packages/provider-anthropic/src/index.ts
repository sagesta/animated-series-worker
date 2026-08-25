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

export type AnthropicProviderErrorCode =
  | 'invalid-key'
  | 'insufficient-permissions'
  | 'timed-out'
  | 'rate-limited'
  | 'provider-unavailable'
  | 'invalid-response'
  | 'unsupported-model'

export class AnthropicProviderError extends Error {
  readonly code: AnthropicProviderErrorCode

  constructor(code: AnthropicProviderErrorCode, message: string) {
    super(message)
    this.name = 'AnthropicProviderError'
    this.code = code
  }
}

export interface AnthropicClientOptions {
  fetchImpl?: typeof fetch
  baseUrl?: string
  timeoutMs?: number
  generationTimeoutMs?: number
}

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000
const DEFAULT_GENERATION_TIMEOUT_MS = 300_000

const ModelsResponseSchema = z.object({
  data: z.array(
    z
      .object({
        id: z.string().min(1),
        display_name: z.string().min(1).optional()
      })
      .passthrough()
  )
})

const MessageResponseSchema = z
  .object({
    id: z.string().min(1),
    stop_reason: z.string().nullable().optional(),
    content: z.array(
      z
        .object({
          type: z.string(),
          text: z.string().optional()
        })
        .passthrough()
    ),
    usage: z
      .object({
        input_tokens: z.number().int().nonnegative().default(0),
        output_tokens: z.number().int().nonnegative().default(0),
        cache_read_input_tokens: z.number().int().nonnegative().default(0)
      })
      .passthrough()
      .optional()
  })
  .passthrough()

function errorForStatus(status: number): AnthropicProviderError {
  if (status === 401) {
    return new AnthropicProviderError(
      'invalid-key',
      'Anthropic rejected that API key. Check it and try again.'
    )
  }
  if (status === 403) {
    return new AnthropicProviderError(
      'insufficient-permissions',
      'That Anthropic key cannot perform this action. Check its workspace permissions.'
    )
  }
  if (status === 404) {
    return new AnthropicProviderError(
      'unsupported-model',
      'Anthropic could not use the selected model. Refresh the available models and choose again.'
    )
  }
  if (status === 429) {
    return new AnthropicProviderError(
      'rate-limited',
      'Anthropic is temporarily limiting requests or the account needs billing attention. Try again after checking the account.'
    )
  }
  if (status >= 500) {
    return new AnthropicProviderError(
      'provider-unavailable',
      'Anthropic is temporarily unavailable. The local project was not changed.'
    )
  }
  return new AnthropicProviderError(
    'invalid-response',
    'Anthropic could not complete that request. Review the model and request, then try again.'
  )
}

export class AnthropicClient {
  private readonly fetchImpl: typeof fetch
  private readonly baseUrl: string
  private readonly requestTimeoutMs: number
  private readonly generationTimeoutMs: number

  constructor(options: AnthropicClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch
    this.baseUrl = (options.baseUrl ?? 'https://api.anthropic.com').replace(/\/$/, '')
    this.requestTimeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
    this.generationTimeoutMs =
      options.generationTimeoutMs ?? options.timeoutMs ?? DEFAULT_GENERATION_TIMEOUT_MS
  }

  async listModels(apiKey: string): Promise<WritingModelOption[]> {
    const response = await this.request(
      '/v1/models?limit=100',
      apiKey,
      { method: 'GET' },
      this.requestTimeoutMs
    )
    const payload = ModelsResponseSchema.safeParse(await this.readJson(response))
    if (!payload.success) {
      throw new AnthropicProviderError(
        'invalid-response',
        'Anthropic returned an unexpected model list. Nothing was saved.'
      )
    }
    const models = payload.data.data.slice(0, 100).map((item) => ({
      id: item.id,
      displayName: item.display_name ?? item.id
    }))
    if (models.length === 0) {
      throw new AnthropicProviderError(
        'insufficient-permissions',
        'The Anthropic key worked, but no writing models were available to it.'
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
      '/v1/messages',
      apiKey,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: input.model,
          max_tokens: input.maxOutputTokens,
          system: input.systemInstruction,
          messages: [{ role: 'user', content: input.userPrompt }],
          output_config: {
            format: { type: 'json_schema', schema: CREATIVE_DRAFT_JSON_SCHEMA }
          }
        })
      },
      this.generationTimeoutMs
    )
    const payload = MessageResponseSchema.safeParse(await this.readJson(response))
    if (!payload.success || payload.data.stop_reason === 'refusal') {
      throw new AnthropicProviderError(
        'invalid-response',
        'Anthropic did not return a usable structured draft. No draft was saved.'
      )
    }
    if (payload.data.stop_reason === 'max_tokens') {
      throw new AnthropicProviderError(
        'invalid-response',
        'Anthropic reached the response limit before completing the draft. Increase the limit and try again.'
      )
    }
    const outputText = payload.data.content.find(
      (content) => content.type === 'text' && content.text
    )?.text
    if (!outputText) {
      throw new AnthropicProviderError(
        'invalid-response',
        'Anthropic did not return a usable writing draft. No draft was saved.'
      )
    }

    let output: unknown
    try {
      output = JSON.parse(outputText)
    } catch {
      throw new AnthropicProviderError(
        'invalid-response',
        'Anthropic returned incomplete structured writing. No draft was saved.'
      )
    }
    const parsedOutput = CreativeDraftContentSchema.safeParse(output)
    if (!parsedOutput.success) {
      throw new AnthropicProviderError(
        'invalid-response',
        'Anthropic returned writing that did not match the safe proposal format. No draft was saved.'
      )
    }
    const usage = payload.data.usage
    const inputTokens = usage?.input_tokens ?? 0
    const outputTokens = usage?.output_tokens ?? 0
    return WritingProviderDraftResponseSchema.parse({
      output: parsedOutput.data,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        cachedInputTokens: usage?.cache_read_input_tokens ?? 0
      },
      requestId: response.headers.get('request-id') ?? payload.data.id
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
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          ...init.headers
        },
        signal: AbortSignal.timeout(timeoutMs)
      })
      if (!response.ok) throw errorForStatus(response.status)
      return response
    } catch (error) {
      if (error instanceof AnthropicProviderError) throw error
      if (
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError')
      ) {
        throw new AnthropicProviderError(
          'timed-out',
          'Anthropic took too long to respond. The local project was not changed.'
        )
      }
      throw new AnthropicProviderError(
        'provider-unavailable',
        'Anthropic could not be reached. Check the internet connection and try again.'
      )
    }
  }

  private async readJson(response: Response): Promise<unknown> {
    try {
      return await response.json()
    } catch {
      throw new AnthropicProviderError(
        'invalid-response',
        'Anthropic returned unreadable information. No local setting or draft was changed.'
      )
    }
  }
}
