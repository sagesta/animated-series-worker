export interface ConvertedPromptNode {
  class_type: string
  inputs: Record<string, unknown>
  _meta?: { title?: string }
}

export interface PromptBinding {
  classType?: string
  title?: string
  occurrence?: number
  input: string
  value: unknown
}

export function convertComfyUiWorkflow(
  workflow: unknown,
  options?: { outputTypes?: string[] }
): Record<string, ConvertedPromptNode>

export function applyPromptBindings(
  prompt: Record<string, ConvertedPromptNode>,
  bindings: PromptBinding[]
): Record<string, ConvertedPromptNode>

export function optimizeComfyPrompt(
  prompt: Record<string, ConvertedPromptNode>,
  outputTypes?: string[]
): Record<string, ConvertedPromptNode>
