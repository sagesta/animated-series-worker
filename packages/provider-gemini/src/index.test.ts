import { describe, expect, it, vi } from 'vitest'
import { GeminiClient } from './index'

const draft = {
  title: 'The Glass Orchard',
  summary: 'A character-development proposal.',
  sections: [{ heading: 'Want', body: 'Ife wants to hear the trees sing again.' }],
  continuityQuestions: ['Who silenced the orchard?'],
  suggestedNextSteps: ['Define the price of restoring one tree.']
}

describe('GeminiClient', () => {
  it('uses the no-cost model list with the protected Google API key header', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          models: [
            {
              name: 'models/gemini-3.7-flash',
              displayName: 'Gemini 3.7 Flash',
              supportedGenerationMethods: ['generateContent']
            },
            {
              name: 'models/embedding-001',
              displayName: 'Embedding',
              supportedGenerationMethods: ['embedContent']
            }
          ]
        }),
        { status: 200 }
      )
    )
    const client = new GeminiClient({ fetchImpl: request })

    await expect(client.listModels('AIza-test-protected-key-123456789')).resolves.toEqual([
      { id: 'gemini-3.7-flash', displayName: 'Gemini 3.7 Flash' }
    ])
    expect(request).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ 'x-goog-api-key': 'AIza-test-protected-key-123456789' })
      })
    )
  })

  it('requests structured JSON and maps Gemini usage', async () => {
    let body: Record<string, unknown> = {}
    const request = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>
      return new Response(
        JSON.stringify({
          responseId: 'gemini-response-123',
          candidates: [
            { finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(draft) }] } }
          ],
          usageMetadata: {
            promptTokenCount: 70,
            candidatesTokenCount: 55,
            totalTokenCount: 125,
            cachedContentTokenCount: 8
          }
        }),
        { status: 200 }
      )
    })
    const client = new GeminiClient({ fetchImpl: request })
    const result = await client.generateDraft('AIza-test-protected-key-123456789', {
      model: 'gemini-3.7-flash',
      systemInstruction: 'Return a useful proposal.',
      userPrompt: 'Develop a character from the selected project context.',
      maxOutputTokens: 800
    })

    expect(body).toMatchObject({
      generationConfig: {
        maxOutputTokens: 800,
        responseMimeType: 'application/json',
        responseJsonSchema: { type: 'object' }
      }
    })
    expect(result.output.title).toBe('The Glass Orchard')
    expect(result.usage).toEqual({
      inputTokens: 70,
      outputTokens: 55,
      totalTokens: 125,
      cachedInputTokens: 8
    })
    expect(result.requestId).toBe('gemini-response-123')
  })

  it('rejects a partial response instead of saving unfinished writing', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          responseId: 'gemini-partial-123',
          candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{' }] } }]
        }),
        { status: 200 }
      )
    )
    const client = new GeminiClient({ fetchImpl: request })

    await expect(
      client.generateDraft('AIza-test-protected-key-123456789', {
        model: 'gemini-3.7-flash',
        systemInstruction: 'Return a useful proposal.',
        userPrompt: 'Write a detailed proposal for this animated project.',
        maxOutputTokens: 256
      })
    ).rejects.toMatchObject({ code: 'invalid-response' })
  })
})
