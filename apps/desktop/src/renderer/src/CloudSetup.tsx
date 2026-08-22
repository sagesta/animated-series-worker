import { useState, type FormEvent, type JSX } from 'react'
import {
  DEFAULT_CLOUD_GUARDRAILS,
  type CloudActionResult,
  type CloudConnectionStatus,
  type CloudGuardrails
} from '@studio/contracts'
import { ChoiceRequirement, RequiredMark, TextRequirement, ValidationAlert } from './FormGuidance'

interface CloudSetupProps {
  status?: CloudConnectionStatus
  onStatus(status: CloudConnectionStatus): void
}

type BusyAction = 'connect' | 'refresh' | 'disconnect' | 'guardrails'
type Feedback = { kind: 'success' | 'error'; message: string }

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(value)
}

function formatCheckedAt(value?: string | null): string {
  if (!value) return 'just now'

  const checkedAt = new Date(value)
  if (Number.isNaN(checkedAt.getTime())) return 'just now'

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(checkedAt)
}

function applyResult(
  result: CloudActionResult,
  onStatus: (status: CloudConnectionStatus) => void,
  successMessage: string
): Feedback {
  if (result.ok) {
    onStatus(result.status)
    return { kind: 'success', message: successMessage }
  }
  return { kind: 'error', message: result.error.message }
}

export function CloudSetup({ status, onStatus }: CloudSetupProps): JSX.Element {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [busy, setBusy] = useState<BusyAction>()
  const [feedback, setFeedback] = useState<Feedback>()
  const [confirmRemoval, setConfirmRemoval] = useState(false)
  const [guardrailDraft, setGuardrailDraft] = useState<CloudGuardrails>()
  const [validationMessages, setValidationMessages] = useState<string[]>([])
  const guardrails = guardrailDraft ?? status?.guardrails ?? DEFAULT_CLOUD_GUARDRAILS

  const connect = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (apiKey.trim().length < 20) {
      setValidationMessages(['Enter a RunPod API key containing at least 20 characters.'])
      return
    }
    setValidationMessages([])
    setBusy('connect')
    setFeedback(undefined)
    try {
      const result = await window.studio.cloud.connect({ apiKey })
      const nextFeedback = applyResult(
        result,
        onStatus,
        status?.credentialStored
          ? 'The replacement key was tested and stored securely. No GPU was rented.'
          : 'RunPod is connected. The free check did not rent a GPU.'
      )
      setFeedback(nextFeedback)
      if (result.ok) {
        setApiKey('')
        setShowKey(false)
      }
    } catch {
      setFeedback({
        kind: 'error',
        message: 'The connection could not be tested safely. No GPU was rented.'
      })
    } finally {
      setBusy(undefined)
    }
  }

  const refresh = async (): Promise<void> => {
    setBusy('refresh')
    setFeedback(undefined)
    try {
      setFeedback(
        applyResult(
          await window.studio.cloud.refresh(),
          onStatus,
          'The account and current GPU prices were checked again. No GPU was rented.'
        )
      )
    } catch {
      setFeedback({
        kind: 'error',
        message: 'RunPod could not be refreshed safely. No GPU was rented.'
      })
    } finally {
      setBusy(undefined)
    }
  }

  const disconnect = async (): Promise<void> => {
    setBusy('disconnect')
    setFeedback(undefined)
    try {
      const result = await window.studio.cloud.disconnect()
      setFeedback(
        applyResult(result, onStatus, 'The protected RunPod key was removed from this computer.')
      )
      if (result.ok) setConfirmRemoval(false)
    } catch {
      setFeedback({
        kind: 'error',
        message: 'The protected key could not be removed safely.'
      })
    } finally {
      setBusy(undefined)
    }
  }

  const saveGuardrails = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const issues: string[] = []
    if (
      !Number.isFinite(guardrails.maxSessionCostUsd) ||
      guardrails.maxSessionCostUsd < 1 ||
      guardrails.maxSessionCostUsd > 1000
    ) {
      issues.push('Set the maximum session cost between $1 and $1,000.')
    }
    if (
      !Number.isInteger(guardrails.maxRuntimeMinutes) ||
      guardrails.maxRuntimeMinutes < 15 ||
      guardrails.maxRuntimeMinutes > 1440
    ) {
      issues.push('Set the maximum session time to a whole number from 15 to 1,440 minutes.')
    }
    if (
      !Number.isInteger(guardrails.idleTimeoutMinutes) ||
      guardrails.idleTimeoutMinutes < 2 ||
      guardrails.idleTimeoutMinutes > 60
    ) {
      issues.push('Set idle shutdown to a whole number from 2 to 60 minutes.')
    }
    if (
      !Number.isInteger(guardrails.maxConcurrentGpus) ||
      guardrails.maxConcurrentGpus < 1 ||
      guardrails.maxConcurrentGpus > 3
    ) {
      issues.push('Set concurrent GPUs to a whole number from 1 to 3.')
    }
    if (issues.length > 0) {
      setValidationMessages(issues)
      return
    }
    setValidationMessages([])
    setBusy('guardrails')
    setFeedback(undefined)
    try {
      const result = await window.studio.cloud.saveGuardrails(guardrails)
      setFeedback(
        applyResult(
          result,
          onStatus,
          'Safety defaults were saved locally. They cannot start a GPU.'
        )
      )
      if (result.ok) setGuardrailDraft(undefined)
    } catch {
      setFeedback({
        kind: 'error',
        message: 'Check the safety-limit values and try again. No paid action was started.'
      })
    } finally {
      setBusy(undefined)
    }
  }

  const connected = status?.connectionState === 'connected'
  const account = status?.account

  return (
    <div className="cloud-setup-stack">
      <div className={`connection-banner ${connected ? 'connected' : ''}`}>
        <span className="connection-symbol" aria-hidden="true">
          {connected ? '✓' : '1'}
        </span>
        <div>
          <strong>{connected ? 'RunPod account connected' : 'Connect your RunPod account'}</strong>
          <p>
            {connected
              ? `Last checked ${formatCheckedAt(account?.checkedAt)}. Your key is never shown back to the app screen.`
              : 'This checks the key and reads your account status. It does not create, start, or rent a GPU.'}
          </p>
        </div>
        <span className="zero-cost-badge">Check cost: $0</span>
      </div>

      {account && account.activePods > 0 && (
        <div className="account-warning" role="status">
          <span>!</span>
          <div>
            <strong>
              RunPod reports {account.activePods} active {account.activePods === 1 ? 'Pod' : 'Pods'}
            </strong>
            <p>
              Their reported rate totals {formatCurrency(account.activeHourlyCostUsd)}/hour. This
              app did not create them and will not stop them automatically.
            </p>
          </div>
        </div>
      )}

      <form className="cloud-form" noValidate onSubmit={(event) => void connect(event)}>
        <label htmlFor="runpod-api-key">
          RunPod API key <RequiredMark />
        </label>
        <div className="secret-input-row">
          <input
            id="runpod-api-key"
            required
            minLength={20}
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            autoComplete="new-password"
            spellCheck={false}
            placeholder={
              connected ? 'Paste a new key only when replacing it' : 'Paste your key here'
            }
            aria-invalid={apiKey.trim().length < 20}
            aria-describedby="runpod-key-requirement runpod-key-help"
          />
          <button
            className="button button-quiet secret-toggle"
            type="button"
            aria-pressed={showKey}
            onClick={() => setShowKey((current) => !current)}
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
        <TextRequirement id="runpod-key-requirement" value={apiKey} minimum={20} />
        <p id="runpod-key-help" className="field-help">
          Stored outside every production using Windows-protected encryption. It is excluded from
          project files, exports, logs, and Git.
        </p>
        <div className="cloud-form-actions">
          <button className="button button-primary" type="submit" disabled={Boolean(busy)}>
            {busy === 'connect'
              ? 'Testing safely…'
              : connected
                ? 'Test and replace key'
                : 'Test and store securely'}
          </button>
          {connected && (
            <button
              className="button button-quiet"
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void refresh()}
            >
              {busy === 'refresh' ? 'Checking…' : 'Refresh free check'}
            </button>
          )}
        </div>
      </form>

      {feedback && (
        <div
          className={`cloud-feedback ${feedback.kind}`}
          role={feedback.kind === 'error' ? 'alert' : 'status'}
        >
          {feedback.message}
        </div>
      )}

      {connected && (
        <div className="connection-details">
          <div>
            <span>Account Pods found</span>
            <strong>{account?.totalPods ?? 0}</strong>
          </div>
          <div>
            <span>Active reported rate</span>
            <strong>{formatCurrency(account?.activeHourlyCostUsd ?? 0)}/hr</strong>
          </div>
          <div>
            <span>GPU rented by this app</span>
            <strong className="positive-status">None</strong>
          </div>
        </div>
      )}

      {connected && status.gpuOptions.length > 0 && (
        <div className="gpu-price-panel">
          <div className="subsection-heading">
            <div>
              <h3>Current planning prices</h3>
              <p>
                Read from RunPod on {formatCheckedAt(status.gpuCatalogCheckedAt)}. These are
                catalogue rates, not a rental quote.
              </p>
            </div>
            <span>Read only</span>
          </div>
          <div className="gpu-table" role="table" aria-label="Current RunPod GPU planning prices">
            <div className="gpu-table-row header" role="row">
              <span role="columnheader">GPU</span>
              <span role="columnheader">Memory</span>
              <span role="columnheader">Secure</span>
              <span role="columnheader">Community</span>
            </div>
            {status.gpuOptions.map((option) => (
              <div className="gpu-table-row" role="row" key={option.id}>
                <span role="cell">
                  <strong>{option.name}</strong>
                  <small>
                    {option.ltxCompatibility === 'meets-baseline'
                      ? 'Meets official LTX-2.5 memory baseline'
                      : 'Below official LTX-2.5 memory baseline'}
                  </small>
                </span>
                <span role="cell">{option.memoryGb} GB</span>
                <span role="cell">
                  {option.secureHourlyUsd === null
                    ? '—'
                    : `${formatCurrency(option.secureHourlyUsd)}/hr`}
                </span>
                <span role="cell">
                  {option.communityHourlyUsd === null
                    ? '—'
                    : `${formatCurrency(option.communityHourlyUsd)}/hr`}
                </span>
              </div>
            ))}
          </div>
          <p className="plain-language-note">
            <strong>Important:</strong> an RTX 4090 has 24 GB of VRAM, not 80 GB. The official
            LTX-2.5 baseline is 32 GB; A100 80 GB is a different GPU. The final choice will use a
            measured test, price limit, and your approval.
          </p>
        </div>
      )}

      {connected && status.catalogMessage && (
        <p className="catalog-message">{status.catalogMessage}</p>
      )}

      <form className="guardrail-panel" noValidate onSubmit={(event) => void saveGuardrails(event)}>
        <div className="subsection-heading">
          <div>
            <h3>Default spending safety</h3>
            <p>
              Save conservative defaults now. They become enforceable only after the automatic
              worker and independent shutdown guard are built and tested.
            </p>
          </div>
          <span>{status?.guardrailsSaved ? 'Saved locally' : 'Needs saving'}</span>
        </div>
        <div className="guardrail-grid">
          <label>
            <span>
              Maximum cost per session <RequiredMark />
            </span>
            <div className="unit-input">
              <span>$</span>
              <input
                aria-label="Maximum cost per session"
                type="number"
                required
                min="1"
                max="1000"
                step="0.5"
                value={guardrails.maxSessionCostUsd}
                aria-invalid={
                  !Number.isFinite(guardrails.maxSessionCostUsd) ||
                  guardrails.maxSessionCostUsd < 1 ||
                  guardrails.maxSessionCostUsd > 1000
                }
                aria-describedby="guardrail-cost-requirement"
                onChange={(event) =>
                  setGuardrailDraft({
                    ...guardrails,
                    maxSessionCostUsd: Number(event.target.value)
                  })
                }
              />
            </div>
            <ChoiceRequirement
              id="guardrail-cost-requirement"
              valid={
                Number.isFinite(guardrails.maxSessionCostUsd) &&
                guardrails.maxSessionCostUsd >= 1 &&
                guardrails.maxSessionCostUsd <= 1000
              }
              validMessage="Allowed range: $1 to $1,000."
            >
              Required · use $1 to $1,000.
            </ChoiceRequirement>
          </label>
          <label>
            <span>
              Maximum session time <RequiredMark />
            </span>
            <div className="unit-input suffix">
              <input
                aria-label="Maximum session time"
                type="number"
                required
                min="15"
                max="1440"
                step="15"
                value={guardrails.maxRuntimeMinutes}
                aria-invalid={
                  !Number.isInteger(guardrails.maxRuntimeMinutes) ||
                  guardrails.maxRuntimeMinutes < 15 ||
                  guardrails.maxRuntimeMinutes > 1440
                }
                aria-describedby="guardrail-runtime-requirement"
                onChange={(event) =>
                  setGuardrailDraft({
                    ...guardrails,
                    maxRuntimeMinutes: Number(event.target.value)
                  })
                }
              />
              <span>min</span>
            </div>
            <ChoiceRequirement
              id="guardrail-runtime-requirement"
              valid={
                Number.isInteger(guardrails.maxRuntimeMinutes) &&
                guardrails.maxRuntimeMinutes >= 15 &&
                guardrails.maxRuntimeMinutes <= 1440
              }
              validMessage="Allowed range: 15 to 1,440 whole minutes."
            >
              Required · use 15 to 1,440 whole minutes.
            </ChoiceRequirement>
          </label>
          <label>
            <span>
              Shut down after idle <RequiredMark />
            </span>
            <div className="unit-input suffix">
              <input
                aria-label="Shut down after idle"
                type="number"
                required
                min="2"
                max="60"
                step="1"
                value={guardrails.idleTimeoutMinutes}
                aria-invalid={
                  !Number.isInteger(guardrails.idleTimeoutMinutes) ||
                  guardrails.idleTimeoutMinutes < 2 ||
                  guardrails.idleTimeoutMinutes > 60
                }
                aria-describedby="guardrail-idle-requirement"
                onChange={(event) =>
                  setGuardrailDraft({
                    ...guardrails,
                    idleTimeoutMinutes: Number(event.target.value)
                  })
                }
              />
              <span>min</span>
            </div>
            <ChoiceRequirement
              id="guardrail-idle-requirement"
              valid={
                Number.isInteger(guardrails.idleTimeoutMinutes) &&
                guardrails.idleTimeoutMinutes >= 2 &&
                guardrails.idleTimeoutMinutes <= 60
              }
              validMessage="Allowed range: 2 to 60 whole minutes."
            >
              Required · use 2 to 60 whole minutes.
            </ChoiceRequirement>
          </label>
          <label>
            <span>
              Most GPUs at once <RequiredMark />
            </span>
            <div className="unit-input suffix">
              <input
                aria-label="Most GPUs at once"
                type="number"
                required
                min="1"
                max="3"
                step="1"
                value={guardrails.maxConcurrentGpus}
                aria-invalid={
                  !Number.isInteger(guardrails.maxConcurrentGpus) ||
                  guardrails.maxConcurrentGpus < 1 ||
                  guardrails.maxConcurrentGpus > 3
                }
                aria-describedby="guardrail-gpus-requirement"
                onChange={(event) =>
                  setGuardrailDraft({
                    ...guardrails,
                    maxConcurrentGpus: Number(event.target.value)
                  })
                }
              />
              <span>GPU</span>
            </div>
            <ChoiceRequirement
              id="guardrail-gpus-requirement"
              valid={
                Number.isInteger(guardrails.maxConcurrentGpus) &&
                guardrails.maxConcurrentGpus >= 1 &&
                guardrails.maxConcurrentGpus <= 3
              }
              validMessage="Allowed range: 1 to 3 whole GPUs."
            >
              Required · use 1 to 3 whole GPUs.
            </ChoiceRequirement>
          </label>
        </div>
        <button className="button button-secondary" type="submit" disabled={Boolean(busy)}>
          {busy === 'guardrails' ? 'Saving…' : 'Save safety defaults'}
        </button>
      </form>

      <div className="setup-checklist">
        <div className="subsection-heading">
          <div>
            <h3>Prepared studio check</h3>
            <p>Green means proven. Grey items are honestly still locked.</p>
          </div>
          <span>
            {status?.generationState === 'ready' ? 'Generation ready' : 'Generation locked'}
          </span>
        </div>
        <ul>
          <li className={status?.setupChecklist.accountConnected ? 'complete' : ''}>
            <span>{status?.setupChecklist.accountConnected ? '✓' : '1'}</span>
            Cloud account connected with a free check
          </li>
          <li className={status?.setupChecklist.guardrailsSaved ? 'complete' : ''}>
            <span>{status?.setupChecklist.guardrailsSaved ? '✓' : '2'}</span>
            Spending defaults saved locally
          </li>
          <li className={status?.setupChecklist.modelStorageReady ? 'complete' : ''}>
            <span>{status?.setupChecklist.modelStorageReady ? '✓' : '3'}</span> Persistent model
            storage created and verified
          </li>
          <li className={status?.setupChecklist.workerImageReady ? 'complete' : ''}>
            <span>{status?.setupChecklist.workerImageReady ? '✓' : '4'}</span> Pinned ComfyUI, Qwen,
            TTS, LTX, and lip-sync worker verified
          </li>
          <li className={status?.setupChecklist.automaticShutdownTested ? 'complete' : ''}>
            <span>{status?.setupChecklist.automaticShutdownTested ? '✓' : '5'}</span> Paid smoke
            test, idle stop, hard stop, purge, and termination proven
          </li>
        </ul>
        <p className="locked-explanation">{status?.generationReason}</p>
      </div>

      {connected && (
        <div className="remove-connection">
          {!confirmRemoval ? (
            <button
              className="text-button danger-text"
              type="button"
              onClick={() => setConfirmRemoval(true)}
            >
              Remove RunPod connection from this computer
            </button>
          ) : (
            <div className="remove-confirmation">
              <p>
                This removes only the protected key. It does not stop or delete anything in RunPod.
              </p>
              <button
                className="button button-danger"
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void disconnect()}
              >
                {busy === 'disconnect' ? 'Removing…' : 'Remove protected key'}
              </button>
              <button
                className="button button-quiet"
                type="button"
                disabled={Boolean(busy)}
                onClick={() => setConfirmRemoval(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
      <ValidationAlert
        title="This setup needs a little more information"
        messages={validationMessages}
        onClose={() => setValidationMessages([])}
      />
    </div>
  )
}
