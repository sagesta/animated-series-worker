import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import {
  type ExternalSkillPlanPreview,
  type ProjectDetails,
  type WritingContextPreview,
  type WritingDraftRecord,
  type WritingProvider,
  type WritingSettingsStatus,
  type WritingTaskKind
} from '@studio/contracts'
import { RequiredMark, TextRequirement, ValidationAlert } from './FormGuidance'

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
  openai: 'OpenAI',
  anthropic: 'Claude',
  gemini: 'Gemini'
}

const DEFAULT_GOAL = 'Give me the strongest option for this project.'

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
  const [contextPreview, setContextPreview] = useState<WritingContextPreview>()
  const [skillPlan, setSkillPlan] = useState<ExternalSkillPlanPreview>()
  const [userGoal, setUserGoal] = useState(DEFAULT_GOAL)
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
    status?.defaultProfile?.provider && connectedProviders.includes(status.defaultProfile.provider)
      ? status.defaultProfile.provider
      : connectedProviders[0]
  const models = provider ? (status?.providers[provider].models ?? []) : []
  const preferredModel =
    status?.defaultProfile?.provider === provider ? (status?.defaultProfile?.model ?? '') : ''
  const modelOption = models.find((item) => item.id === preferredModel) ?? models[0]
  const model = modelOption?.id ?? ''
  const profile = status?.defaultProfile?.profile ?? 'balanced'
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
          includeCreativeDirection: true,
          includeApprovedCanon: true
        }
      })
    ])
      .then(([nextStatus, preview]) => {
        if (cancelled) return
        setStatus(nextStatus)
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
    if (nextIssues.length > 0 || !provider || !model || !contextPreview || !skillPlan) {
      setIssues(nextIssues)
      return
    }
    setIssues([])
    setBusy(true)
    setNotice('Writing your suggestion… Longer project context can take a few minutes.')
    setResult(undefined)
    try {
      const response = await window.studio.writing.generateDraft({
        projectId: project.manifest.id,
        taskKind: target.taskKind,
        instruction: requestInstruction(target, userGoal),
        context: {
          includeProjectBrief: true,
          includeProductionSettings: true,
          includeCreativeDirection: true,
          includeApprovedCanon: true
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
      setNotice(undefined)
    } catch {
      setNotice('The idea request could not be completed safely. No proposal was saved.')
    } finally {
      setBusy(false)
    }
  }

  const applyValue = (value: string): void => {
    target.onUse?.(value.trim())
    setOpen(false)
  }

  const plannedSkills = skillPlan ? [...skillPlan.required, ...skillPlan.optional] : []

  return (
    <>
      <button
        ref={triggerRef}
        className="button button-idea"
        type="button"
        onClick={() => {
          setOpen(true)
          setTargetId(targets[0]?.id ?? '')
          setUserGoal(DEFAULT_GOAL)
          setResult(undefined)
          setNotice('Preparing your project details…')
          setIssues([])
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
                <p className="eyebrow">AI suggestion</p>
                <h2 id="idea-assistant-title">
                  {result ? 'Review your suggestion' : `Get help with ${target.label}`}
                </h2>
                <p>
                  {result
                    ? 'Nothing changes until you choose to use it.'
                    : 'Say what you want. The app adds the relevant project details for you.'}
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
              {!result ? (
                <section className="idea-assistant-controls">
                  {targets.length > 1 && (
                    <label>
                      <span>
                        Help me with <RequiredMark />
                      </span>
                      <select
                        value={target.id}
                        onChange={(event) => {
                          setTargetId(event.target.value)
                          setResult(undefined)
                          setNotice('Preparing the right project details…')
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
                  )}

                  <label className="idea-prompt">
                    <span>
                      What do you want? <RequiredMark />
                    </span>
                    <textarea
                      autoFocus
                      rows={5}
                      minLength={10}
                      maxLength={2_000}
                      value={userGoal}
                      onChange={(event) => setUserGoal(event.target.value)}
                      placeholder="Example: Make it warmer, more visual, and easier to animate."
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
                      Connect one writing service in Settings first. No API key is ever shown here.
                    </div>
                  ) : (
                    <div className="idea-connection-summary" aria-label="Selected AI service">
                      <span aria-hidden="true">✦</span>
                      <div>
                        <strong>
                          {modelOption
                            ? `Uses ${modelOption.displayName}`
                            : 'Preparing your saved AI connection'}
                        </strong>
                        <p>Your story and approved project decisions are included automatically.</p>
                      </div>
                    </div>
                  )}

                  <details className="idea-context-preview">
                    <summary>What will be shared</summary>
                    <div className="idea-context-summary">
                      <p>
                        <strong>AI service</strong>
                        <span>
                          {provider && modelOption
                            ? `${providerNames[provider]} · ${modelOption.displayName}`
                            : status
                              ? 'Not connected yet'
                              : 'Checking your saved connection…'}
                        </span>
                      </p>
                      <p>
                        <strong>Project information</strong>
                        <span>
                          Story brief, production settings, creative direction, and approved work
                        </span>
                      </p>
                      <p>
                        <strong>Extra creative guidance</strong>
                        <span>
                          {!skillPlan
                            ? 'Checking…'
                            : plannedSkills.length > 0
                              ? plannedSkills
                                  .map((item) => `${item.displayName} ${item.version}`)
                                  .join(', ')
                              : 'None needed for this request'}
                        </span>
                      </p>
                    </div>
                    <details className="idea-exact-context">
                      <summary>View the exact project text</summary>
                      <pre>{contextPreview?.text ?? 'Preparing exact project context…'}</pre>
                    </details>
                  </details>

                  {target.humanOnly && (
                    <div className="field-warning danger">
                      This decision remains yours. AI can explain the considerations, but it cannot
                      fill in or record the answer.
                    </div>
                  )}

                  {notice && (
                    <div className="safety-feedback" role="status">
                      {notice}
                    </div>
                  )}

                  <footer className="idea-request-actions">
                    <small>
                      {provider
                        ? `This may create one billed ${providerNames[provider]} text request. No GPU starts.`
                        : 'No request is sent until a writing service is ready.'}
                    </small>
                    <button
                      className="button button-primary button-large"
                      type="button"
                      disabled={busy}
                      onClick={() => void generate()}
                    >
                      {busy
                        ? 'Writing your suggestion…'
                        : target.humanOnly
                          ? 'Explain this decision'
                          : 'Generate suggestion'}
                    </button>
                  </footer>
                </section>
              ) : (
                <section className="idea-assistant-result" aria-live="polite">
                  <span className="status-chip development">Suggestion · review first</span>
                  <h3>{result.output.title}</h3>
                  <article className="idea-primary-result">
                    <p>{result.output.summary}</p>
                  </article>

                  {result.output.sections.length > 0 && (
                    <details className="idea-more-results">
                      <summary>More detail and alternatives</summary>
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
                              Use this instead
                            </button>
                          )}
                        </article>
                      ))}
                    </details>
                  )}

                  <footer className="idea-result-actions">
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => setResult(undefined)}
                    >
                      Ask again
                    </button>
                    {target.onUse ? (
                      <button
                        className="button button-primary button-large"
                        type="button"
                        onClick={() => applyValue(result.output.summary)}
                      >
                        Use this suggestion
                      </button>
                    ) : (
                      <button className="button button-primary" type="button" onClick={close}>
                        Done
                      </button>
                    )}
                  </footer>
                  <small className="idea-history-note">
                    A reviewable copy was saved with its AI and project history.
                  </small>
                </section>
              )}
            </div>
          </section>
          <ValidationAlert
            title="The suggestion is not ready yet"
            messages={issues}
            onClose={() => setIssues([])}
          />
        </div>
      )}
    </>
  )
}
