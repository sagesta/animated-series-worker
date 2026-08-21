import { describe, expect, it, vi } from 'vitest'
import { OpenAiClient } from './index'

const draft = {
  title: 'A Promise in the Rain',
  summary: 'A short proposal.',
  sections: [{ heading: 'Opening', body: 'Mara waits beside the empty station.' }],
  continuityQuestions: ['Why is the station closed?'],
  suggestedNextSteps: ['Decide what Mara carries.']
}

describe('OpenAiClient', () => {
  it('uses the free model list without exposing the key', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: 'gpt-5.1' }, { id: 'text-embedding-3-large' }, { id: 'gpt-image-1' }]
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )
    const client = new OpenAiClient({ fetchImpl: request })

    await expect(client.listModels('sk-test-protected-key-123456789')).resolves.toEqual([
      { id: 'gpt-5.1', displayName: 'gpt-5.1' }
    ])
    expect(request).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          authorization: 'Bearer sk-test-protected-key-123456789'
        })
      })
    )
  })

  it('sends a non-stored structured Responses request and maps usage', async () => {
    let body: Record<string, unknown> = {}
    const request = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>
      return new Response(
        JSON.stringify({
          id: 'resp_123',
          output: [{ content: [{ type: 'output_text', text: JSON.stringify(draft) }] }],
          usage: {
            input_tokens: 120,
            output_tokens: 80,
            total_tokens: 200,
            input_tokens_details: { cached_tokens: 20 }
          }
        }),
        { status: 200, headers: { 'x-request-id': 'request_123' } }
      )
    })
    const client = new OpenAiClient({ fetchImpl: request })
    const result = await client.generateDraft('sk-test-protected-key-123456789', {
      model: 'gpt-5.1',
      systemInstruction: 'Return a useful proposal.',
      userPrompt: 'Outline a pilot using the supplied context.',
      maxOutputTokens: 800
    })

    expect(body).toMatchObject({ model: 'gpt-5.1', store: false, max_output_tokens: 800 })
    expect(body.text).toMatchObject({
      format: { type: 'json_schema', name: 'creative_draft', strict: true }
    })
    expect(result.output.title).toBe(draft.title)
    expect(result.usage).toEqual({
      inputTokens: 120,
      outputTokens: 80,
      totalTokens: 200,
      cachedInputTokens: 20
    })
    expect(result.requestId).toBe('request_123')
  })

  it('returns a safe key error without provider response contents', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'secret detail' } }), { status: 401 })
      )
    const client = new OpenAiClient({ fetchImpl: request })

    await expect(client.listModels('sk-invalid-protected-key-123456')).rejects.toMatchObject({
      code: 'invalid-key'
    })
  })
})
