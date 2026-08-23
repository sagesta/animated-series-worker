import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
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

export interface IdeaAssistantTarget {
  id: string
  label: string
  taskKind: WritingTaskKind
  instruction: string
  currentValue?: string
  onUse?(value: string): void
  humanOnly?: boolean
}

const providers = ['openai', 'anthropic', 'gemini'] as const
const providerNames: Record<WritingProvider, string> = {
  openai: 'OpenAI (GPT)',
  anthropic: 'Anthropic (Claude)',
  gemini: 'Google Gemini'
}

function modelLabel(provider: WritingProvider, modelId: string, displayName: string): string {
  const purpose = WRITING_MODEL_CATALOG[provider].find((item) => item.id === modelId)?.purpose
  return purpose ? `${displayName} — ${purpose}` : displayName
}

function requestInstruction(target: IdeaAssistantTarget, userGoal: string): string {
  const current = target.currentValue?.trim()
  return [
    `Help the creator complete the production field “${target.label}”.`,
    target.instruction,
    current
      ? `Current draft:\n${current.slice(0, 4_000)}`
      : 'The field is empty; generate an original starting point grounded in the selected project context.',
    `Creator's request:\n${userGoal.trim()}`,
    'Put the strongest paste-ready answer in the proposal summary. Put meaningfully different alternatives or supporting detail in separate sections. Do not claim that the suggestion is approved, factual, rights-cleared, policy-compliant, or production-qualified.'
  ].join('\n\n')
}

export function IdeaAssistant({
  project,
  targets,
  buttonLabel = 'Help me create this'
}: {
  project: ProjectDetails
  targets: IdeaAssistantTarget[]
  buttonLabel?: string
}): JSX.Element | null {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [targetId, setTargetId] = useState(targets[0]?.id ?? '')
  const [status, setStatus] = useState<WritingSettingsStatus>()
  const [providerChoice, setProviderChoice] = useState<WritingProvider>()
  const [modelChoice, setModelChoice] = useState('')
  const [profile, setProfile] = useState<'balanced' | 'best-draft' | 'custom'>('balanced')
  const [contextPreview, setContextPreview] = useState<WritingContextPreview>()
  const [skillPlan, setSkillPlan] = useState<ExternalSkillPlanPreview>()
  const [userGoal, setUserGoal] = useState(
    'Suggest a strong, production-ready starting point and explain the important choices.'
  )
  const [paidConfirmed, setPaidConfirmed] = useState(false)
  const [result, setResult] = useState<WritingDraftRecord>()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string>()
  const [issues, setIssues] = useState<string[]>([])

  const target = targets.find((item) => item.id === targetId) ?? targets[0]
  const connectedProviders = useMemo(
    () =>
      providers.filter((provider) => status?.providers[provider].connectionState === 'connected'),
    [status]
  )
  const provider =
    providerChoice && connectedProviders.includes(providerChoice)
      ? providerChoice
      : status?.defaultProfile?.provider &&
          connectedProviders.includes(status.defaultProfile.provider)
        ? status.defaultProfile.provider
        : connectedProviders[0]
  const models = provider ? (status?.providers[provider].models ?? []) : []
  const preferredModel =
    status?.defaultProfile?.provider === provider ? (status?.defaultProfile?.model ?? '') : ''
  const model =
    models.find((item) => item.id === modelChoice)?.id ??
    models.find((item) => item.id === preferredModel)?.id ??
    models[0]?.id ??
    ''
  const targetTaskKind = target?.taskKind

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void Promise.all([
      window.studio.writing.getStatus(),
      window.studio.writing.previewContext({
        projectId: project.manifest.id,
        context: {
          includeProjectBrief: true,
          includeProductionSettings: true,
          includeCreativeDirection: true
        }
      })
    ])
      .then(([nextStatus, preview]) => {
        if (cancelled) return
        setStatus(nextStatus)
        setProfile(nextStatus.defaultProfile?.profile ?? 'balanced')
        setContextPreview(preview)
        setNotice(undefined)
      })
      .catch(() => {
        if (!cancelled)
          setNotice('The writing connection or project context could not be checked safely.')
      })
    return () => {
      cancelled = true
    }
  }, [open, project.manifest.id])

  useEffect(() => {
    if (!open || !targetTaskKind) return
    let cancelled = false
    void window.studio.skills
      .previewPlan({ projectId: project.manifest.id, taskKind: targetTaskKind })
      .then((plan) => {
        if (!cancelled) setSkillPlan(plan)
      })
      .catch(() => {
        if (!cancelled)
          setNotice('The attached-skill plan could not be checked. No request was sent.')
      })
    return () => {
      cancelled = true
    }
  }, [open, project.manifest.id, targetTaskKind])

  useEffect(() => {
    if (!open) return
    const trigger = triggerRef.current
    closeRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !busy) setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      trigger?.focus()
    }
  }, [busy, open])

  if (!target) return null

  const close = (): void => {
    if (!busy) setOpen(false)
  }

  const generate = async (): Promise<void> => {
    const nextIssues: string[] = []
    if (!provider || !connectedProviders.includes(provider))
      nextIssues.push('Connect GPT, Claude, or Gemini in Settings first.')
    if (!model) nextIssues.push('Choose an available writing model.')
    if (userGoal.trim().length < 10)
      nextIssues.push('Describe the help you want using at least 10 characters.')
    if (!contextPreview) nextIssues.push('Wait for the exact project context preview.')
    if (!skillPlan) nextIssues.push('Wait for the attached-skill plan.')
    else if (!skillPlan.ready) nextIssues.push(...skillPlan.blockingIssues)
    if (!paidConfirmed) nextIssues.push('Approve this one potentially paid text request.')
    if (nextIssues.length > 0 || !provider || !model || !contextPreview || !skillPlan) {
      setIssues(nextIssues)
      return
    }
    setIssues([])
    setBusy(true)
    setNotice('Creating a reviewable idea using only the context shown here…')
    setResult(undefined)
    try {
      const response = await window.studio.writing.generateDraft({
        projectId: project.manifest.id,
        taskKind: target.taskKind,
        instruction: requestInstruction(target, userGoal),
        context: {
          includeProjectBrief: true,
          includeProductionSettings: true,
          includeCreativeDirection: true
        },
        provider,
        model,
        profile,
        maxOutputTokens: 1600,
        skillPlanSha256: skillPlan.planSha256,
        paidConfirmed: true
      })
      if (!response.ok) {
        setNotice(response.error.message)
        return
      }
      setResult(response.draft)
      setPaidConfirmed(false)
      setNotice('Saved locally as a proposal. Review it before using any part.')
    } catch {
      setNotice('The idea request could not be completed safely. No proposal was saved.')
    } finally {
      setBusy(false)
    }
  }

  const applyValue = (value: string): void => {
    target.onUse?.(value.trim())
    setNotice(`The suggestion was placed in “${target.label}”. Review and edit it before saving.`)
  }

  return (
    <>
      <button
        ref={triggerRef}
        className="button button-idea"
        type="button"
        onClick={() => {
          setOpen(true)
          setTargetId(targets[0]?.id ?? '')
          setResult(undefined)
          setNotice('Checking your protected writing connection…')
          setIssues([])
          setPaidConfirmed(false)
          setContextPreview(undefined)
          setSkillPlan(undefined)
        }}
      >
        ✦ {buttonLabel}
      </button>
      {open && (
        <div className="modal-backdrop idea-assistant-backdrop" role="presentation">
          <section
            className="idea-assistant"
            role="dialog"
            aria-modal="true"
            aria-labelledby="idea-assistant-title"
          >
            <header className="idea-assistant-heading">
              <div>
                <p className="eyebrow">Project-aware idea assistant</p>
                <h2 id="idea-assistant-title">Create an idea without losing project context</h2>
                <p>
                  The answer is stored as a proposal. It never changes canon, approves media, starts
                  a GPU, completes a policy declaration, or publishes anything.
                </p>
              </div>
              <button
                ref={closeRef}
                className="icon-button"
                type="button"
                aria-label="Close idea assistant"
                disabled={busy}
                onClick={close}
              >
                ×
              </button>
            </header>

            <div className="idea-assistant-body">
              <section className="idea-assistant-controls">
                <label>
                  <span>
                    What should the AI help with? <RequiredMark />
                  </span>
                  <select
                    value={target.id}
                    onChange={(event) => {
                      setTargetId(event.target.value)
                      setResult(undefined)
                      setPaidConfirmed(false)
                      setSkillPlan(undefined)
                    }}
                  >
                    {targets.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                        {item.humanOnly ? ' — explanation only' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>
                    Your direction <RequiredMark />
                  </span>
                  <textarea
                    rows={4}
                    minLength={10}
                    maxLength={2_000}
                    value={userGoal}
                    onChange={(event) => setUserGoal(event.target.value)}
                  />
                  <TextRequirement
                    id="idea-assistant-direction-requirement"
                    value={userGoal}
                    minimum={10}
                    maximum={2_000}
                  />
                </label>
                {connectedProviders.length === 0 ? (
                  <div className="field-warning danger">
                    Connect GPT, Claude, or Gemini in Settings. The assistant cannot use or reveal
                    an API key from anywhere else.
                  </div>
                ) : (
                  <div className="creative-form-grid">
                    <label>
                      Writing service <RequiredMark />
                      <select
                        value={provider}
                        onChange={(event) => {
                          const next = event.target.value as WritingProvider
                          setProviderChoice(next)
                          setModelChoice(status?.providers[next].models[0]?.id ?? '')
                        }}
                      >
                        {connectedProviders.map((item) => (
                          <option key={item} value={item}>
                            {providerNames[item]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Model <RequiredMark />
                      <select
                        value={model}
                        onChange={(event) => setModelChoice(event.target.value)}
                      >
                        {provider &&
                          status?.providers[provider].models.map((item) => (
                            <option key={item.id} value={item.id}>
                              {modelLabel(provider, item.id, item.displayName)}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Depth
                      <select
                        value={profile}
                        onChange={(event) =>
                          setProfile(event.target.value as 'balanced' | 'best-draft' | 'custom')
                        }
                      >
                        <option value="balanced">Balanced</option>
                        <option value="best-draft">Deep first draft</option>
                        <option value="custom">Follow my direction closely</option>
                      </select>
                    </label>
                  </div>
                )}

                <details className="idea-context-preview">
                  <summary>Review what will be shared and which skills will be used</summary>
                  <pre>{contextPreview?.text ?? 'Preparing exact project context…'}</pre>
                  <p>
                    Attached skills:{' '}
                    {!skillPlan
                      ? 'checking…'
                      : [...skillPlan.required, ...skillPlan.optional]
                          .map((item) => `${item.displayName} ${item.version} — ${item.state}`)
                          .join(', ') || 'none for this task'}
                  </p>
                </details>

                {target.humanOnly && (
                  <div className="field-warning danger">
                    This item remains yours to decide. The assistant can explain what to consider,
                    but its answer cannot be inserted or recorded as your decision.
                  </div>
                )}
                <label className="checkbox-row strong-confirmation">
                  <input
                    type="checkbox"
                    checked={paidConfirmed}
                    onChange={(event) => setPaidConfirmed(event.target.checked)}
                  />
                  <span>
                    I approve one potentially paid text request. No GPU will start. <RequiredMark />
                  </span>
                </label>
                <ChoiceRequirement id="idea-paid-confirmation" valid={paidConfirmed}>
                  Required · approve only this text request.
                </ChoiceRequirement>
                <button
                  className="button button-primary button-large"
                  type="button"
                  disabled={busy}
                  onClick={() => void generate()}
                >
                  {busy ? 'Creating idea…' : 'Create reviewable idea'}
                </button>
                {notice && (
                  <div className="safety-feedback" role="status">
                    {notice}
                  </div>
                )}
              </section>

              <section className="idea-assistant-result" aria-live="polite">
                {!result ? (
                  <div className="idea-empty">
                    <span>✦</span>
                    <h3>Your suggestion will appear here</h3>
                    <p>
                      You can use one option, edit it, or close this window without changing
                      anything.
                    </p>
                  </div>
                ) : (
                  <>
                    <span className="status-chip development">Proposal · review required</span>
                    <h3>{result.output.title}</h3>
                    <article>
                      <p>{result.output.summary}</p>
                      {target.onUse && (
                        <button
                          className="button button-secondary"
                          type="button"
                          onClick={() => applyValue(result.output.summary)}
                        >
                          Use this suggestion
                        </button>
                      )}
                    </article>
                    {result.output.sections.map((section, index) => (
                      <article key={`${section.heading}-${index}`}>
                        <h4>{section.heading}</h4>
                        <p>{section.body}</p>
                        {target.onUse && (
                          <button
                            className="button button-quiet"
                            type="button"
                            onClick={() => applyValue(section.body)}
                          >
                            Use this alternative
                          </button>
                        )}
                      </article>
                    ))}
                    <small>
                      Saved in Story proposal history with provider, model, context, and skill
                      receipts.
                    </small>
                  </>
                )}
              </section>
            </div>
          </section>
          <ValidationAlert
            title="The idea request is not ready yet"
            messages={issues}
            onClose={() => setIssues([])}
          />
        </div>
      )}
    </>
  )
}
