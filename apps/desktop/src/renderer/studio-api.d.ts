import type { StudioApi } from '@studio/contracts'

declare global {
  interface Window {
    studio: StudioApi
  }
}

export {}
