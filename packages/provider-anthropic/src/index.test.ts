import { describe, expect, it, vi } from 'vitest'
import { AnthropicClient } from './index'

const draft = {
  title: 'Lantern City',
  summary: 'A world-building proposal.',
  sections: [{ heading: 'Rules', body: 'Every promise lights one public lantern.' }],
  continuityQuestions: [],
  suggestedNextSteps: ['Name the oldest district.']
}

describe('AnthropicClient', () => {
  it('uses the free model list with required Anthropic headers', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: 'claude-sonnet-test', display_name: 'Claude Sonnet Test' }]
        }),
        { status: 200 }
      )
    )
    const client = new AnthropicClient({ fetchImpl: request })

    await expect(client.listModels('sk-ant-test-protected-key-123456')).resolves.toEqual([
      { id: 'claude-sonnet-test', displayName: 'Claude Sonnet Test' }
    ])
    expect(request).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/models?limit=100',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-api-key': 'sk-ant-test-protected-key-123456',
          'anthropic-version': '2023-06-01'
        })
      })
    )
  })

  it('uses current structured output configuration and maps token usage', async () => {
    let body: Record<string, unknown> = {}
    const request = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>
      return new Response(
        JSON.stringify({
          id: 'msg_123',
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: JSON.stringify(draft) }],
          usage: { input_tokens: 90, output_tokens: 60, cache_read_input_tokens: 12 }
        }),
        { status: 200, headers: { 'request-id': 'request_456' } }
      )
    })
    const client = new AnthropicClient({ fetchImpl: request })
    const result = await client.generateDraft('sk-ant-test-protected-key-123456', {
      model: 'claude-sonnet-test',
      systemInstruction: 'Return a useful proposal.',
      userPrompt: 'Build a world from the supplied project context.',
      maxOutputTokens: 800
    })

    expect(body).toMatchObject({ model: 'claude-sonnet-test', max_tokens: 800 })
    expect(body.output_config).toMatchObject({ format: { type: 'json_schema' } })
    expect(result.output.title).toBe('Lantern City')
    expect(result.usage).toEqual({
      inputTokens: 90,
      outputTokens: 60,
      totalTokens: 150,
      cachedInputTokens: 12
    })
    expect(result.requestId).toBe('request_456')
  })

  it('rejects an incomplete max-token response instead of saving partial writing', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'msg_partial',
          stop_reason: 'max_tokens',
          content: [{ type: 'text', text: '{' }],
          usage: { input_tokens: 20, output_tokens: 40 }
        }),
        { status: 200 }
      )
    )
    const client = new AnthropicClient({ fetchImpl: request })

    await expect(
      client.generateDraft('sk-ant-test-protected-key-123456', {
        model: 'claude-sonnet-test',
        systemInstruction: 'Return a useful proposal.',
        userPrompt: 'Write a detailed proposal for this animated project.',
        maxOutputTokens: 256
      })
    ).rejects.toMatchObject({ code: 'invalid-response' })
  })
})
