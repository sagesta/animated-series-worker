import { useMemo, useState, type FormEvent, type JSX } from 'react'
import {
  type WritingProvider,
  type WritingSettingsActionResult,
  type WritingSettingsStatus
} from '@studio/contracts'

interface WritingSetupProps {
  status?: WritingSettingsStatus
  onStatus(status: WritingSettingsStatus): void
}

const providerNames: Record<WritingProvider, string> = {
  openai: 'OpenAI (GPT)',
  anthropic: 'Anthropic (Claude)'
}

function actionFeedback(
  result: WritingSettingsActionResult,
  onStatus: (status: WritingSettingsStatus) => void,
  success: string
): { kind: 'success' | 'error'; message: string } {
  if (result.ok) {
    onStatus(result.status)
    return { kind: 'success', message: success }
  }
  return { kind: 'error', message: result.error.message }
}

export function WritingSetup({ status, onStatus }: WritingSetupProps): JSX.Element {
  const [keys, setKeys] = useState<Record<WritingProvider, string>>({ openai: '', anthropic: '' })
  const [show, setShow] = useState<Record<WritingProvider, boolean>>({
    openai: false,
    anthropic: false
  })
  const [busy, setBusy] = useState<string>()
  const [feedback, setFeedback] = useState<{
    kind: 'success' | 'error'
    message: string
  }>()
  const connectedProviders = useMemo(
    () =>
      (['openai', 'anthropic'] as const).filter(
        (provider) => status?.providers[provider].connectionState === 'connected'
      ),
    [status]
  )
  const [profileDraft, setProfileDraft] = useState<{
    provider: WritingProvider
    model: string
    profile: 'balanced' | 'best-draft' | 'custom'
  }>()
  const selectedProfile =
    profileDraft ??
    status?.defaultProfile ??
    (connectedProviders[0]
      ? {
          provider: connectedProviders[0],
          model: status?.providers[connectedProviders[0]].models[0]?.id ?? '',
          profile: 'balanced' as const
        }
      : undefined)

  const connect = async (provider: WritingProvider, event: FormEvent): Promise<void> => {
    event.preventDefault()
    setBusy(`${provider}-connect`)
    setFeedback(undefined)
    try {
      const result = await window.studio.writing.connect({ provider, apiKey: keys[provider] })
      setFeedback(
        actionFeedback(
          result,
          onStatus,
          `${providerNames[provider]} is connected. The model-list check cost $0 and made no writing request.`
        )
      )
      if (result.ok) {
        setKeys((current) => ({ ...current, [provider]: '' }))
        setShow((current) => ({ ...current, [provider]: false }))
      }
    } catch {
      setFeedback({
        kind: 'error',
        message: 'The connection could not be checked safely. No writing request was made.'
      })
    } finally {
      setBusy(undefined)
    }
  }

  const providerAction = async (
    provider: WritingProvider,
    action: 'refresh' | 'toggle' | 'remove'
  ): Promise<void> => {
    setBusy(`${provider}-${action}`)
    setFeedback(undefined)
    try {
      const providerStatus = status?.providers[provider]
      const result =
        action === 'refresh'
          ? await window.studio.writing.refresh({ provider })
          : action === 'toggle'
            ? await window.studio.writing.setEnabled({
                provider,
                enabled: providerStatus?.connectionState === 'disabled'
              })
            : await window.studio.writing.disconnect({ provider })
      setFeedback(
        actionFeedback(
          result,
          onStatus,
          action === 'refresh'
            ? `${providerNames[provider]} was checked again for $0.`
            : action === 'toggle'
              ? `${providerNames[provider]} is now ${result.ok && result.status.providers[provider].enabled ? 'available' : 'disabled'}.`
              : `The protected ${providerNames[provider]} key was removed from this computer.`
        )
      )
    } catch {
      setFeedback({ kind: 'error', message: 'That change could not be completed safely.' })
    } finally {
      setBusy(undefined)
    }
  }

  const saveProfile = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!selectedProfile?.model) return
    setBusy('profile')
    setFeedback(undefined)
    try {
      const result = await window.studio.writing.saveDefaultProfile(selectedProfile)
      setFeedback(
        actionFeedback(
          result,
          onStatus,
          'Your preferred writing service and model were saved locally.'
        )
      )
      if (result.ok) setProfileDraft(undefined)
    } catch {
      setFeedback({ kind: 'error', message: 'The writing preference could not be saved.' })
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <div className="writing-setup-stack">
      <div className="connection-banner">
        <span className="connection-symbol">2</span>
        <div>
          <strong>Add GPT or Claude for story development</strong>
          <p>
            Connecting only checks which models your key can use. A paid writing request happens
            later, in Story, only after you tick a confirmation box.
          </p>
        </div>
        <span className="zero-cost-badge">Connection check: $0</span>
      </div>

      <div className="writing-provider-grid">
        {(['openai', 'anthropic'] as const).map((provider) => {
          const providerStatus = status?.providers[provider]
          const connected =
            providerStatus?.connectionState === 'connected' ||
            providerStatus?.connectionState === 'disabled'
          return (
            <form
              className="writing-provider-card"
              key={provider}
              onSubmit={(event) => void connect(provider, event)}
            >
              <div className="provider-card-heading">
                <div>
                  <h3>{providerNames[provider]}</h3>
                  <span className={`provider-state ${connected ? 'connected' : ''}`}>
                    {providerStatus?.connectionState === 'disabled'
                      ? 'Connected but disabled'
                      : connected
                        ? `${providerStatus?.models.length ?? 0} models available`
                        : 'Not connected'}
                  </span>
                </div>
              </div>
              <label htmlFor={`${provider}-api-key`}>API key</label>
              <div className="secret-input-row">
                <input
                  id={`${provider}-api-key`}
                  type={show[provider] ? 'text' : 'password'}
                  value={keys[provider]}
                  onChange={(event) =>
                    setKeys((current) => ({ ...current, [provider]: event.target.value }))
                  }
                  autoComplete="new-password"
                  spellCheck={false}
                  placeholder={connected ? 'Paste only to replace the saved key' : 'Paste key'}
                />
                <button
                  className="button button-quiet secret-toggle"
                  type="button"
                  onClick={() =>
                    setShow((current) => ({ ...current, [provider]: !current[provider] }))
                  }
                >
                  {show[provider] ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="field-help">
                Windows protects this key outside all project, export, log, and support files.
              </p>
              <button
                className="button button-primary"
                type="submit"
                disabled={Boolean(busy) || keys[provider].trim().length < 20}
              >
                {busy === `${provider}-connect`
                  ? 'Checking safely…'
                  : connected
                    ? 'Test and replace key'
                    : 'Test and store key'}
              </button>
              {connected && (
                <div className="provider-actions">
                  <button
                    className="button button-quiet"
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => void providerAction(provider, 'refresh')}
                  >
                    Refresh models
                  </button>
                  <button
                    className="button button-quiet"
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => void providerAction(provider, 'toggle')}
                  >
                    {providerStatus?.connectionState === 'disabled' ? 'Enable' : 'Disable'}
                  </button>
                  <button
                    className="text-button danger-text"
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => void providerAction(provider, 'remove')}
                  >
                    Remove key
                  </button>
                </div>
              )}
            </form>
          )
        })}
      </div>

      {feedback && (
        <div className={`cloud-feedback ${feedback.kind}`} role="status">
          {feedback.message}
        </div>
      )}

      {selectedProfile && connectedProviders.length > 0 && (
        <form className="writing-profile-card" onSubmit={(event) => void saveProfile(event)}>
          <div className="subsection-heading">
            <div>
              <h3>Preferred writing profile</h3>
              <p>
                There is no hidden “best model” yet. Choose one you can access; benchmark results
                will guide smarter defaults later.
              </p>
            </div>
            <span>Local preference</span>
          </div>
          <div className="writing-profile-grid">
            <label>
              <span>Service</span>
              <select
                value={selectedProfile.provider}
                onChange={(event) => {
                  const provider = event.target.value as WritingProvider
                  setProfileDraft({
                    ...selectedProfile,
                    provider,
                    model: status?.providers[provider].models[0]?.id ?? ''
                  })
                }}
              >
                {connectedProviders.map((provider) => (
                  <option value={provider} key={provider}>
                    {providerNames[provider]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Model</span>
              <select
                value={selectedProfile.model}
                onChange={(event) =>
                  setProfileDraft({ ...selectedProfile, model: event.target.value })
                }
              >
                {status?.providers[selectedProfile.provider].models.map((model) => (
                  <option value={model.id} key={model.id}>
                    {model.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Writing depth</span>
              <select
                value={selectedProfile.profile}
                onChange={(event) =>
                  setProfileDraft({
                    ...selectedProfile,
                    profile: event.target.value as typeof selectedProfile.profile
                  })
                }
              >
                <option value="balanced">Balanced</option>
                <option value="best-draft">Deep first draft</option>
                <option value="custom">Follow my instruction closely</option>
              </select>
            </label>
          </div>
          <button className="button button-secondary" disabled={Boolean(busy)}>
            {busy === 'profile' ? 'Saving…' : 'Save writing preference'}
          </button>
        </form>
      )}
    </div>
  )
}
