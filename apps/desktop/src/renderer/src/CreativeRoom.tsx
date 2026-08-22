import { useEffect, useMemo, useState, type FormEvent, type JSX } from 'react'
import {
  WRITING_MODEL_CATALOG,
  type ExternalSkillPlanPreview,
  type ProjectDetails,
  type WritingContextPreview,
  type WritingDraftRecord,
  type WritingProvider,
  type WritingSettingsStatus,
  type WritingTaskKind
} from '@studio/contracts'
import { ChoiceRequirement, RequiredMark, TextRequirement, ValidationAlert } from './FormGuidance'

const taskOptions: Array<{ value: WritingTaskKind; label: string }> = [
  { value: 'develop_character', label: 'Develop a character' },
  { value: 'build_world', label: 'Build the story world' },
  { value: 'outline_episode', label: 'Outline an episode or film' },
  { value: 'draft_scene', label: 'Draft a scene' },
  { value: 'rewrite_dialogue', label: 'Rewrite dialogue' },
  { value: 'check_continuity', label: 'Check continuity' }
]

const providerNames = {
  openai: 'OpenAI (GPT)',
  anthropic: 'Anthropic (Claude)',
  gemini: 'Google Gemini'
} as const

const writingProviders = ['openai', 'anthropic', 'gemini'] as const

function modelLabel(provider: WritingProvider, modelId: string, displayName: string): string {
  const catalogue: ReadonlyArray<{ id: string; purpose: string }> = WRITING_MODEL_CATALOG[provider]
  const purpose = catalogue.find((item) => item.id === modelId)?.purpose
  return purpose ? `${displayName} — ${purpose}` : displayName
}

function DraftView({ draft }: { draft: WritingDraftRecord }): JSX.Element {
  return (
    <article className="creative-draft">
      <div className="draft-heading">
        <div>
          <span className="status-chip development">Proposal · not canon</span>
          <h2>{draft.output.title}</h2>
          <p>{draft.output.summary}</p>
        </div>
        <div className="draft-meta">
          <span>{providerNames[draft.provider]}</span>
          <span>{draft.model}</span>
          <span>
            {draft.usage.totalTokens.toLocaleString()} tokens · dollar cost not calculated
          </span>
        </div>
      </div>
      <div className="draft-sections">
        {draft.output.sections.map((section, index) => (
          <section key={`${section.heading}-${index}`}>
            <h3>{section.heading}</h3>
            <p>{section.body}</p>
          </section>
        ))}
      </div>
      {draft.output.continuityQuestions.length > 0 && (
        <section className="draft-review-list">
          <h3>Continuity questions to resolve</h3>
          <ul>
            {draft.output.continuityQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </section>
      )}
      <footer className="draft-provenance">
        <span>Saved locally with source and model lineage</span>
        <span>
          External skills used:{' '}
          {draft.skillsUsed.filter((receipt) => receipt.status === 'succeeded').length === 0
            ? 'none'
            : draft.skillsUsed
                .filter((receipt) => receipt.status === 'succeeded')
                .map((receipt) => `${receipt.displayName} ${receipt.skillVersion}`)
                .join(', ')}
        </span>
      </footer>
      {draft.skillsUsed.length > 0 && (
        <details className="skill-details">
          <summary>Review attached-skill receipts</summary>
          <ul>
            {draft.skillsUsed.map((receipt) => (
              <li key={receipt.receiptId}>
                {receipt.displayName} {receipt.skillVersion} — {receipt.status}. Receipt{' '}
                {receipt.receiptId}; package {receipt.packageSha256.slice(0, 12)}…
                {receipt.failureReason ? ` ${receipt.failureReason}` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  )
}

export function CreativeRoom({
  project,
  writingStatus,
  onHome,
  onSettings
}: {
  project: ProjectDetails
  writingStatus?: WritingSettingsStatus
  onHome(): void
  onSettings(): void
}): JSX.Element {
  const connectedProviders = useMemo(
    () =>
      writingProviders.filter(
        (provider) => writingStatus?.providers[provider].connectionState === 'connected'
      ),
    [writingStatus]
  )
  const savedProvider = writingStatus?.defaultProfile?.provider
  const initialProvider =
    savedProvider && connectedProviders.includes(savedProvider)
      ? savedProvider
      : connectedProviders[0]
  const availableInitialModels = initialProvider
    ? (writingStatus?.providers[initialProvider].models ?? [])
    : []
  const preferredInitialModel =
    writingStatus?.defaultProfile?.provider === initialProvider
      ? writingStatus.defaultProfile.model
      : undefined
  const initialModel =
    availableInitialModels.find((item) => item.id === preferredInitialModel)?.id ??
    availableInitialModels[0]?.id ??
    ''
  const [providerChoice, setProviderChoice] = useState<WritingProvider | undefined>(initialProvider)
  const provider =
    providerChoice && connectedProviders.includes(providerChoice) ? providerChoice : initialProvider
  const [modelChoice, setModelChoice] = useState(initialModel)
  const availableModels = provider ? (writingStatus?.providers[provider].models ?? []) : []
  const savedModel =
    writingStatus?.defaultProfile?.provider === provider
      ? writingStatus.defaultProfile.model
      : undefined
  const model =
    availableModels.find((item) => item.id === modelChoice)?.id ??
    availableModels.find((item) => item.id === savedModel)?.id ??
    availableModels[0]?.id ??
    ''
  const [profile, setProfile] = useState<'balanced' | 'best-draft' | 'custom'>(
    writingStatus?.defaultProfile?.profile ?? 'balanced'
  )
  const [taskKind, setTaskKind] = useState<WritingTaskKind>('outline_episode')
  const [instruction, setInstruction] = useState('')
  const [context, setContext] = useState({
    includeProjectBrief: true,
    includeProductionSettings: true,
    includeCreativeDirection: true
  })
  const [preview, setPreview] = useState<WritingContextPreview>()
  const [previewError, setPreviewError] = useState(false)
  const [skillPlan, setSkillPlan] = useState<ExternalSkillPlanPreview>()
  const [skillPlanError, setSkillPlanError] = useState(false)
  const [paidConfirmed, setPaidConfirmed] = useState(false)
  const [maxOutputTokens, setMaxOutputTokens] = useState(1600)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState<string>()
  const [drafts, setDrafts] = useState<WritingDraftRecord[]>([])
  const [validationMessages, setValidationMessages] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    void window.studio.writing
      .previewContext({ projectId: project.manifest.id, context })
      .then((result) => {
        if (!cancelled) {
          setPreview(result)
          setPreviewError(false)
        }
      })
      .catch(() => {
        if (!cancelled) setPreviewError(true)
      })
    return () => {
      cancelled = true
    }
  }, [context, project.manifest.id])

  useEffect(() => {
    let cancelled = false
    void window.studio.skills
      .previewPlan({ projectId: project.manifest.id, taskKind })
      .then((result) => {
        if (!cancelled) {
          setSkillPlan(result)
          setSkillPlanError(false)
        }
      })
      .catch(() => {
        if (!cancelled) setSkillPlanError(true)
      })
    return () => {
      cancelled = true
    }
  }, [project.manifest.id, taskKind])

  useEffect(() => {
    let cancelled = false
    void window.studio.writing
      .listDrafts(project.manifest.id)
      .then((items) => {
        if (!cancelled) setDrafts(items)
      })
      .catch(() => {
        if (!cancelled) setMessage('Earlier local proposals could not be read safely.')
      })
    return () => {
      cancelled = true
    }
  }, [project.manifest.id])

  const changeProvider = (nextProvider: WritingProvider): void => {
    setProviderChoice(nextProvider)
    setModelChoice(writingStatus?.providers[nextProvider].models[0]?.id ?? '')
  }

  const requestIssues = (): string[] => {
    const issues: string[] = []
    if (!provider || !connectedProviders.includes(provider)) {
      issues.push('Choose a connected writing service.')
    }
    if (!model) issues.push('Choose a writing model.')
    if (instruction.trim().length < 10) {
      issues.push('Enter a writing instruction containing at least 10 characters.')
    }
    if (previewError) issues.push('Repair the context preview before sending anything.')
    else if (!preview) issues.push('Wait for the exact context preview to finish preparing.')
    if (skillPlanError) issues.push('Repair the attached-skill plan before sending anything.')
    else if (!skillPlan) issues.push('Wait for the attached-skill plan to finish preparing.')
    else {
      if (!skillPlan.ready) issues.push(...skillPlan.blockingIssues)
      for (const item of [...skillPlan.required, ...skillPlan.optional].filter(
        (planned) => planned.state === 'ready'
      )) {
        const missing = item.requiredContext.filter((requiredContext) => {
          if (requiredContext === 'project-brief') return !context.includeProjectBrief
          if (requiredContext === 'production-settings') {
            return !context.includeProductionSettings
          }
          return !context.includeCreativeDirection || project.creativeDirection === null
        })
        if (missing.length > 0) {
          issues.push(
            `${item.displayName} needs ${missing.join(', ')} in the selected local context.`
          )
        }
      }
    }
    if (!paidConfirmed) issues.push('Tick the one-request paid-token approval box.')
    return issues
  }

  const generate = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const issues = requestIssues()
    if (issues.length > 0 || !provider || !model || !paidConfirmed || !skillPlan) {
      setValidationMessages(issues)
      return
    }
    setValidationMessages([])
    setGenerating(true)
    setMessage('Sending only the previewed context and waiting for a structured proposal…')
    try {
      const result = await window.studio.writing.generateDraft({
        projectId: project.manifest.id,
        taskKind,
        instruction,
        context,
        provider,
        model,
        profile,
        maxOutputTokens,
        skillPlanSha256: skillPlan.planSha256,
        paidConfirmed: true
      })
      if (result.ok) {
        setDrafts((current) => [result.draft, ...current])
        setPaidConfirmed(false)
        setMessage(
          'The response was validated and saved locally as a proposal, not approved canon.'
        )
      } else {
        setMessage(result.error.message)
      }
    } catch {
      setMessage('The request could not be completed safely. No proposal was saved.')
    } finally {
      setGenerating(false)
    }
  }

  if (connectedProviders.length === 0) {
    return (
      <div className="placeholder-view">
        <button className="text-button back-link" onClick={onHome}>
          ← Production overview
        </button>
        <section className="placeholder-card">
          <div className="placeholder-symbol">S</div>
          <p className="eyebrow">Creative room</p>
          <h1>Connect GPT, Claude, or Gemini to start guided story development.</h1>
          <p>
            Your API key will be protected by Windows. Connecting is a free model-list check; no
            paid writing happens until you approve a request here.
          </p>
          <button className="button button-primary" onClick={onSettings}>
            Open writing connections
          </button>
        </section>
      </div>
    )
  }

  return (
    <div className="creative-room">
      <button className="text-button back-link" onClick={onHome}>
        ← Production overview
      </button>
      <header className="page-heading">
        <p className="eyebrow">Creative room · {project.manifest.code}</p>
        <h1>Develop the story without losing its source.</h1>
        <p>
          Each response is a reviewable local proposal. Nothing becomes approved canon
          automatically.
        </p>
      </header>

      <form className="creative-request" noValidate onSubmit={(event) => void generate(event)}>
        <section className="creative-form-card">
          <div className="subsection-heading">
            <div>
              <h2>1. Describe the help you want</h2>
              <p>The assistant will organise its answer into reviewable sections.</p>
            </div>
          </div>
          <div className="creative-form-grid">
            <label>
              <span>
                Writing task <RequiredMark />
              </span>
              <select
                aria-label="Writing task"
                required
                value={taskKind}
                onChange={(event) => {
                  setTaskKind(event.target.value as WritingTaskKind)
                  setSkillPlan(undefined)
                  setSkillPlanError(false)
                }}
              >
                {taskOptions.map((task) => (
                  <option value={task.value} key={task.value}>
                    {task.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>
                Writing service <RequiredMark />
              </span>
              <select
                aria-label="Writing service"
                required
                aria-invalid={!provider}
                value={provider}
                onChange={(event) => changeProvider(event.target.value as WritingProvider)}
              >
                {connectedProviders.map((item) => (
                  <option value={item} key={item}>
                    {providerNames[item]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>
                Model <RequiredMark />
              </span>
              <select
                aria-label="Model"
                required
                aria-invalid={!model}
                value={model}
                onChange={(event) => setModelChoice(event.target.value)}
              >
                {provider &&
                  writingStatus?.providers[provider].models.map((item) => (
                    <option value={item.id} key={item.id}>
                      {modelLabel(provider, item.id, item.displayName)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <span>
                Writing depth <RequiredMark />
              </span>
              <select
                aria-label="Writing depth"
                required
                value={profile}
                onChange={(event) =>
                  setProfile(event.target.value as 'balanced' | 'best-draft' | 'custom')
                }
              >
                <option value="balanced">Balanced</option>
                <option value="best-draft">Deep first draft</option>
                <option value="custom">Follow my instruction closely</option>
              </select>
            </label>
          </div>
          <label className="instruction-field">
            <span>
              Your instruction <RequiredMark />
            </span>
            <textarea
              aria-label="Your instruction"
              required
              minLength={10}
              aria-invalid={instruction.trim().length < 10}
              aria-describedby="writing-instruction-requirement"
              value={instruction}
              maxLength={12_000}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder="Example: Outline the pilot. Introduce the hero's everyday problem, the event that changes everything, and a final question that makes viewers want episode two."
            />
            <TextRequirement
              id="writing-instruction-requirement"
              value={instruction}
              minimum={10}
              maximum={12_000}
            />
          </label>
        </section>

        <section className="creative-form-card">
          <div className="subsection-heading">
            <div>
              <h2>2. Review attached creative skills</h2>
              <p>
                Only skills enabled for this production and matching this writing task are included.
              </p>
            </div>
            <span>Exact plan</span>
          </div>
          <div className="skill-plan-card">
            {skillPlanError ? (
              <p>The attached-skill plan needs attention. No request can be sent.</p>
            ) : !skillPlan ? (
              <p>Preparing the exact attached-skill plan…</p>
            ) : skillPlan.required.length + skillPlan.optional.length === 0 ? (
              <p>
                No external creative skill matches this task. Built-in studio guidance remains
                active.
              </p>
            ) : (
              [...skillPlan.required, ...skillPlan.optional].map((item) => (
                <div className="skill-plan-item" key={`${item.skillId}-${item.version}`}>
                  <div>
                    <strong>
                      {item.displayName} {item.version} · {item.required ? 'Required' : 'Optional'}
                    </strong>
                    <p>{item.reason}</p>
                    {item.requiredContext.length > 0 && (
                      <p>Needs: {item.requiredContext.join(', ')}.</p>
                    )}
                  </div>
                  <span className={`skill-plan-state ${item.state === 'ready' ? '' : 'blocked'}`}>
                    {item.state === 'ready' ? 'Ready' : 'Blocked'}
                  </span>
                </div>
              ))
            )}
            {skillPlan && skillPlan.blockingIssues.length > 0 && (
              <div className="safety-feedback error" role="status">
                {skillPlan.blockingIssues.join(' ')}
              </div>
            )}
          </div>
          <p className="field-help">
            The studio records the exact package fingerprints and verifies required output sections.
            A skill is never marked used merely because it is installed.
          </p>
        </section>

        <section className="creative-form-card">
          <div className="subsection-heading">
            <div>
              <h2>3. Check exactly what will be shared</h2>
              <p>Untick anything you do not want sent with this request.</p>
            </div>
            <span>Prompt preview</span>
          </div>
          <div className="context-options">
            <label>
              <input
                type="checkbox"
                checked={context.includeProjectBrief}
                onChange={(event) =>
                  setContext((current) => ({
                    ...current,
                    includeProjectBrief: event.target.checked
                  }))
                }
              />
              Project title, type, language, and brief
            </label>
            <label>
              <input
                type="checkbox"
                checked={context.includeProductionSettings}
                onChange={(event) =>
                  setContext((current) => ({
                    ...current,
                    includeProductionSettings: event.target.checked
                  }))
                }
              />
              Duration, visual direction, source mode, and status
            </label>
            <label>
              <input
                type="checkbox"
                checked={context.includeCreativeDirection}
                onChange={(event) =>
                  setContext((current) => ({
                    ...current,
                    includeCreativeDirection: event.target.checked
                  }))
                }
              />
              Audience, niche, tone, themes, boundaries, format, and creative promise
            </label>
          </div>
          <pre className="context-preview">
            {previewError
              ? 'Context preview needs attention. The paid request remains unavailable.'
              : (preview?.text ?? 'Preparing exact local context preview…')}
          </pre>
          <p className="field-help">
            Your API provider also receives your instruction, the selected model settings, and the
            studio’s proposal-format rules plus the exact skill instructions shown above. No
            character files, media, API keys, executable extensions, or GPU tools are attached.
          </p>
        </section>

        <section className="creative-form-card paid-confirmation-card">
          <div>
            <h2>4. Approve this text request</h2>
            <p>
              This can use paid API tokens. It never starts a GPU. Exact dollar cost is not shown
              yet because model price profiles have not passed the planned benchmark.
            </p>
          </div>
          <label>
            <input
              type="checkbox"
              required
              aria-invalid={!paidConfirmed}
              aria-describedby="paid-confirmation-requirement"
              checked={paidConfirmed}
              onChange={(event) => setPaidConfirmed(event.target.checked)}
            />
            <span>
              I approve one paid text request using the model shown above. <RequiredMark />
            </span>
          </label>
          <ChoiceRequirement id="paid-confirmation-requirement" valid={paidConfirmed}>
            Required · confirm this one potentially paid text request. No GPU will start.
          </ChoiceRequirement>
          <label className="token-limit">
            <span>Maximum answer size</span>
            <select
              value={maxOutputTokens}
              onChange={(event) => setMaxOutputTokens(Number(event.target.value))}
            >
              <option value={800}>Short</option>
              <option value={1600}>Standard</option>
              <option value={3000}>Detailed</option>
              <option value={4000}>Maximum allowed</option>
            </select>
          </label>
          <button className="button button-primary button-large" disabled={generating}>
            {generating ? 'Creating proposal…' : 'Create writing proposal'}
          </button>
          {message && <div className="cloud-feedback success">{message}</div>}
        </section>
      </form>

      <ValidationAlert
        title="The writing request is not ready yet"
        messages={validationMessages}
        onClose={() => setValidationMessages([])}
      />

      <section className="creative-results">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Local proposal history</p>
            <h2>{drafts.length > 0 ? 'Review before approving anything' : 'No proposals yet'}</h2>
          </div>
          <span className="status-chip local">Stored in this project</span>
        </div>
        {drafts.map((draft) => (
          <DraftView draft={draft} key={draft.draftId} />
        ))}
      </section>
    </div>
  )
}
