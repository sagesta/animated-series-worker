import type { JSX } from 'react'
import type { AudienceAgeBand } from '@studio/contracts'
import type { CreativeDirectionDraft } from './creativeDirectionModel'

const ageBandOptions: Array<{ value: AudienceAgeBand; label: string }> = [
  { value: 'undecided', label: 'Decide later' },
  { value: 'all-ages', label: 'All ages / family viewing' },
  { value: 'children', label: 'Children' },
  { value: 'teens', label: 'Teenagers' },
  { value: 'young-adults', label: 'Young adults' },
  { value: 'adults', label: 'Adults' },
  { value: 'mixed', label: 'A mixed audience' }
]

function FieldHelp({ children }: { children: string }): JSX.Element {
  return <small>{children}</small>
}

export function AudienceDirectionFields({
  draft,
  onChange,
  section = 'all'
}: {
  draft: CreativeDirectionDraft
  onChange(next: CreativeDirectionDraft): void
  section?: 'audience' | 'direction' | 'all'
}): JSX.Element {
  const set = <Key extends keyof CreativeDirectionDraft>(
    key: Key,
    value: CreativeDirectionDraft[Key]
  ): void => onChange({ ...draft, [key]: value })

  return (
    <div className="direction-fields">
      {(section === 'audience' || section === 'all') && (
        <div className="form-grid">
          <label className="field field-wide">
            <span>Who is this production for?</span>
            <textarea
              required
              rows={3}
              minLength={2}
              maxLength={500}
              value={draft.targetAudience}
              onChange={(event) => set('targetAudience', event.target.value)}
              placeholder="Example: Families and viewers aged 9–15 who enjoy adventurous fantasy."
            />
            <FieldHelp>
              Describe the people, interests, and viewing situation—not only an age.
            </FieldHelp>
          </label>
          <label className="field">
            <span>Creative age band</span>
            <select
              value={draft.ageBand}
              onChange={(event) => set('ageBand', event.target.value as AudienceAgeBand)}
            >
              {ageBandOptions.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <FieldHelp>
              This guides the work; it does not answer YouTube’s made-for-kids question.
            </FieldHelp>
          </label>
          <label className="field">
            <span>Primary niche</span>
            <input
              required
              minLength={2}
              maxLength={300}
              value={draft.primaryNiche}
              onChange={(event) => set('primaryNiche', event.target.value)}
              placeholder="African folklore fantasy adventures"
            />
          </label>
          <label className="field">
            <span>Genre and subgenre</span>
            <input
              required
              maxLength={600}
              value={draft.genres}
              onChange={(event) => set('genres', event.target.value)}
              placeholder="Fantasy, mystery, family adventure"
            />
            <FieldHelp>Separate several choices with commas.</FieldHelp>
          </label>
          <label className="field">
            <span>Cultural or story setting</span>
            <input
              maxLength={500}
              value={draft.culturalSetting}
              onChange={(event) => set('culturalSetting', event.target.value)}
              placeholder="A fictional West African coastal kingdom"
            />
          </label>
        </div>
      )}

      {(section === 'direction' || section === 'all') && (
        <div className="form-grid">
          <label className="field field-wide">
            <span>Viewer promise</span>
            <textarea
              required
              rows={3}
              minLength={10}
              maxLength={1_200}
              value={draft.storyPromise}
              onChange={(event) => set('storyPromise', event.target.value)}
              placeholder="What should viewers reliably feel, experience, or receive from every episode?"
            />
          </label>
          <label className="field">
            <span>Tone</span>
            <input
              required
              maxLength={600}
              value={draft.toneKeywords}
              onChange={(event) => set('toneKeywords', event.target.value)}
              placeholder="Warm, adventurous, mysterious, funny"
            />
            <FieldHelp>Separate tone words with commas.</FieldHelp>
          </label>
          <label className="field">
            <span>Core themes</span>
            <input
              maxLength={800}
              value={draft.coreThemes}
              onChange={(event) => set('coreThemes', event.target.value)}
              placeholder="Belonging, courage, memory, community"
            />
          </label>
          <label className="field field-wide">
            <span>Content boundaries</span>
            <textarea
              rows={2}
              maxLength={1_500}
              value={draft.contentBoundaries}
              onChange={(event) => set('contentBoundaries', event.target.value)}
              placeholder="Example: No graphic violence, sexual content, or cruelty presented as comedy."
            />
            <FieldHelp>Separate distinct boundaries with commas or new lines.</FieldHelp>
          </label>
          <label className="field">
            <span>Episode or film format</span>
            <input
              required
              minLength={2}
              maxLength={500}
              value={draft.episodeFormat}
              onChange={(event) => set('episodeFormat', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Visual style notes</span>
            <input
              maxLength={1_000}
              value={draft.visualStyleNotes}
              onChange={(event) => set('visualStyleNotes', event.target.value)}
              placeholder="Graphic 2D shapes, painted light, expressive silhouettes"
            />
          </label>
          <label className="field field-wide">
            <span>YouTube positioning</span>
            <textarea
              rows={2}
              maxLength={1_000}
              value={draft.youtubePositioning}
              onChange={(event) => set('youtubePositioning', event.target.value)}
              placeholder="How should the production be honestly introduced to the intended audience?"
            />
          </label>
          <label className="field">
            <span>Comparable productions</span>
            <input
              maxLength={800}
              value={draft.comparableTitles}
              onChange={(event) => set('comparableTitles', event.target.value)}
              placeholder="Titles used only as directional references"
            />
            <FieldHelp>
              These guide discussion; the studio must not copy their protected expression.
            </FieldHelp>
          </label>
          <label className="field">
            <span>What makes this distinctive?</span>
            <textarea
              rows={2}
              maxLength={1_000}
              value={draft.differentiation}
              onChange={(event) => set('differentiation', event.target.value)}
              placeholder="The combination, perspective, format, or emotional angle that belongs to this project."
            />
          </label>
        </div>
      )}
    </div>
  )
}
