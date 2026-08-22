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

export function creativeDirectionDraftIssues(
  draft: CreativeDirectionDraft,
  section: 'audience' | 'direction' | 'all' = 'all'
): string[] {
  const issues: string[] = []
  const validateList = (
    label: string,
    value: string,
    maximumItems: number,
    required: boolean
  ): void => {
    const items = parseList(value)
    if (required && items.length === 0) issues.push(`Add at least one ${label}.`)
    if (items.length > maximumItems) {
      issues.push(`Use no more than ${maximumItems} ${label} entries.`)
    }
    if (items.some((item) => item.length > 160)) {
      issues.push(`Keep each ${label} entry at 160 characters or fewer.`)
    }
  }
  if (section === 'audience' || section === 'all') {
    if (draft.targetAudience.trim().length < 2) {
      issues.push('Describe who the production is for using at least 2 characters.')
    }
    if (draft.primaryNiche.trim().length < 2) {
      issues.push('Enter a primary niche using at least 2 characters.')
    }
    validateList('genre or subgenre', draft.genres, 8, true)
  }
  if (section === 'direction' || section === 'all') {
    if (draft.storyPromise.trim().length < 10) {
      issues.push('Explain the viewer promise using at least 10 characters.')
    }
    validateList('tone word', draft.toneKeywords, 8, true)
    validateList('core theme', draft.coreThemes, 10, false)
    validateList('content boundary', draft.contentBoundaries, 12, false)
    validateList('comparable production', draft.comparableTitles, 8, false)
    if (draft.episodeFormat.trim().length < 2) {
      issues.push('Describe the episode or film format using at least 2 characters.')
    }
  }
  return issues
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
