import type {
  AudienceAgeBand,
  CreativeDirectionInput,
  CreativeDirectionProfile,
  ProjectType
} from '@studio/contracts'

export interface CreativeDirectionDraft {
  targetAudience: string
  ageBand: AudienceAgeBand
  primaryNiche: string
  genres: string
  toneKeywords: string
  coreThemes: string
  storyPromise: string
  culturalSetting: string
  contentBoundaries: string
  episodeFormat: string
  youtubePositioning: string
  visualStyleNotes: string
  comparableTitles: string
  differentiation: string
}

export function createCreativeDirectionDraft(type: ProjectType): CreativeDirectionDraft {
  return {
    targetAudience: '',
    ageBand: 'undecided',
    primaryNiche: '',
    genres: '',
    toneKeywords: '',
    coreThemes: '',
    storyPromise: '',
    culturalSetting: '',
    contentBoundaries: '',
    episodeFormat:
      type === 'series'
        ? 'A recurring 20–35 minute animated episode.'
        : 'A self-contained animated film.',
    youtubePositioning: '',
    visualStyleNotes: '',
    comparableTitles: '',
    differentiation: ''
  }
}

export function draftFromCreativeDirection(
  profile: CreativeDirectionProfile | null,
  type: ProjectType
): CreativeDirectionDraft {
  if (!profile) return createCreativeDirectionDraft(type)
  const direction = profile.direction
  return {
    ...direction,
    genres: direction.genres.join(', '),
    toneKeywords: direction.toneKeywords.join(', '),
    coreThemes: direction.coreThemes.join(', '),
    contentBoundaries: direction.contentBoundaries.join(', '),
    comparableTitles: direction.comparableTitles.join(', ')
  }
}

function parseList(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ]
}

export function creativeDirectionInputFromDraft(
  draft: CreativeDirectionDraft
): CreativeDirectionInput {
  return {
    targetAudience: draft.targetAudience,
    ageBand: draft.ageBand,
    primaryNiche: draft.primaryNiche,
    genres: parseList(draft.genres),
    toneKeywords: parseList(draft.toneKeywords),
    coreThemes: parseList(draft.coreThemes),
    storyPromise: draft.storyPromise,
    culturalSetting: draft.culturalSetting,
    contentBoundaries: parseList(draft.contentBoundaries),
    episodeFormat: draft.episodeFormat,
    youtubePositioning: draft.youtubePositioning,
    visualStyleNotes: draft.visualStyleNotes,
    comparableTitles: parseList(draft.comparableTitles),
    differentiation: draft.differentiation
  }
}
