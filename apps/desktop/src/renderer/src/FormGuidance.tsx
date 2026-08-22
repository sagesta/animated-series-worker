import { useEffect, useId, useRef, type JSX } from 'react'

export function RequiredMark(): JSX.Element {
  return <span className="required-mark" aria-hidden="true" />
}

export function TextRequirement({
  id,
  value,
  minimum,
  maximum,
  label = 'characters'
}: {
  id: string
  value: string
  minimum: number
  maximum?: number
  label?: string
}): JSX.Element {
  const length = value.trim().length
  const missing = length === 0
  const short = length > 0 && length < minimum
  const valid = length >= minimum

  return (
    <small
      id={id}
      className={`field-requirement ${valid ? 'valid' : 'needs-attention'}`}
      aria-live="polite"
    >
      {missing && `Required · enter at least ${minimum} ${label}.`}
      {short &&
        `Too short · add ${minimum - length} more ${minimum - length === 1 ? 'character' : 'characters'}.`}
      {valid && `${length}${maximum ? ` / ${maximum}` : ''} ${label}.`}
    </small>
  )
}

export function ChoiceRequirement({
  id,
  valid,
  validMessage = 'Requirement met.',
  children
}: {
  id: string
  valid: boolean
  validMessage?: string
  children: string
}): JSX.Element {
  return (
    <small
      id={id}
      className={`field-requirement ${valid ? 'valid' : 'needs-attention'}`}
      aria-live="polite"
    >
      {valid ? validMessage : children}
    </small>
  )
}

export function ValidationAlert({
  title = 'A few things need attention',
  messages,
  onClose
}: {
  title?: string
  messages: string[]
  onClose(): void
}): JSX.Element | null {
  const closeRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (messages.length === 0) return
    previousFocusRef.current = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      previousFocusRef.current?.focus()
    }
  }, [messages, onClose])

  if (messages.length === 0) return null

  return (
    <div className="validation-alert-backdrop" role="presentation">
      <section
        className="validation-alert"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={(event) => {
          if (event.key === 'Tab') {
            event.preventDefault()
            closeRef.current?.focus()
          }
        }}
      >
        <span className="validation-alert-symbol" aria-hidden="true">
          !
        </span>
        <div>
          <p className="eyebrow">Before continuing</p>
          <h2 id={titleId}>{title}</h2>
          <p id={descriptionId}>Nothing was submitted or charged. Please correct the following:</p>
          <ul>
            {messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
          <button ref={closeRef} className="button button-primary" type="button" onClick={onClose}>
            Go back and fix
          </button>
        </div>
      </section>
    </div>
  )
}
