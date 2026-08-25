import { useRef, useState, type ChangeEvent, type FormEvent, type JSX } from 'react'
import type {
  CreateProjectInput,
  ProjectDetails,
  ProjectType,
  VisualDirection
} from '@studio/contracts'
import { normalizeProjectCode } from '@studio/domain'
import { ChoiceRequirement, RequiredMark, TextRequirement, ValidationAlert } from './FormGuidance'

const MAX_SOURCE_CHARACTERS = 60_000
const TOTAL_STEPS = 5

const looks: Array<{
  id: string
  label: string
  description: string
  direction: VisualDirection
  className: string
}> = [
  {
    id: 'painted-2d',
    label: 'Hand-painted 2D',
    description: 'Warm shapes, textured colour and expressive movement.',
    direction: '2d',
    className: 'painted'
  },
  {
    id: 'graphic-2d',
    label: 'Graphic 2D',
    description: 'Bold silhouettes, clean colour blocks and crisp staging.',
    direction: '2d',
    className: 'graphic'
  },
  {
    id: 'cinematic-3d',
    label: 'Cinematic 3D',
    description: 'Dimensional lighting, soft materials and film-like framing.',
    direction: '3d-look',
    className: 'cinematic'
  },
  {
    id: 'mixed-collage',
    label: 'Mixed-media collage',
    description: 'Layered 2D artwork with depth, texture and gentle parallax.',
    direction: 'mixed',
    className: 'mixed'
  }
]

function suggestedTitle(source: string, type: ProjectType): string {
  const firstLine = source
    .split(/[.!?\n]/)[0]
    ?.replace(/[^\p{L}\p{N}' -]/gu, '')
    .trim()
  if (firstLine && firstLine.length >= 2) return firstLine.slice(0, 80)
  return type === 'series' ? 'Untitled Animated Series' : 'Untitled Animated Film'
}

export function QuickStartWizard({
  onClose,
  onCreated,
  onDetailedSetup
}: {
  onClose(): void
  onCreated(project: ProjectDetails): void
  onDetailedSetup(): void
}): JSX.Element {
  const [step, setStep] = useState(1)
  const [sourceKind, setSourceKind] = useState<'idea' | 'script'>('idea')
  const [type, setType] = useState<ProjectType>()
  const [title, setTitle] = useState('')
  const [source, setSource] = useState('')
  const [language, setLanguage] = useState('English')
  const [lookId, setLookId] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string>()
  const [validationMessages, setValidationMessages] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const readScript = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > MAX_SOURCE_CHARACTERS) {
      setMessage('Use a text script smaller than 60 KB. Longer scripts can be split by episode.')
      return
    }
    try {
      setSource(await file.text())
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, '').slice(0, 120))
      setMessage(`Loaded ${file.name}. Review the text before continuing.`)
    } catch {
      setMessage('That script could not be read. Paste its text instead.')
    }
  }

  const issuesForStep = (): string[] => {
    if (step === 1 && !type) return ['Choose whether you are making a series or a film.']
    if (step === 3 && language.trim().length < 2) {
      return ['Enter a primary language containing at least 2 characters.']
    }
    if (step === 4) {
      const cleanSource = source.trim()
      if (cleanSource.length < 20) {
        return [
          sourceKind === 'idea'
            ? 'Describe the story in at least one or two sentences.'
            : 'Paste or upload enough of the script for the studio to understand it.'
        ]
      }
      if (cleanSource.length > MAX_SOURCE_CHARACTERS) {
        return ['Shorten the starting material to 60,000 characters or split it by episode.']
      }
    }
    if (step === 5 && !lookId) return ['Choose one starting visual look. You can refine it later.']
    return []
  }

  const continueToNextStep = (): void => {
    const issues = issuesForStep()
    if (issues.length > 0) {
      setValidationMessages(issues)
      return
    }
    setValidationMessages([])
    setMessage(undefined)
    setStep((current) => Math.min(TOTAL_STEPS, current + 1))
  }

  const create = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const issues = issuesForStep()
    if (issues.length > 0 || !type) {
      setValidationMessages(issues.length > 0 ? issues : ['Choose the production format.'])
      return
    }
    const selectedLook = looks.find((look) => look.id === lookId)
    if (!selectedLook) {
      setValidationMessages(['Choose one starting visual look. You can refine it later.'])
      return
    }
    setValidationMessages([])
    const cleanSource = source.trim()
    const finalTitle = title.trim() || suggestedTitle(cleanSource, type)
    const input: CreateProjectInput = {
      type,
      title: finalTitle,
      code: normalizeProjectCode(finalTitle),
      language: language.trim(),
      targetDurationMinutes: type === 'series' ? 25 : 12,
      visualDirection: selectedLook.direction,
      sourceMode: sourceKind === 'idea' ? 'original' : 'source-document',
      pilotBrief: cleanSource,
      creativeDirection: {
        targetAudience: 'To be recommended by the AI production planner.',
        ageBand: 'undecided',
        primaryNiche: 'To be inferred from the creator source.',
        genres: ['To be inferred'],
        toneKeywords: ['To be inferred'],
        coreThemes: [],
        storyPromise: 'The AI production planner will propose a viewer promise for review.',
        culturalSetting: 'To be inferred and flagged for creator review.',
        contentBoundaries: [
          'Avoid gratuitous violence and sexual content unless the creator explicitly changes this boundary.'
        ],
        episodeFormat:
          type === 'series'
            ? 'A recurring animated episode; the AI should recommend the final structure.'
            : 'A self-contained animated film.',
        youtubePositioning: 'To be recommended after the story and audience are understood.',
        visualStyleNotes: `${selectedLook.label}: ${selectedLook.description}`,
        comparableTitles: [],
        differentiation: 'To be developed from the creator premise without copying protected work.'
      }
    }
    setBusy(true)
    setMessage('Creating a safe local production…')
    try {
      onCreated(await window.studio.projects.create(input))
    } catch {
      setMessage('The production could not be created safely. Nothing was sent or charged.')
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form
        className="quick-start quick-start-stepped"
        noValidate
        onSubmit={(event) => void create(event)}
      >
        <header>
          <div>
            <p className="eyebrow">
              New production · Step {step} of {TOTAL_STEPS}
            </p>
            <h1>
              {step === 1 && 'What do you want to make?'}
              {step === 2 && "What's it called?"}
              {step === 3 && 'What language?'}
              {step === 4 && 'Tell me the story'}
              {step === 5 && 'Choose a look'}
            </h1>
            <p>One decision at a time. Nothing is sent, charged or generated during setup.</p>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div
          className="quick-progress"
          role="progressbar"
          aria-label="Project setup progress"
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
          aria-valuenow={step}
        >
          <span style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>

        <section className="quick-step" aria-live="polite">
          {step === 1 && (
            <>
              <p className="quick-question-label">
                Production format <RequiredMark />
              </p>
              <div className="quick-choice-grid" role="group" aria-label="Production format">
                {(
                  [
                    [
                      'series',
                      'Animated series',
                      'Build a reusable world for episodes and seasons.'
                    ],
                    [
                      'film',
                      'One-off film',
                      'Tell one complete story in a self-contained production.'
                    ]
                  ] as const
                ).map(([value, label, description]) => (
                  <button
                    key={value}
                    type="button"
                    className={type === value ? 'quick-choice selected' : 'quick-choice'}
                    aria-pressed={type === value}
                    onClick={() => setType(value)}
                  >
                    <span className={`format-preview ${value}`} aria-hidden="true" />
                    <strong>{label}</strong>
                    <span>{description}</span>
                  </button>
                ))}
              </div>
              <ChoiceRequirement id="format-requirement" valid={Boolean(type)}>
                Required · choose one format.
              </ChoiceRequirement>
            </>
          )}

          {step === 2 && (
            <label className="quick-single-field">
              <span>
                Production title <small>(optional)</small>
              </span>
              <input
                autoFocus
                value={title}
                maxLength={120}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Leave blank and the studio will suggest one"
              />
              <small>{title.trim().length} / 120 characters · you can skip this step.</small>
            </label>
          )}

          {step === 3 && (
            <label className="quick-single-field">
              <span>
                Primary language <RequiredMark />
              </span>
              <input
                autoFocus
                aria-describedby="quick-language-requirement"
                value={language}
                maxLength={40}
                onChange={(event) => setLanguage(event.target.value)}
              />
              <TextRequirement
                id="quick-language-requirement"
                value={language}
                minimum={2}
                maximum={40}
              />
            </label>
          )}

          {step === 4 && (
            <>
              <div className="quick-source-tabs" role="group" aria-label="Starting material">
                <button
                  type="button"
                  className={sourceKind === 'idea' ? 'selected' : ''}
                  aria-pressed={sourceKind === 'idea'}
                  onClick={() => setSourceKind('idea')}
                >
                  <strong>I have a story idea</strong>
                  <span>A few sentences are enough.</span>
                </button>
                <button
                  type="button"
                  className={sourceKind === 'script' ? 'selected' : ''}
                  aria-pressed={sourceKind === 'script'}
                  onClick={() => setSourceKind('script')}
                >
                  <strong>I have a script</strong>
                  <span>Paste it or upload a text file.</span>
                </button>
              </div>
              <label className="quick-story-field">
                <span>
                  {sourceKind === 'idea' ? 'Describe your story' : 'Paste your script'}{' '}
                  <RequiredMark />
                </span>
                <textarea
                  autoFocus
                  value={source}
                  maxLength={MAX_SOURCE_CHARACTERS}
                  aria-describedby="quick-source-requirement"
                  onChange={(event) => setSource(event.target.value)}
                  placeholder={
                    sourceKind === 'idea'
                      ? 'Example: An old swordsman must decide whether to pass on a dangerous tradition or end it forever…'
                      : 'Paste the screenplay, treatment, or episode draft here…'
                  }
                />
                <TextRequirement
                  id="quick-source-requirement"
                  value={source}
                  minimum={20}
                  maximum={MAX_SOURCE_CHARACTERS}
                />
              </label>
              {sourceKind === 'script' && (
                <div className="quick-upload">
                  <input
                    ref={fileRef}
                    hidden
                    type="file"
                    accept=".txt,.md,.markdown,.fountain,.fdx,text/plain,text/markdown"
                    onChange={(event) => void readScript(event)}
                  />
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => fileRef.current?.click()}
                  >
                    Upload a script file
                  </button>
                  <span>TXT, Markdown, Fountain, or text-based FDX · up to 60 KB</span>
                </div>
              )}
            </>
          )}

          {step === 5 && (
            <>
              <p className="quick-question-label">
                Starting visual look <RequiredMark />
              </p>
              <div className="look-preset-grid" role="group" aria-label="Starting visual look">
                {looks.map((look) => (
                  <button
                    key={look.id}
                    type="button"
                    className={lookId === look.id ? 'look-preset selected' : 'look-preset'}
                    aria-pressed={lookId === look.id}
                    onClick={() => setLookId(look.id)}
                  >
                    <span className={`look-preview ${look.className}`} aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    <strong>{look.label}</strong>
                    <span>{look.description}</span>
                  </button>
                ))}
              </div>
              <ChoiceRequirement id="look-requirement" valid={Boolean(lookId)}>
                Required · choose one look. You can refine it before generation.
              </ChoiceRequirement>
            </>
          )}
        </section>

        {message && (
          <div className="safety-feedback" role="status">
            {message}
          </div>
        )}

        <footer>
          <button className="text-button" type="button" disabled={busy} onClick={onDetailedSetup}>
            Use detailed setup instead
          </button>
          <div className="quick-step-actions">
            <span>
              Step {step} of {TOTAL_STEPS} · no GPU cost
            </span>
            {step > 1 && (
              <button
                className="button button-secondary"
                type="button"
                disabled={busy}
                onClick={() => setStep((current) => Math.max(1, current - 1))}
              >
                Back
              </button>
            )}
            {step < TOTAL_STEPS ? (
              <button
                key="continue-step"
                className="button button-primary button-large"
                type="button"
                disabled={busy}
                onClick={continueToNextStep}
              >
                Continue
              </button>
            ) : (
              <button
                key="create-project"
                className="button button-primary button-large"
                type="submit"
                disabled={busy}
              >
                {busy ? 'Creating production…' : 'Create'}
              </button>
            )}
          </div>
        </footer>
        <ValidationAlert
          title="This step needs a little more information"
          messages={validationMessages}
          onClose={() => setValidationMessages([])}
        />
      </form>
    </div>
  )
}
