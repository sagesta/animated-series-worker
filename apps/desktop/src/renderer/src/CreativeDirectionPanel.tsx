import { useState, type FormEvent, type JSX } from 'react'
import type { ProjectDetails } from '@studio/contracts'
import { AudienceDirectionFields } from './CreativeDirectionForm'
import { ValidationAlert } from './FormGuidance'
import { IdeaAssistant, type IdeaAssistantTarget } from './IdeaAssistant'
import {
  creativeDirectionDraftIssues,
  creativeDirectionInputFromDraft,
  draftFromCreativeDirection
} from './creativeDirectionModel'

const ageBandLabels = {
  'all-ages': 'All ages / family viewing',
  children: 'Children',
  teens: 'Teenagers',
  'young-adults': 'Young adults',
  adults: 'Adults',
  mixed: 'Mixed audience',
  undecided: 'Age band not decided'
} as const

export function CreativeDirectionPanel({
  project,
  onUpdated
}: {
  project: ProjectDetails
  onUpdated(project: ProjectDetails): void
}): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() =>
    draftFromCreativeDirection(project.creativeDirection, project.manifest.type)
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string>()
  const [validationMessages, setValidationMessages] = useState<string[]>([])
  const profile = project.creativeDirection

  const ideaTargets: IdeaAssistantTarget[] = [
    {
      id: 'target-audience',
      label: 'Who this production is for',
      taskKind: 'design_creative_direction',
      instruction:
        'Describe a specific audience using interests, emotional needs, viewing situation, and suitable creative complexity. Do not decide made-for-kids status.',
      currentValue: draft.targetAudience,
      onUse: (value) => setDraft((current) => ({ ...current, targetAudience: value }))
    },
    {
      id: 'age-band',
      label: 'Creative age-band considerations',
      taskKind: 'design_creative_direction',
      instruction:
        'Explain which creative age bands may fit and the tradeoffs in language, themes, pacing, and intensity. This is guidance only; do not decide YouTube made-for-kids status.',
      currentValue: draft.ageBand,
      humanOnly: true
    },
    {
      id: 'niche',
      label: 'Primary niche',
      taskKind: 'design_creative_direction',
      instruction:
        'Suggest a clear, discoverable but not artificially keyword-stuffed primary niche.',
      currentValue: draft.primaryNiche,
      onUse: (value) => setDraft((current) => ({ ...current, primaryNiche: value }))
    },
    {
      id: 'genres',
      label: 'Genres and subgenres',
      taskKind: 'design_creative_direction',
      instruction:
        'Return a concise comma-separated list of no more than eight compatible genres and subgenres.',
      currentValue: draft.genres,
      onUse: (value) => setDraft((current) => ({ ...current, genres: value }))
    },
    {
      id: 'setting',
      label: 'Cultural or story setting',
      taskKind: 'design_creative_direction',
      instruction:
        'Propose a respectful, repeatable setting with useful story and visual anchors. Flag research needs instead of inventing cultural facts.',
      currentValue: draft.culturalSetting,
      onUse: (value) => setDraft((current) => ({ ...current, culturalSetting: value }))
    },
    {
      id: 'promise',
      label: 'Viewer promise',
      taskKind: 'design_creative_direction',
      instruction:
        'Write one paste-ready promise explaining what viewers should reliably feel or receive from each episode or the film.',
      currentValue: draft.storyPromise,
      onUse: (value) => setDraft((current) => ({ ...current, storyPromise: value }))
    },
    {
      id: 'tone',
      label: 'Tone',
      taskKind: 'design_creative_direction',
      instruction:
        'Return a concise comma-separated list of compatible tone words and note any tension that should be intentionally balanced.',
      currentValue: draft.toneKeywords,
      onUse: (value) => setDraft((current) => ({ ...current, toneKeywords: value }))
    },
    {
      id: 'themes',
      label: 'Core themes',
      taskKind: 'design_creative_direction',
      instruction:
        'Return a concise comma-separated list of themes that can recur without becoming repetitive.',
      currentValue: draft.coreThemes,
      onUse: (value) => setDraft((current) => ({ ...current, coreThemes: value }))
    },
    {
      id: 'boundaries',
      label: 'Content boundaries',
      taskKind: 'design_creative_direction',
      instruction:
        'Suggest clear creative boundaries suited to the stated audience and tone. These are project rules, not legal or platform declarations.',
      currentValue: draft.contentBoundaries,
      onUse: (value) => setDraft((current) => ({ ...current, contentBoundaries: value }))
    },
    {
      id: 'format',
      label: 'Episode or film format',
      taskKind: 'design_creative_direction',
      instruction:
        'Describe the repeatable structure, approximate length, pacing, and closure pattern in one paste-ready paragraph.',
      currentValue: draft.episodeFormat,
      onUse: (value) => setDraft((current) => ({ ...current, episodeFormat: value }))
    },
    {
      id: 'visual-style',
      label: 'Visual style notes',
      taskKind: 'design_visual_generation',
      instruction:
        'Describe an original, reproducible visual language using shape, line, materials, palette, lighting, texture, depth, and animation economy. Do not imitate a living artist.',
      currentValue: draft.visualStyleNotes,
      onUse: (value) => setDraft((current) => ({ ...current, visualStyleNotes: value }))
    },
    {
      id: 'youtube-positioning',
      label: 'Honest YouTube positioning',
      taskKind: 'plan_youtube_release',
      instruction:
        'Describe how to introduce this production truthfully to its intended viewers without promising ranking or views.',
      currentValue: draft.youtubePositioning,
      onUse: (value) => setDraft((current) => ({ ...current, youtubePositioning: value }))
    },
    {
      id: 'comparables',
      label: 'Comparable productions',
      taskKind: 'design_creative_direction',
      instruction:
        'Suggest a short comma-separated set of directional comparables and explain the non-copying dimension of each comparison.',
      currentValue: draft.comparableTitles,
      onUse: (value) => setDraft((current) => ({ ...current, comparableTitles: value }))
    },
    {
      id: 'difference',
      label: 'Distinctive angle',
      taskKind: 'design_creative_direction',
      instruction:
        'Write a concise statement of the combination, perspective, format, or emotional angle that makes this project recognizably its own.',
      currentValue: draft.differentiation,
      onUse: (value) => setDraft((current) => ({ ...current, differentiation: value }))
    }
  ]

  const beginEditing = (): void => {
    setDraft(draftFromCreativeDirection(profile, project.manifest.type))
    setMessage(undefined)
    setValidationMessages([])
    setEditing(true)
  }

  const save = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const issues = creativeDirectionDraftIssues(draft)
    if (issues.length > 0) {
      setValidationMessages(issues)
      return
    }
    setValidationMessages([])
    setSaving(true)
    setMessage(undefined)
    try {
      const updated = await window.studio.projects.saveCreativeDirection({
        projectId: project.manifest.id,
        expectedProfileId: profile?.profileId ?? null,
        direction: creativeDirectionInputFromDraft(draft)
      })
      onUpdated(updated)
      setEditing(false)
      setMessage(
        `Creative direction version ${updated.creativeDirection?.revision ?? 1} was saved locally.`
      )
    } catch {
      setMessage('The new direction could not be saved safely. The earlier version is unchanged.')
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <form
        className="creative-direction-card direction-editor"
        noValidate
        onSubmit={(event) => void save(event)}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">Audience & creative direction</p>
            <h2>{profile ? 'Create a revised direction' : 'Give this project its compass'}</h2>
            <p>
              Saving creates a new local version. It does not change earlier proposals, approved
              work, or any YouTube policy answer.
            </p>
          </div>
          <span className="status-chip local">No paid action</span>
        </div>
        <div className="direction-ai-row">
          <div>
            <strong>Not sure what to enter?</strong>
            <span>
              Choose any direction field and let your connected LLM suggest a starting point.
            </span>
          </div>
          <IdeaAssistant
            project={project}
            targets={ideaTargets}
            buttonLabel="Generate direction ideas"
          />
        </div>
        <AudienceDirectionFields draft={draft} onChange={setDraft} idPrefix="direction-panel" />
        {message && <div className="safety-feedback error">{message}</div>}
        <div className="direction-editor-actions">
          <button
            className="button button-quiet"
            type="button"
            disabled={saving}
            onClick={() => {
              setValidationMessages([])
              setEditing(false)
            }}
          >
            Cancel
          </button>
          <button className="button button-primary" disabled={saving}>
            {saving ? 'Saving safely…' : profile ? 'Save as new version' : 'Save direction'}
          </button>
        </div>
        <ValidationAlert
          title="The creative direction is not ready to save"
          messages={validationMessages}
          onClose={() => setValidationMessages([])}
        />
      </form>
    )
  }

  return (
    <section className="creative-direction-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Audience & creative direction</p>
          <h2>{profile ? profile.direction.primaryNiche : 'Direction has not been set yet'}</h2>
          <p>
            {profile
              ? profile.direction.storyPromise
              : 'Add the intended audience, niche, genre, tone, promise, and boundaries before expanding the production.'}
          </p>
        </div>
        <button className="button button-secondary" onClick={beginEditing}>
          {profile ? 'Revise direction' : 'Add direction'}
        </button>
      </div>

      {profile && (
        <>
          <div className="direction-summary-grid">
            <div>
              <span>Audience</span>
              <strong>{profile.direction.targetAudience}</strong>
              <small>{ageBandLabels[profile.direction.ageBand]}</small>
            </div>
            <div>
              <span>Genre</span>
              <strong>{profile.direction.genres.join(' · ')}</strong>
              <small>{profile.direction.toneKeywords.join(' · ')}</small>
            </div>
            <div>
              <span>Format</span>
              <strong>{profile.direction.episodeFormat}</strong>
              <small>Direction version {profile.revision}</small>
            </div>
          </div>
          <div className="direction-details">
            {profile.direction.coreThemes.length > 0 && (
              <p>
                <strong>Themes:</strong> {profile.direction.coreThemes.join(', ')}
              </p>
            )}
            {profile.direction.culturalSetting && (
              <p>
                <strong>Setting:</strong> {profile.direction.culturalSetting}
              </p>
            )}
            {profile.direction.contentBoundaries.length > 0 && (
              <p>
                <strong>Boundaries:</strong> {profile.direction.contentBoundaries.join(', ')}
              </p>
            )}
            {profile.direction.differentiation && (
              <p>
                <strong>Distinctive angle:</strong> {profile.direction.differentiation}
              </p>
            )}
          </div>
        </>
      )}
      {message && <div className="safety-feedback">{message}</div>}
      <div className="direction-policy-note">
        <span>i</span>
        <p>
          Creative audience guidance helps writing and future production prompts. Release-time
          child-directed and disclosure decisions always remain separate human questions.
        </p>
      </div>
    </section>
  )
}
