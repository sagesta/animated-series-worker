import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react'
import {
  type CreateProjectInput,
  type ProjectDetails,
  type ProjectType,
  type SourceMode,
  type VisualDirection
} from '@studio/contracts'
import { normalizeProjectCode } from '@studio/domain'

interface ProjectWizardProps {
  onClose(): void
  onCreated(project: ProjectDetails): void
}

const sourceChoices: Array<{
  value: SourceMode
  title: string
  description: string
  note?: string
}> = [
  {
    value: 'original',
    title: 'Start from an idea',
    description: 'Begin with a clean story and build every creative decision here.'
  },
  {
    value: 'source-document',
    title: 'Use a story document',
    description: 'Record that a script, treatment, or book will become the source.',
    note: 'Document import arrives in a later build.'
  },
  {
    value: 'upstream-import',
    title: 'Use the connected planning skills',
    description: 'Prepare this production for the pinned story-planning toolkit.',
    note: 'The connection is planned but is not active yet.'
  },
  {
    value: 'existing-studio',
    title: 'Continue an existing production',
    description: 'Reserve a project for material created in another studio.',
    note: 'Guided import arrives in a later build.'
  }
]

const visualChoices: Array<{ value: VisualDirection; label: string }> = [
  { value: '2d', label: '2D animation' },
  { value: '3d-look', label: '3D-style animation' },
  { value: 'mixed', label: 'Mixed 2D and 3D' },
  { value: 'undecided', label: 'Decide later' }
]

function cleanError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'The project could not be created. Please try again.'
  }

  return error.message
    .replace(/^Error invoking remote method '[^']+': Error: /, '')
    .replace(/^Error: /, '')
}

export function ProjectWizard({ onClose, onCreated }: ProjectWizardProps): JSX.Element {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [step, setStep] = useState(1)
  const [type, setType] = useState<ProjectType>('series')
  const [title, setTitle] = useState('')
  const [code, setCode] = useState('')
  const [codeTouched, setCodeTouched] = useState(false)
  const [language, setLanguage] = useState('English')
  const [targetDurationMinutes, setTargetDurationMinutes] = useState(25)
  const [visualDirection, setVisualDirection] = useState<VisualDirection>('2d')
  const [sourceMode, setSourceMode] = useState<SourceMode>('original')
  const [pilotBrief, setPilotBrief] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    headingRef.current?.focus()
  }, [step])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !busy) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [busy, onClose])

  const chooseType = (nextType: ProjectType): void => {
    setType(nextType)
    setTargetDurationMinutes(nextType === 'series' ? 25 : 12)
  }

  const handleTitle = (nextTitle: string): void => {
    setTitle(nextTitle)
    if (!codeTouched) {
      setCode(normalizeProjectCode(nextTitle))
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setError(undefined)

    if (step < 4) {
      setStep((current) => current + 1)
      return
    }

    const input: CreateProjectInput = {
      type,
      title,
      code: code || undefined,
      language,
      targetDurationMinutes,
      visualDirection,
      sourceMode,
      pilotBrief
    }

    setBusy(true)
    try {
      const project = await window.studio.projects.create(input)
      onCreated(project)
    } catch (creationError) {
      setError(cleanError(creationError))
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="wizard" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
        <aside className="wizard-rail" aria-label="Setup progress">
          <p className="eyebrow eyebrow-light">New production</p>
          <h2>Give every story its own safe home.</h2>
          <ol className="step-list">
            {['Format', 'Identity', 'Starting point', 'Review'].map((label, index) => {
              const stepNumber = index + 1
              return (
                <li
                  className={stepNumber === step ? 'active' : stepNumber < step ? 'done' : ''}
                  key={label}
                >
                  <span>{stepNumber < step ? '✓' : stepNumber}</span>
                  {label}
                </li>
              )
            })}
          </ol>
          <div className="wizard-safety-note">
            <span className="safety-dot" />
            Nothing here starts a GPU or creates a bill.
          </div>
        </aside>

        <form className="wizard-content" onSubmit={handleSubmit}>
          <button
            className="icon-button wizard-close"
            type="button"
            aria-label="Close project setup"
            onClick={onClose}
            disabled={busy}
          >
            ×
          </button>

          <header className="wizard-header">
            <p className="eyebrow">Step {step} of 4</p>
            <h1 id="wizard-title" ref={headingRef} tabIndex={-1}>
              {step === 1 && 'What are you making?'}
              {step === 2 && 'Name this production'}
              {step === 3 && 'Where will the story begin?'}
              {step === 4 && 'Create the production home'}
            </h1>
            <p>
              {step === 1 &&
                'Series and one-off films stay separate, but use the same guided production tools.'}
              {step === 2 &&
                'These details organise the project. You can refine the creative choices later.'}
              {step === 3 &&
                'This only records your intended starting point. No import runs during setup.'}
              {step === 4 &&
                'Review the essentials. The studio will create local folders and a safe checkpoint.'}
            </p>
          </header>

          <div className="wizard-body">
            {step === 1 && (
              <div className="choice-grid two-column">
                <button
                  type="button"
                  className={`choice-card ${type === 'series' ? 'selected' : ''}`}
                  aria-pressed={type === 'series'}
                  onClick={() => chooseType('series')}
                >
                  <span className="choice-art series-art">S</span>
                  <strong>Animated series</strong>
                  <span>Plan seasons and episodes while protecting recurring characters.</span>
                  <small>Typical episode: 20–35 minutes</small>
                </button>
                <button
                  type="button"
                  className={`choice-card ${type === 'film' ? 'selected' : ''}`}
                  aria-pressed={type === 'film'}
                  onClick={() => chooseType('film')}
                >
                  <span className="choice-art film-art">F</span>
                  <strong>One-off film</strong>
                  <span>Create a self-contained short film, special, or standalone story.</span>
                  <small>No connection to a series is required</small>
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="form-grid">
                <label className="field field-wide">
                  <span>Production title</span>
                  <input
                    autoFocus
                    required
                    minLength={2}
                    maxLength={120}
                    value={title}
                    onChange={(event) => handleTitle(event.target.value)}
                    placeholder={
                      type === 'series' ? 'e.g. The Lantern Keepers' : 'e.g. The Last Kite'
                    }
                  />
                </label>
                <label className="field">
                  <span>Short code</span>
                  <input
                    value={code}
                    maxLength={24}
                    onChange={(event) => {
                      setCodeTouched(true)
                      setCode(normalizeProjectCode(event.target.value))
                    }}
                    placeholder="Created from the title"
                  />
                  <small>Used only to keep folders easy to recognise.</small>
                </label>
                <label className="field">
                  <span>Primary language</span>
                  <input
                    required
                    minLength={2}
                    maxLength={40}
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>{type === 'series' ? 'Target episode length' : 'Target film length'}</span>
                  <div className="number-input">
                    <input
                      required
                      type="number"
                      min={1}
                      max={240}
                      value={targetDurationMinutes}
                      onChange={(event) => setTargetDurationMinutes(Number(event.target.value))}
                    />
                    <span>minutes</span>
                  </div>
                </label>
                <label className="field">
                  <span>Visual direction</span>
                  <select
                    value={visualDirection}
                    onChange={(event) => setVisualDirection(event.target.value as VisualDirection)}
                  >
                    {visualChoices.map((choice) => (
                      <option value={choice.value} key={choice.value}>
                        {choice.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {step === 3 && (
              <div className="source-list">
                {sourceChoices.map((choice) => (
                  <button
                    type="button"
                    className={`source-choice ${sourceMode === choice.value ? 'selected' : ''}`}
                    aria-pressed={sourceMode === choice.value}
                    onClick={() => setSourceMode(choice.value)}
                    key={choice.value}
                  >
                    <span className="radio-mark" />
                    <span>
                      <strong>{choice.title}</strong>
                      <span>{choice.description}</span>
                      {choice.note && <small>{choice.note}</small>}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {step === 4 && (
              <div className="review-layout">
                <div className="review-card">
                  <div>
                    <span>Format</span>
                    <strong>{type === 'series' ? 'Animated series' : 'One-off film'}</strong>
                  </div>
                  <div>
                    <span>Title</span>
                    <strong>{title}</strong>
                  </div>
                  <div>
                    <span>Length</span>
                    <strong>{targetDurationMinutes} minutes</strong>
                  </div>
                  <div>
                    <span>Visual direction</span>
                    <strong>
                      {visualChoices.find((choice) => choice.value === visualDirection)?.label}
                    </strong>
                  </div>
                </div>
                <label className="field field-wide">
                  <span>
                    First story idea or pilot note <em>Optional</em>
                  </span>
                  <textarea
                    rows={5}
                    maxLength={4000}
                    value={pilotBrief}
                    onChange={(event) => setPilotBrief(event.target.value)}
                    placeholder="A short note about the story you want to tell..."
                  />
                </label>
                <div className="safe-creation-note">
                  <span>✓</span>
                  <div>
                    <strong>A safe local checkpoint is created first</strong>
                    <p>Cloud GPUs, image generation, and paid actions remain switched off.</p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="inline-error" role="alert">
                {error}
              </div>
            )}
          </div>

          <footer className="wizard-footer">
            <button
              type="button"
              className="button button-quiet"
              onClick={() => (step === 1 ? onClose() : setStep((current) => current - 1))}
              disabled={busy}
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </button>
            <button className="button button-primary" type="submit" disabled={busy}>
              {busy ? 'Creating safely…' : step === 4 ? 'Create production' : 'Continue'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
