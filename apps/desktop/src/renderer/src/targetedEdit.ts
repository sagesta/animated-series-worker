import type { MediaAssetView } from '@studio/contracts'

export function targetedEditInputError(selectedMedia: MediaAssetView[]): string | null {
  if (
    selectedMedia.length !== 2 ||
    !selectedMedia[0]?.mimeType.startsWith('image/') ||
    selectedMedia[0]?.kind === 'region-mask' ||
    !selectedMedia[1]?.mimeType.startsWith('image/') ||
    selectedMedia[1]?.kind !== 'region-mask'
  ) {
    return 'Select exactly two approved images in this order: 1) the parent image to correct, 2) its white-on-black region mask. The parent will remain unchanged.'
  }
  return null
}

export function targetedEditParameters(
  instruction: string,
  seed: number
): { instruction: string; seed: number; strength: number } {
  return { instruction, seed, strength: 1 }
}
