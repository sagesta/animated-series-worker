import { useState, type FormEvent, type JSX } from 'react'
import type { ProjectDetails } from '@studio/contracts'
import { AudienceDirectionFields } from './CreativeDirectionForm'
import {
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
  const profile = project.creativeDirection

  const beginEditing = (): void => {
    setDraft(draftFromCreativeDirection(profile, project.manifest.type))
    setMessage(undefined)
    setEditing(true)
  }

  const save = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
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
        <AudienceDirectionFields draft={draft} onChange={setDraft} />
        {message && <div className="safety-feedback error">{message}</div>}
        <div className="direction-editor-actions">
          <button
            className="button button-quiet"
            type="button"
            disabled={saving}
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
          <button className="button button-primary" disabled={saving}>
            {saving ? 'Saving safely…' : profile ? 'Save as new version' : 'Save direction'}
          </button>
        </div>
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
