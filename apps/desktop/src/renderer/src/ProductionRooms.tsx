import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type JSX } from 'react'
import {
  type CanonRecord,
  type CloudConnectionStatus,
  type CostEstimate,
  type MediaAssetKind,
  type MediaAssetView,
  type ProductionJobRecord,
  type ProductionWorkflowSummary,
  type ProductionWorkspaceSummary,
  type ProjectDetails,
  type ProjectSummary,
  type UpstreamImportRecord
} from '@studio/contracts'
import { RequiredMark, TextRequirement, ValidationAlert } from './FormGuidance'
import { IdeaAssistant } from './IdeaAssistant'
import { targetedEditInputError, targetedEditParameters } from './targetedEdit'

const assetKindOptions: Array<{ value: MediaAssetKind; label: string }> = [
  { value: 'reference-image', label: 'Character or visual reference' },
  { value: 'character-board', label: 'Character board' },
  { value: 'style-board', label: 'Style board' },
  { value: 'environment-board', label: 'Environment board' },
  { value: 'storyboard-frame', label: 'Storyboard frame' },
  { value: 'start-frame-control', label: 'Control · start frame' },
  { value: 'end-frame-control', label: 'Control · end frame' },
  { value: 'pose-control', label: 'Control · pose skeleton' },
  { value: 'depth-control', label: 'Control · depth map' },
  { value: 'edge-control', label: 'Control · edge map' },
  { value: 'segmentation-control', label: 'Control · segmentation map' },
  { value: 'region-mask', label: 'Control · region or occlusion mask' },
  { value: 'motion-track', label: 'Control · motion track data' },
  { value: 'reference-clip', label: 'Control · rights-cleared reference clip' },
  { value: 'foreground-layer', label: 'Parallax · foreground layer' },
  { value: 'subject-layer', label: 'Parallax · subject layer' },
  { value: 'background-layer', label: 'Parallax · background layer' },
  { value: 'voice-line', label: 'Voice line' },
  { value: 'ambience', label: 'Ambience' },
  { value: 'effect', label: 'Sound effect' },
  { value: 'music', label: 'Music' },
  { value: 'animatic', label: 'Animatic' },
  { value: 'video-take', label: 'Video take' },
  { value: 'caption', label: 'Caption file' },
  { value: 'thumbnail', label: 'Thumbnail' },
  { value: 'master-video', label: 'Master video' },
  { value: 'adaptation-dataset', label: 'Adaptation · rights-reviewed dataset manifest' },
  { value: 'adaptation-artifact', label: 'Adaptation · trained candidate artifact' },
  { value: 'document', label: 'Production document' }
]

const canonKindLabels: Record<CanonRecord['kind'], string> = {
  'series-bible': 'Series or film bible',
  character: 'Character',
  world: 'World',
  location: 'Location',
  prop: 'Prop',
  'visual-style': 'Visual style',
  voice: 'Voice',
  'episode-outline': 'Episode or film outline',
  script: 'Script',
  storyboard: 'Storyboard plan',
  'release-strategy': 'YouTube release strategy'
}

export interface RetakeContext {
  asset: MediaAssetView
  job: ProductionJobRecord
}

export type QuickCreateMode = 'image' | 'video' | 'audio' | 'composition' | 'stitch'

export interface QuickCreateIntent {
  mode: QuickCreateMode
  workflowId: string | null
  outputKind: MediaAssetKind | null
  label: string
  instruction: string
}

interface AdaptationSampleDraft {
  caption: string
  rightsBasis: '' | 'owned-original' | 'licensed-for-model-training'
  licenseReference: string
  consentConfirmed: boolean
}

function MediaPreview({ asset }: { asset: MediaAssetView }): JSX.Element {
  if (asset.mimeType.startsWith('image/')) {
    return <img src={asset.mediaUrl} alt={asset.label} loading="lazy" />
  }
  if (asset.mimeType.startsWith('audio/')) {
    return <audio src={asset.mediaUrl} controls preload="metadata" aria-label={asset.label} />
  }
  if (asset.mimeType.startsWith('video/')) {
    return <video src={asset.mediaUrl} controls preload="metadata" aria-label={asset.label} />
  }
  return (
    <div className="document-preview" aria-label={`${asset.label} document`}>
      DOC
    </div>
  )
}

function ReviewMediaPreview({ asset }: { asset: MediaAssetView }): JSX.Element {
  const mediaRef = useRef<HTMLMediaElement | null>(null)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [zoom, setZoom] = useState(1)
  const isVisual = asset.mimeType.startsWith('image/') || asset.mimeType.startsWith('video/')
  const isTimed = asset.mimeType.startsWith('audio/') || asset.mimeType.startsWith('video/')

  const updatePlaybackRate = (value: number): void => {
    setPlaybackRate(value)
    if (mediaRef.current) mediaRef.current.playbackRate = value
  }

  return (
    <div className="review-media-shell">
      <div className="review-media-preview">
        {asset.mimeType.startsWith('image/') ? (
          <img
            src={asset.mediaUrl}
            alt={asset.label}
            loading="lazy"
            style={{ width: `${zoom * 100}%` }}
          />
        ) : asset.mimeType.startsWith('audio/') ? (
          <audio
            ref={(node) => {
              mediaRef.current = node
              if (node) node.playbackRate = playbackRate
            }}
            src={asset.mediaUrl}
            controls
            preload="metadata"
            aria-label={asset.label}
          />
        ) : asset.mimeType.startsWith('video/') ? (
          <video
            ref={(node) => {
              mediaRef.current = node
              if (node) node.playbackRate = playbackRate
            }}
            src={asset.mediaUrl}
            controls
            preload="metadata"
            aria-label={asset.label}
            style={{ width: `${zoom * 100}%` }}
          />
        ) : (
          <div className="document-preview" aria-label={`${asset.label} document`}>
            DOC
          </div>
        )}
      </div>
      {(isVisual || isTimed) && (
        <div className="review-media-controls" aria-label={`${asset.label} viewing controls`}>
          {isVisual && (
            <label>
              Zoom
              <input
                type="range"
                min="1"
                max="2.5"
                step="0.25"
                aria-label="Zoom"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
              <span>{Math.round(zoom * 100)}%</span>
            </label>
          )}
          {isTimed && (
            <label>
              Playback speed
              <select
                aria-label="Playback speed"
                value={playbackRate}
                onChange={(event) => updatePlaybackRate(Number(event.target.value))}
              >
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}×
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  )
}

function WorkspaceState({
  projectId,
  children
}: {
  projectId: string
  children(
    workspace: ProductionWorkspaceSummary,
    refresh: () => Promise<void>,
    setNotice: (message: string) => void
  ): JSX.Element
}): JSX.Element {
  const [workspace, setWorkspace] = useState<ProductionWorkspaceSummary>()
  const [message, setMessage] = useState<string>()

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setWorkspace(await window.studio.production.getWorkspace(projectId))
    } catch {
      setMessage('This production workspace could not be read safely. No file was changed.')
    }
  }, [projectId])

  useEffect(() => {
    let cancelled = false
    void window.studio.production
      .getWorkspace(projectId)
      .then((result) => {
        if (!cancelled) setWorkspace(result)
      })
      .catch(() => {
        if (!cancelled) setMessage('This production workspace could not be read safely.')
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  if (!workspace) {
    return (
      <div className="settings-card backup-empty">
        {message ?? 'Opening the local production records…'}
      </div>
    )
  }

  return (
    <>
      {message && (
        <div className="safety-feedback" role="status">
          {message}
        </div>
      )}
      {children(workspace, refresh, setMessage)}
    </>
  )
}

function MediaImport({
  projectId,
  onImported,
  onNotice
}: {
  projectId: string
  onImported(): Promise<void>
  onNotice(message: string): void
}): JSX.Element {
  const [kind, setKind] = useState<MediaAssetKind>('reference-image')
  const [label, setLabel] = useState('')
  const [importing, setImporting] = useState(false)
  const [issues, setIssues] = useState<string[]>([])

  const importMedia = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const nextIssues =
      label.trim().length < 2 ? ['Enter a clear media name containing at least 2 characters.'] : []
    if (nextIssues.length > 0) {
      setIssues(nextIssues)
      return
    }
    setIssues([])
    setImporting(true)
    try {
      const result = await window.studio.production.importMedia({
        projectId,
        kind,
        label,
        parentAssetIds: []
      })
      if (result.ok) {
        onNotice('A verified copy was stored inside this production. Review it before approval.')
        setLabel('')
        await onImported()
      } else {
        onNotice(result.error.message)
      }
    } catch {
      onNotice('The file could not be imported safely. Existing media was not changed.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <form className="media-import-card" noValidate onSubmit={(event) => void importMedia(event)}>
        <div>
          <h2>Add an existing reference or production file</h2>
          <p>
            The studio checks the file type, calculates a fingerprint, and stores a separate copy in
            this project. The original remains untouched.
          </p>
        </div>
        <label>
          <span>
            What is it? <RequiredMark />
          </span>
          <select value={kind} onChange={(event) => setKind(event.target.value as MediaAssetKind)}>
            {assetKindOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>
            Media name <RequiredMark />
          </span>
          <input
            value={label}
            minLength={2}
            maxLength={240}
            aria-invalid={label.trim().length < 2}
            aria-describedby="media-label-requirement"
            placeholder="Example: Ayo front-view identity reference"
            onChange={(event) => setLabel(event.target.value)}
          />
          <TextRequirement id="media-label-requirement" value={label} minimum={2} maximum={240} />
        </label>
        <button className="button button-primary" disabled={importing}>
          {importing ? 'Checking and copying…' : 'Choose file to import'}
        </button>
      </form>
      <ValidationAlert
        title="Media import needs attention"
        messages={issues}
        onClose={() => setIssues([])}
      />
    </>
  )
}

function CanonGrid({ canon }: { canon: CanonRecord[] }): JSX.Element {
  const active = canon.filter((record) => record.state === 'active')
  if (active.length === 0) {
    return (
      <div className="settings-card backup-empty">
        No canon has been approved yet. Review a writing proposal in the Story room first.
      </div>
    )
  }
  return (
    <div className="canon-grid">
      {active.map((record) => (
        <article key={record.canonId}>
          <div className="canon-card-heading">
            <span>{canonKindLabels[record.kind]}</span>
            <strong>Revision {record.revision}</strong>
          </div>
          <h3>{record.label}</h3>
          <p>{record.output.summary}</p>
          <details>
            <summary>Review locked details</summary>
            {record.output.sections.map((section) => (
              <section key={section.heading}>
                <h4>{section.heading}</h4>
                <p>{section.body}</p>
              </section>
            ))}
          </details>
          <small>Approved {new Date(record.approval.decidedAt).toLocaleString()}</small>
        </article>
      ))}
    </div>
  )
}

export function WorldCastRoom({
  project,
  onHome
}: {
  project: ProjectDetails
  onHome(): void
}): JSX.Element {
  return (
    <div className="production-room">
      <button className="text-button back-link" onClick={onHome}>
        ← Production overview
      </button>
      <header className="page-heading">
        <p className="eyebrow">World and cast · {project.manifest.code}</p>
        <h1>One approved source for every recurring detail.</h1>
        <p>
          Canon records are versioned; references are project-isolated; imported files stay
          candidates until you approve them.
        </p>
      </header>
      <div className="room-assistant-row">
        <div>
          <strong>Brainstorm before you lock anything</strong>
          <span>
            Create character, relationship, world, location, prop, style, or voice proposals.
          </span>
        </div>
        <IdeaAssistant
          project={project}
          buttonLabel="Generate cast and world ideas"
          targets={[
            {
              id: 'character',
              label: 'Character concept and development',
              taskKind: 'develop_character',
              instruction:
                'Develop motives, contradictions, relationships, voice, silhouette, identity anchors, wardrobe logic, expressions, development arc, and continuity risks.'
            },
            {
              id: 'relationship',
              label: 'Relationship dynamics',
              taskKind: 'develop_character',
              instruction:
                'Create a relationship map with wants, tensions, history, power shifts, recurring behavior, and episode-level development opportunities.'
            },
            {
              id: 'world',
              label: 'Story world',
              taskKind: 'build_world',
              instruction:
                'Develop repeatable rules, culture, institutions, geography, visual anchors, daily life, sources of conflict, and constraints that create stories.'
            },
            {
              id: 'location',
              label: 'Recurring location',
              taskKind: 'build_world',
              instruction:
                'Design a production-friendly location with zones, scale, lighting states, props, story uses, visual anchors, and continuity rules.'
            },
            {
              id: 'prop',
              label: 'Story prop',
              taskKind: 'build_world',
              instruction:
                'Design a recognizable prop with purpose, appearance, scale, material, ownership, rules, story uses, and continuity states.'
            },
            {
              id: 'style',
              label: 'Original visual style system',
              taskKind: 'design_visual_generation',
              instruction:
                'Define shape language, line, palette, materials, lighting, texture, depth, animation economy, backgrounds, and repeatable consistency anchors without copying a living artist.'
            },
            {
              id: 'voice',
              label: 'Original character voice',
              taskKind: 'design_voice_performance',
              instruction:
                'Design an original voice using range, texture, rhythm, energy, emotional limits, pronunciation needs, calibration lines, and performance notes. Do not clone a real person.'
            }
          ]}
        />
      </div>
      <WorkspaceState projectId={project.manifest.id}>
        {(workspace, refresh, setNotice) => (
          <>
            <section>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Approved creative truth</p>
                  <h2>Canon library</h2>
                </div>
                <span className="status-chip local">
                  {workspace.canon.filter((item) => item.state === 'active').length} active
                </span>
              </div>
              <CanonGrid canon={workspace.canon} />
            </section>
            <section>
              <MediaImport
                projectId={project.manifest.id}
                onImported={refresh}
                onNotice={setNotice}
              />
            </section>
            <section>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Project media</p>
                  <h2>References and boards</h2>
                </div>
                <span className="status-chip development">{workspace.media.length} stored</span>
              </div>
              <MediaGrid media={workspace.media} />
            </section>
          </>
        )}
      </WorkspaceState>
    </div>
  )
}

function MediaGrid({ media }: { media: MediaAssetView[] }): JSX.Element {
  if (media.length === 0) {
    return (
      <div className="settings-card backup-empty">
        No media has been added to this production yet.
      </div>
    )
  }
  return (
    <div className="media-grid">
      {media.map((asset) => (
        <article key={asset.assetId}>
          <div className="media-preview">
            <MediaPreview asset={asset} />
          </div>
          <div className="media-card-copy">
            <span className={`media-state ${asset.state}`}>{asset.state.replace('-', ' ')}</span>
            <h3>{asset.label}</h3>
            <p>
              {asset.kind.replaceAll('-', ' ')} · {(asset.byteSize / 1024).toFixed(1)} KB
            </p>
            <small>Integrity checked when this media was added</small>
          </div>
        </article>
      ))}
    </div>
  )
}

function ReviewCard({
  asset,
  job,
  references,
  onReviewed,
  onNotice,
  onRetake
}: {
  asset: MediaAssetView
  job?: ProductionJobRecord
  references: MediaAssetView[]
  onReviewed(): Promise<void>
  onNotice(message: string): void
  onRetake(context: RetakeContext): void
}): JSX.Element {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [issues, setIssues] = useState<string[]>([])

  const decide = async (
    decision: 'approved' | 'rejected' | 'changes-requested' | 'held'
  ): Promise<void> => {
    if (reason.trim().length < 3) {
      setIssues(['Enter a review note containing at least 3 characters.'])
      return
    }
    if (decision === 'changes-requested' && !job) {
      setIssues([
        'This media was added outside a generation job, so it cannot create a linked retake. Reject it or generate a fresh candidate instead.'
      ])
      return
    }
    setSaving(true)
    setIssues([])
    try {
      const result = await window.studio.production.reviewMedia({
        projectId: asset.projectId,
        assetId: asset.assetId,
        expectedSha256: asset.sha256,
        decision,
        reason,
        confirmation: true
      })
      if (result.ok) {
        const outcome =
          decision === 'approved'
            ? 'approved'
            : decision === 'held'
              ? 'placed on hold'
              : decision === 'changes-requested'
                ? 'marked for a linked retake'
                : 'rejected'
        onNotice(`${asset.label} was ${outcome}. The inspected file was not overwritten.`)
        await onReviewed()
        if (decision === 'changes-requested' && job) onRetake({ asset, job })
      } else {
        onNotice(result.error.message)
      }
    } catch {
      onNotice('The review decision could not be saved safely.')
    } finally {
      setSaving(false)
    }
  }

  const direction = job
    ? ['prompt', 'instruction', 'text', 'direction', 'motionPrompt', 'voiceDescription']
        .map((key) => job.parameters[key])
        .find((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : undefined
  const elapsedSeconds = job
    ? Math.max(
        0,
        Math.round((new Date(job.updatedAt).getTime() - new Date(job.createdAt).getTime()) / 1_000)
      )
    : undefined

  return (
    <article className="review-card">
      <ReviewMediaPreview asset={asset} />
      <div className="review-card-copy">
        <span className={`media-state ${asset.state}`}>
          {asset.state === 'held' ? 'On hold' : 'Awaiting decision'}
        </span>
        <h2>{asset.label}</h2>
        <p>Inspect identity, style, defects, continuity, and whether this is safe to reuse.</p>
        <details className="take-details">
          <summary>Show details</summary>
          <dl>
            <div>
              <dt>Production direction</dt>
              <dd>{direction ?? 'Added locally without a saved generation direction'}</dd>
            </div>
            <div>
              <dt>Approved references</dt>
              <dd>
                {references.length > 0
                  ? references.map((reference) => reference.label).join(', ')
                  : 'No reference media'}
              </dd>
            </div>
            <div>
              <dt>Runtime</dt>
              <dd>
                {job
                  ? `${elapsedSeconds} seconds recorded · ${job.estimate.expectedRuntimeMinutes} minutes estimated`
                  : 'No cloud runtime'}
              </dd>
            </div>
            <div>
              <dt>Cost</dt>
              <dd>
                {job
                  ? `${formatUsd(job.actualCostUsd)} recorded · ${formatUsd(job.estimate.maximumTotalUsd)} maximum`
                  : 'No generation cost'}
              </dd>
            </div>
            {typeof job?.parameters.seed === 'number' && (
              <div>
                <dt>Variation seed</dt>
                <dd>{job.parameters.seed}</dd>
              </div>
            )}
            {asset.copiedFrom && (
              <div>
                <dt>Reuse</dt>
                <dd>Explicitly copied from another production and awaiting a fresh decision</dd>
              </div>
            )}
          </dl>
        </details>
        <label>
          <span>
            Review note <RequiredMark />
          </span>
          <textarea
            value={reason}
            minLength={3}
            maxLength={2_000}
            aria-invalid={reason.trim().length < 3}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <div className="review-actions">
          <button
            className="button button-primary"
            disabled={saving}
            onClick={() => void decide('approved')}
          >
            ✓ Approve
          </button>
          <button
            className="button button-danger"
            disabled={saving}
            onClick={() => void decide('rejected')}
          >
            × Reject
          </button>
          <button
            className="button button-secondary"
            disabled={saving || !job}
            title={
              job ? 'Create a linked child job with changed settings' : 'No parent job is available'
            }
            onClick={() => void decide('changes-requested')}
          >
            ↻ Retake
          </button>
          <button
            className="button button-secondary"
            disabled={saving || asset.state === 'held'}
            onClick={() => void decide('held')}
          >
            ‖ Hold
          </button>
        </div>
      </div>
      <ValidationAlert
        title="Review decision needs attention"
        messages={issues}
        onClose={() => setIssues([])}
      />
    </article>
  )
}

function CrossProjectCopy({
  sourceProjectId,
  media,
  onNotice
}: {
  sourceProjectId: string
  media: MediaAssetView[]
  onNotice(message: string): void
}): JSX.Element {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [assetId, setAssetId] = useState('')
  const [targetProjectId, setTargetProjectId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const selectedAssetId = media.some((item) => item.assetId === assetId)
    ? assetId
    : (media[0]?.assetId ?? '')

  useEffect(() => {
    let cancelled = false
    void window.studio.projects
      .list()
      .then((items) => {
        if (cancelled) return
        const targets = items.filter((item) => item.id !== sourceProjectId)
        setProjects(targets)
        setTargetProjectId(targets[0]?.id ?? '')
      })
      .catch(() => {
        if (!cancelled) onNotice('Other productions could not be checked. Nothing was copied.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [onNotice, sourceProjectId])

  const copy = async (): Promise<void> => {
    const asset = media.find((item) => item.assetId === selectedAssetId)
    const target = projects.find((item) => item.id === targetProjectId)
    if (!asset || !target) {
      onNotice('Choose approved media and another production first. Nothing was copied.')
      return
    }
    if (
      !window.confirm(
        `Copy “${asset.label}” into “${target.title}” as a new candidate requiring its own review?`
      )
    )
      return
    setBusy(true)
    try {
      const result = await window.studio.production.copyMedia({
        sourceProjectId,
        sourceAssetId: asset.assetId,
        targetProjectId: target.id,
        label: `${asset.label} — copied for review`,
        confirmation: true
      })
      onNotice(
        result.ok
          ? `A verified copy was added to ${target.title}. It must be reviewed there before use.`
          : result.error.message
      )
    } catch {
      onNotice('The copy could not be completed safely. Neither production was changed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="cross-project-copy" aria-labelledby="cross-project-copy-title">
      <div>
        <p className="eyebrow">Explicit reuse only</p>
        <h2 id="cross-project-copy-title">Copy approved media to another production</h2>
        <p>
          Media never crosses projects automatically. A copy keeps its source record and starts as a
          fresh candidate in the destination.
        </p>
      </div>
      {loading ? (
        <p role="status">Checking your other productions…</p>
      ) : media.length === 0 ? (
        <p>No approved media is available to copy.</p>
      ) : projects.length === 0 ? (
        <p>Create a second production before copying media.</p>
      ) : (
        <div className="cross-project-copy-controls">
          <label>
            Approved media
            <select value={selectedAssetId} onChange={(event) => setAssetId(event.target.value)}>
              {media.map((asset) => (
                <option key={asset.assetId} value={asset.assetId}>
                  {asset.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Destination production
            <select
              value={targetProjectId}
              onChange={(event) => setTargetProjectId(event.target.value)}
            >
              {projects.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.title}
                </option>
              ))}
            </select>
          </label>
          <button className="button button-secondary" disabled={busy} onClick={() => void copy()}>
            {busy ? 'Copying safely…' : 'Copy for fresh review'}
          </button>
        </div>
      )}
    </section>
  )
}

export function MediaReviewRoom({
  project,
  onHome,
  onRetake
}: {
  project: ProjectDetails
  onHome(): void
  onRetake(context: RetakeContext): void
}): JSX.Element {
  return (
    <div className="production-room">
      <button className="text-button back-link" onClick={onHome}>
        ← Production overview
      </button>
      <header className="page-heading">
        <p className="eyebrow">Review · {project.manifest.code}</p>
        <h1>Approve the exact take you inspected.</h1>
        <p>
          Images, audio, and video play inside the studio. Decisions are recorded and earlier files
          remain available for recovery.
        </p>
      </header>
      <WorkspaceState projectId={project.manifest.id}>
        {(workspace, refresh, setNotice) => {
          const candidates = workspace.media.filter((asset) =>
            ['candidate', 'held'].includes(asset.state)
          )
          return (
            <>
              <section className="review-summary">
                <article>
                  <strong>{candidates.length}</strong>
                  <span>Awaiting review</span>
                </article>
                <article>
                  <strong>
                    {workspace.media.filter((asset) => asset.state === 'approved').length}
                  </strong>
                  <span>Approved</span>
                </article>
                <article>
                  <strong>
                    {workspace.media.filter((asset) => asset.state === 'rejected').length}
                  </strong>
                  <span>Rejected</span>
                </article>
                <article>
                  <strong>
                    {workspace.media.filter((asset) => asset.state === 'held').length}
                  </strong>
                  <span>On hold</span>
                </article>
              </section>
              {candidates.length === 0 ? (
                <div className="settings-card backup-empty">
                  No media candidate is waiting for a decision.
                </div>
              ) : (
                <div className="review-list">
                  {candidates.map((asset) => (
                    <ReviewCard
                      key={asset.assetId}
                      asset={asset}
                      job={workspace.jobs.find((job) => job.jobId === asset.jobId)}
                      references={workspace.media.filter((reference) =>
                        workspace.jobs
                          .find((job) => job.jobId === asset.jobId)
                          ?.inputAssetIds.includes(reference.assetId)
                      )}
                      onReviewed={refresh}
                      onNotice={setNotice}
                      onRetake={onRetake}
                    />
                  ))}
                </div>
              )}
              <section>
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Decision history</p>
                    <h2>All project media</h2>
                  </div>
                </div>
                <MediaGrid media={workspace.media} />
              </section>
              <CrossProjectCopy
                sourceProjectId={project.manifest.id}
                media={workspace.media.filter((asset) => asset.state === 'approved')}
                onNotice={setNotice}
              />
            </>
          )
        }}
      </WorkspaceState>
    </div>
  )
}

function ImportPreviewCard({
  record,
  onAccepted,
  onNotice
}: {
  record: UpstreamImportRecord
  onAccepted(): Promise<void>
  onNotice(message: string): void
}): JSX.Element {
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [issues, setIssues] = useState<string[]>([])
  const plan = record.normalized
  const sceneCount =
    plan?.acts.reduce(
      (total, act) =>
        total +
        act.sequences.reduce(
          (sequenceTotal, sequence) => sequenceTotal + sequence.scenes.length,
          0
        ),
      0
    ) ?? 0
  const shotCount =
    plan?.acts.reduce(
      (total, act) =>
        total +
        act.sequences.reduce(
          (sequenceTotal, sequence) =>
            sequenceTotal +
            sequence.scenes.reduce((sceneTotal, scene) => sceneTotal + scene.shots.length, 0),
          0
        ),
      0
    ) ?? 0

  const accept = async (): Promise<void> => {
    if (!confirmed || !plan) {
      setIssues([
        plan
          ? 'Confirm that you reviewed the duration, warnings, acts, scenes, and source mapping.'
          : 'Only a validated normalization preview can be accepted.'
      ])
      return
    }
    setSaving(true)
    setIssues([])
    try {
      const result = await window.studio.upstream.acceptImport({
        projectId: record.projectId,
        importId: record.importId,
        expectedNormalizedSha256: plan.normalizedSha256,
        confirmation: true
      })
      if (result.ok) {
        onNotice(
          'The reviewed long-form plan is now stored in this production. No GPU was started.'
        )
        await onAccepted()
      } else {
        onNotice(result.error.message)
      }
    } catch {
      onNotice('The plan could not be accepted safely. The preview remains unchanged.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="import-preview-card">
      <header>
        <div>
          <span
            className={`media-state ${record.state === 'accepted' ? 'approved' : record.state === 'validation-failed' ? 'rejected' : 'candidate'}`}
          >
            {record.state.replace('-', ' ')}
          </span>
          <h2>Story package · {new Date(record.createdAt).toLocaleString()}</h2>
          <p>Validated source version recorded</p>
        </div>
        {plan && (
          <div className="import-kpis">
            <span>
              <strong>{Math.round(plan.targetDurationSeconds / 60)}</strong> minutes
            </span>
            <span>
              <strong>{plan.acts.length}</strong> acts
            </span>
            <span>
              <strong>{sceneCount}</strong> scenes
            </span>
            <span>
              <strong>{shotCount}</strong> shot intents
            </span>
          </div>
        )}
      </header>
      <div className="source-validation-list">
        {record.files.map((file) => (
          <div key={file.role}>
            <span>{file.role}</span>
            <strong
              className={file.validationState === 'passed' ? 'positive-status' : 'negative-status'}
            >
              {file.validationState}
            </strong>
            <small>{file.originalName} · integrity checked</small>
          </div>
        ))}
      </div>
      {record.state === 'validation-failed' && (
        <div className="safety-feedback error">
          At least one safety check refused this package. The copied source remains available for
          review, but no production plan was created.
        </div>
      )}
      {plan && (
        <>
          <section className="normalization-warnings">
            <h3>Important normalization warnings</h3>
            <ul>
              {plan.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </section>
          <div className="act-preview-grid">
            {plan.acts.map((act) => (
              <article key={act.actNumber}>
                <span>
                  Act {act.actNumber} · {Math.round(act.targetSeconds / 60)} min
                </span>
                <h3>{act.label}</h3>
                <p>{act.dramaticPurpose}</p>
                <ul>
                  {act.sequences.map((sequence) => (
                    <li key={sequence.sequenceId}>
                      <strong>{sequence.label}</strong> · {sequence.scenes.length} scenes ·{' '}
                      {Math.round(sequence.targetSeconds / 60)} min
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </>
      )}
      {record.state === 'preview' && plan && (
        <div className="import-acceptance">
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              I reviewed the long-form changes and accept this plan as a project source.{' '}
              <RequiredMark />
            </span>
          </label>
          <button className="button button-primary" disabled={saving} onClick={() => void accept()}>
            {saving ? 'Saving accepted plan…' : 'Accept long-form plan'}
          </button>
        </div>
      )}
      <ValidationAlert
        title="Plan acceptance needs attention"
        messages={issues}
        onClose={() => setIssues([])}
      />
    </article>
  )
}

export function StoryboardRoom({
  project,
  onHome
}: {
  project: ProjectDetails
  onHome(): void
}): JSX.Element {
  const [imports, setImports] = useState<UpstreamImportRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<string>()

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setImports(await window.studio.upstream.listImports(project.manifest.id))
    } catch {
      setMessage('The story-package history could not be read safely.')
    }
  }, [project.manifest.id])

  useEffect(() => {
    let cancelled = false
    void window.studio.upstream
      .listImports(project.manifest.id)
      .then((items) => {
        if (!cancelled) setImports(items)
      })
      .catch(() => {
        if (!cancelled) setMessage('The story-package history could not be read safely.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [project.manifest.id])

  const chooseImport = async (): Promise<void> => {
    setImporting(true)
    setMessage('Checking the pinned source files and creating a long-form preview…')
    try {
      const result = await window.studio.upstream.chooseImport(project.manifest.id)
      if (result.ok) {
        setMessage(
          result.record.state === 'validation-failed'
            ? 'The package was copied safely, but validation failed. Review the failed file below.'
            : 'Validation passed. Review the long-form changes before accepting the plan.'
        )
        await refresh()
      } else {
        setMessage(result.error.message)
      }
    } catch {
      setMessage('The story package could not be checked safely. No active plan was changed.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="production-room">
      <button className="text-button back-link" onClick={onHome}>
        ← Production overview
      </button>
      <header className="page-heading storyboard-heading">
        <div>
          <p className="eyebrow">Storyboard and long-form plan · {project.manifest.code}</p>
          <h1>Turn validated story files into a production-shaped plan.</h1>
          <p>
            Choose one story-package folder containing an outline and screenplay. Character,
            visual-direction, and storyboard files are optional. Every file is checked locally, and
            unsupported generation instructions are kept as notes rather than executed.
          </p>
        </div>
        <button
          className="button button-primary button-large"
          disabled={importing}
          onClick={() => void chooseImport()}
        >
          {importing ? 'Checking story package…' : 'Import story-package folder'}
        </button>
      </header>
      <div className="room-assistant-row">
        <div>
          <strong>Need the board planned from scratch?</strong>
          <span>
            The LLM can create shots, staging, movement, dialogue, sound, and control ideas.
          </span>
        </div>
        <IdeaAssistant
          project={project}
          buttonLabel="Generate storyboard ideas"
          targets={[
            {
              id: 'shot-plan',
              label: 'Shot-by-shot storyboard plan',
              taskKind: 'plan_storyboard',
              instruction:
                'Create stable shot IDs and specify location, characters, framing, camera, action, emotion, dialogue or narration, sound, duration, transition, production method, and continuity anchors.'
            },
            {
              id: 'coverage',
              label: 'Scene coverage and edit rhythm',
              taskKind: 'plan_storyboard',
              instruction:
                'Recommend essential master, medium, close, reaction, insert, transition, and economy shots with reasons and pacing risks.'
            },
            {
              id: 'movement',
              label: 'Character and camera movement',
              taskKind: 'plan_motion',
              instruction:
                'Plan subject action, performance beats, camera motion, start/end states, duration, screen direction, and continuity locks for each shot.'
            },
            {
              id: 'sound',
              label: 'Dialogue, ambience, effects, and foley cues',
              taskKind: 'plan_foley',
              instruction:
                'Create time-addressable dialogue, ambience, effect, and foley cues while keeping speech and music separate.'
            },
            {
              id: 'controls',
              label: 'Pose, depth, mask, layer, and motion controls',
              taskKind: 'plan_advanced_controls',
              instruction:
                'For difficult shots, recommend the minimum useful control assets, why each is needed, and the source, scope, rights, and compatibility questions to resolve.'
            }
          ]}
        />
      </div>
      {message && (
        <div className="safety-feedback" role="status">
          {message}
        </div>
      )}
      {loading ? (
        <div className="settings-card backup-empty">Checking local story-package history…</div>
      ) : imports.length === 0 ? (
        <div className="settings-card backup-empty">
          No upstream story package has been imported. You can still build the story manually in the
          Story room.
        </div>
      ) : (
        <div className="import-preview-list">
          {imports.map((record) => (
            <ImportPreviewCard
              key={record.importId}
              record={record}
              onAccepted={refresh}
              onNotice={setMessage}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function ProductionReadinessStrip({
  workspace
}: {
  workspace: ProductionWorkspaceSummary
}): JSX.Element {
  const activeCanon = useMemo(
    () => workspace.canon.filter((item) => item.state === 'active'),
    [workspace.canon]
  )
  return (
    <div className="readiness-strip">
      <span>{activeCanon.length} active canon records</span>
      <span>
        {workspace.media.filter((item) => item.state === 'approved').length} approved media items
      </span>
      <span>{workspace.staleDependencyCount} stale dependencies</span>
      <span>${workspace.elapsedCloudUsageEstimateUsd.toFixed(2)} elapsed cloud estimate</span>
      <span>${workspace.actualSpendUsd.toFixed(2)} provider-reconciled spend</span>
    </div>
  )
}

function workflowStage(workflow: ProductionWorkflowSummary): string {
  if (workflow.jobKind.startsWith('qwen-image')) return 'Character and storyboard images'
  if (workflow.jobKind === 'qwen3-tts') return 'Voices and dialogue'
  if (workflow.jobKind === 'animatic') return 'Timed animatic'
  if (workflow.jobKind.startsWith('ltx') || workflow.jobKind === 'lip-sync')
    return 'Animation and lip-sync'
  if (workflow.jobKind === 'creative-qc') return 'Creative checks'
  if (workflow.jobKind === 'adaptation-train') return 'Project look adaptation'
  if (['timeline-render', 'caption-export', 'foley'].includes(workflow.jobKind))
    return 'Edit, sound, and captions'
  return 'Thumbnail and YouTube release package'
}

function workflowParameters(
  workflow: ProductionWorkflowSummary,
  instruction: string,
  referenceText: string,
  sourceAssets: MediaAssetView[],
  referenceBenchmarkFailed: boolean,
  adaptationRightsConfirmed: boolean,
  seed: number,
  gpuTypeId: string | null,
  priceTier: 'secure' | 'community' | null,
  outputKindOverride: MediaAssetKind | null
): Record<string, string | number | boolean | null> {
  const sourceManifest = JSON.stringify({
    direction: instruction,
    assets: sourceAssets.map((asset, index) => ({
      order: index + 1,
      assetId: asset.assetId,
      kind: asset.kind,
      label: asset.label,
      sha256: asset.sha256
    }))
  })
  const shared: Record<string, string | number | boolean | null> = {
    studioGpuTypeId: gpuTypeId,
    studioPriceTier: priceTier,
    studioContainerDiskInGb: 100,
    studioVolumeInGb: 150,
    studioOutputKind:
      outputKindOverride ??
      (workflow.jobKind === 'foley'
        ? 'effect'
        : workflow.jobKind === 'adaptation-train'
          ? 'adaptation-artifact'
          : workflow.outputKind === 'audio'
            ? 'voice-line'
            : workflow.outputKind === 'video'
              ? 'video-take'
              : workflow.outputKind === 'document'
                ? 'document'
                : workflow.jobKind === 'thumbnail-render'
                  ? 'thumbnail'
                  : 'character-board')
  }
  if (workflow.workflowId === 'qwen-image-character-board') {
    return { ...shared, prompt: instruction, negativePrompt: '', seed, width: 1536, height: 1024 }
  }
  if (workflow.workflowId === 'qwen-image-targeted-edit') {
    return { ...shared, ...targetedEditParameters(instruction, seed) }
  }
  if (workflow.workflowId === 'qwen-image-controlled-board') {
    return { ...shared, prompt: instruction, controlManifestJson: sourceManifest, seed }
  }
  if (workflow.workflowId === 'qwen3-tts-voice-design') {
    return {
      ...shared,
      text: 'Every light has a story, and tonight we listen.',
      language: 'English',
      voiceDescription: instruction,
      seed
    }
  }
  if (workflow.workflowId === 'qwen3-tts-line-book') {
    return {
      ...shared,
      lineBookJson: JSON.stringify(
        instruction
          .split('\n')
          .map((text) => text.trim())
          .filter(Boolean)
          .map((text, index) => ({ id: `line-${index + 1}`, text }))
      ),
      language: 'English',
      referenceText,
      seed
    }
  }
  if (workflow.workflowId.includes('lip-repair')) {
    return {
      ...shared,
      inferenceSteps: 20,
      guidanceScale: 1.5,
      seed,
      preserveApprovedAudio: true
    }
  }
  if (workflow.workflowId === 'ltx2-controlled-shot') {
    return {
      ...shared,
      motionPrompt: instruction,
      controlManifestJson: sourceManifest,
      durationSeconds: 5,
      seed
    }
  }
  if (workflow.workflowId.includes('audio-driven')) {
    return { ...shared, motionPrompt: instruction, preserveApprovedAudio: true, seed }
  }
  if (workflow.workflowId.startsWith('ltx2-')) {
    return { ...shared, motionPrompt: instruction, durationSeconds: 5, seed, framesPerSecond: 24 }
  }
  if (workflow.jobKind === 'creative-qc') {
    return { ...shared, checks: instruction, expectedDialogue: '' }
  }
  if (workflow.jobKind === 'foley') {
    return { ...shared, cueSheetJson: instruction, preserveDialogue: true, seed }
  }
  if (workflow.jobKind === 'adaptation-train') {
    return {
      ...shared,
      datasetManifestJson: sourceManifest,
      baseModel: 'Lightricks/LTX-2.5',
      triggerPhrase: `${seed}-project-style`,
      referenceBenchmarkFailed,
      rightsConfirmed: adaptationRightsConfirmed,
      seed
    }
  }
  if (workflow.jobKind === 'thumbnail-render') {
    return { ...shared, layoutJson: instruction, headline: instruction.slice(0, 120) }
  }
  if (workflow.jobKind === 'release-package') {
    return { ...shared, releaseManifestJson: instruction }
  }
  if (workflow.jobKind === 'caption-export') {
    return { ...shared, cuesJson: instruction, format: 'srt' }
  }
  if (workflow.jobKind === 'animatic') {
    return { ...shared, timelineJson: instruction, resolution: '1280x720' }
  }
  return { ...shared, timelineJson: instruction, profile: 'youtube-1080p' }
}

function retakeDirection(parameters: ProductionJobRecord['parameters']): string {
  const saved = [
    parameters.prompt,
    parameters.instruction,
    parameters.voiceDescription,
    parameters.motionPrompt,
    parameters.checks,
    parameters.headline
  ].find((value): value is string => typeof value === 'string' && value.trim().length >= 10)
  return saved ?? 'Describe the precise correction for this linked retake.'
}

async function makeIdempotencyKey(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, '0')).join('')
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

function JobCard({
  job,
  onChanged,
  onNotice
}: {
  job: ProductionJobRecord
  onChanged(): Promise<void>
  onNotice(message: string): void
}): JSX.Element {
  const [busy, setBusy] = useState(false)

  const reconcile = async (): Promise<void> => {
    setBusy(true)
    try {
      const result = await window.studio.production.reconcileJob(job.projectId, job.jobId)
      onNotice(
        result.ok
          ? (result.details.events.at(-1)?.message ?? 'Worker status refreshed.')
          : result.error.message
      )
      await onChanged()
    } catch {
      onNotice('The worker status could not be refreshed safely. No retry was started.')
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (): Promise<void> => {
    if (!window.confirm('Stop this job and terminate its rented worker if one exists?')) return
    setBusy(true)
    try {
      const result = await window.studio.production.cancelJob({
        projectId: job.projectId,
        jobId: job.jobId,
        reason: 'The creator explicitly stopped this production job from the Generate room.',
        confirmation: true
      })
      onNotice(
        result.ok ? 'Cancellation and worker shutdown were reconciled.' : result.error.message
      )
      await onChanged()
    } catch {
      onNotice('Shutdown could not be confirmed. Check RunPod before starting another worker.')
    } finally {
      setBusy(false)
    }
  }

  const canCancel = !['succeeded', 'failed', 'cancelled', 'terminated'].includes(job.state)
  const canReconcile =
    Boolean(job.workerLeaseId) &&
    !job.workerClosedAt &&
    !['succeeded', 'failed', 'cancelled', 'terminated'].includes(job.state)
  return (
    <article className="job-card">
      <div>
        <span className={`stage-state ${job.state}`}>{job.state.replaceAll('-', ' ')}</span>
        <h3>{job.label}</h3>
        <p>Maximum approved {formatUsd(job.approvedMaximumUsd ?? 0)}</p>
        <small>Elapsed cloud estimate: {formatUsd(job.elapsedCostEstimateUsd)}</small>
        <small>Provider-reconciled spend: {formatUsd(job.actualCostUsd)}</small>
        {job.lastErrorCode && (
          <div className="field-warning">
            This job needs attention. Refresh its worker before starting anything else.
          </div>
        )}
      </div>
      <div className="job-actions">
        {canReconcile && (
          <button
            className="button button-secondary"
            disabled={busy}
            onClick={() => void reconcile()}
          >
            Refresh worker
          </button>
        )}
        {canCancel && (
          <button className="button button-danger" disabled={busy} onClick={() => void cancel()}>
            Stop and shut down
          </button>
        )}
      </div>
    </article>
  )
}

export function GenerateRoom({
  project,
  cloudStatus,
  onHome,
  onSettings,
  retake,
  quickCreate,
  onRetakePlanned
}: {
  project: ProjectDetails
  cloudStatus?: CloudConnectionStatus
  onHome(): void
  onSettings(): void
  retake?: RetakeContext
  quickCreate?: QuickCreateIntent
  onRetakePlanned?(): void
}): JSX.Element {
  const [workflows, setWorkflows] = useState<ProductionWorkflowSummary[]>([])
  const [workspace, setWorkspace] = useState<ProductionWorkspaceSummary>()
  const [selectedId, setSelectedId] = useState('')
  const [gpuTypeId, setGpuTypeId] = useState('')
  const [priceTier, setPriceTier] = useState<'secure' | 'community'>('secure')
  const [label, setLabel] = useState('')
  const [instruction, setInstruction] = useState('')
  const [referenceText, setReferenceText] = useState('')
  const [referenceBenchmarkFailed, setReferenceBenchmarkFailed] = useState(false)
  const [adaptationRightsConfirmed, setAdaptationRightsConfirmed] = useState(false)
  const [adaptationDatasetLabel, setAdaptationDatasetLabel] = useState(
    'Project-only adaptation dataset'
  )
  const [adaptationPurpose, setAdaptationPurpose] = useState('')
  const [adaptationHumanReview, setAdaptationHumanReview] = useState(false)
  const [adaptationSampleOrder, setAdaptationSampleOrder] = useState<string[]>([])
  const [adaptationSampleDrafts, setAdaptationSampleDrafts] = useState<
    Record<string, AdaptationSampleDraft>
  >({})
  const [seed, setSeed] = useState(12345)
  const [selectedAssets, setSelectedAssets] = useState<string[]>([])
  const [estimate, setEstimate] = useState<CostEstimate>()
  const [plannedJob, setPlannedJob] = useState<ProductionJobRecord>()
  const [costConfirmed, setCostConfirmed] = useState(false)
  const [startConfirmed, setStartConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string>()
  const [retakeLineage, setRetakeLineage] = useState<RetakeContext | undefined>(retake)
  const initialRetake = useRef(retake)
  const initialQuickCreate = useRef(quickCreate)

  const refresh = useCallback(async (): Promise<void> => {
    const [catalog, production] = await Promise.all([
      window.studio.production.listWorkflows(),
      window.studio.production.getWorkspace(project.manifest.id)
    ])
    setWorkflows(catalog)
    setWorkspace(production)
    setSelectedId(
      (current) => current || catalog.find((workflow) => workflow.requiresGpu)?.workflowId || ''
    )
  }, [project.manifest.id])

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      window.studio.production.listWorkflows(),
      window.studio.production.getWorkspace(project.manifest.id)
    ])
      .then(([catalog, production]) => {
        if (cancelled) return
        const requestedRetake = initialRetake.current
        const requestedQuickCreate = initialQuickCreate.current
        setWorkflows(catalog)
        setWorkspace(production)
        const initial = requestedRetake
          ? catalog.find(
              (workflow) =>
                workflow.workflowId === requestedRetake.job.workflowId &&
                workflow.version === requestedRetake.job.workflowVersion
            )
          : requestedQuickCreate?.workflowId
            ? catalog.find((workflow) => workflow.workflowId === requestedQuickCreate.workflowId)
            : catalog.find((workflow) => workflow.requiresGpu)
        setSelectedId(initial?.workflowId ?? '')
        if (requestedRetake && initial) {
          setLabel(`${requestedRetake.job.label} retake`)
          setInstruction(retakeDirection(requestedRetake.job.parameters))
          setReferenceText(
            typeof requestedRetake.job.parameters.referenceText === 'string'
              ? requestedRetake.job.parameters.referenceText
              : ''
          )
          setSeed(
            typeof requestedRetake.job.parameters.seed === 'number'
              ? Math.trunc(requestedRetake.job.parameters.seed) + 1
              : 12346
          )
          setSelectedAssets(requestedRetake.job.inputAssetIds)
          setMessage(
            'Linked retake ready. Change the direction or variation, then review a fresh estimate before any worker can start.'
          )
        } else if (requestedQuickCreate && initial) {
          setLabel(requestedQuickCreate.label)
          setInstruction(requestedQuickCreate.instruction)
          setMessage(
            `Quick ${requestedQuickCreate.mode} setup is prepared. Review the method and approved references, then request an estimate. No GPU has started.`
          )
        }
        const compatible = cloudStatus?.gpuOptions.find(
          (gpu) =>
            gpu.memoryGb >= (initial?.minimumVramGb ?? Number.POSITIVE_INFINITY) &&
            (!requestedRetake ||
              typeof requestedRetake.job.parameters.studioGpuTypeId !== 'string' ||
              gpu.id === requestedRetake.job.parameters.studioGpuTypeId)
        )
        const fallback = cloudStatus?.gpuOptions.find(
          (gpu) => gpu.memoryGb >= (initial?.minimumVramGb ?? Number.POSITIVE_INFINITY)
        )
        setGpuTypeId(compatible?.id ?? fallback?.id ?? '')
        if (requestedRetake?.job.parameters.studioPriceTier === 'community') {
          setPriceTier('community')
        }
      })
      .catch(() => {
        if (!cancelled) setMessage('The production workflow catalogue could not be opened safely.')
      })
    return () => {
      cancelled = true
    }
  }, [project.manifest.id, cloudStatus?.gpuOptions])

  const selected = workflows.find((workflow) => workflow.workflowId === selectedId)
  const quickOutputKind = quickCreate?.mode === 'composition' ? 'image' : quickCreate?.mode
  const selectableWorkflows = workflows.filter(
    (workflow) =>
      workflow.requiresGpu &&
      (!quickCreate || quickOutputKind === 'stitch' || workflow.outputKind === quickOutputKind)
  )
  const selectWorkflow = (workflowId: string): void => {
    const next = workflows.find((workflow) => workflow.workflowId === workflowId)
    if (retakeLineage && workflowId !== retakeLineage.job.workflowId) {
      setRetakeLineage(undefined)
      setMessage('The linked retake was cleared because a different operation was selected.')
    }
    setSelectedId(workflowId)
    setEstimate(undefined)
    setPlannedJob(undefined)
    setCostConfirmed(false)
    setStartConfirmed(false)
    setSelectedAssets([])
    setReferenceBenchmarkFailed(false)
    setAdaptationRightsConfirmed(false)
    if (!next?.requiresGpu) {
      setGpuTypeId('')
      return
    }
    const compatible = cloudStatus?.gpuOptions.find((gpu) => gpu.memoryGb >= next.minimumVramGb)
    setGpuTypeId(compatible?.id ?? '')
  }

  const estimateWork = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!selected) return
    if (label.trim().length < 3 || instruction.trim().length < 10) {
      setMessage(
        'Complete every required field. The production direction needs at least 10 characters.'
      )
      return
    }
    if (selected.requiresGpu && !gpuTypeId) {
      setMessage('Choose a compatible GPU. Connect or refresh RunPod in Settings if none is shown.')
      return
    }
    const selectedMedia = selectedAssets
      .map((assetId) => workspace?.media.find((asset) => asset.assetId === assetId))
      .filter((asset): asset is MediaAssetView => Boolean(asset))
    if (
      selected.workflowId === 'qwen3-tts-line-book' &&
      (selectedMedia.length !== 1 || !selectedMedia[0]?.mimeType.startsWith('audio/'))
    ) {
      setMessage('Choose exactly one approved audio reference for the recurring voice line book.')
      return
    }
    if (selected.workflowId === 'qwen3-tts-line-book' && !referenceText.trim()) {
      setMessage('Enter the exact words spoken in the approved voice reference.')
      return
    }
    const targetedEditError =
      selected.workflowId === 'qwen-image-targeted-edit'
        ? targetedEditInputError(selectedMedia)
        : null
    if (targetedEditError) {
      setMessage(targetedEditError)
      return
    }
    if (
      ['ltx2-image-to-video-draft', 'ltx2-image-to-video-final'].includes(selected.workflowId) &&
      (selectedMedia.length !== 1 || !selectedMedia[0]?.mimeType.startsWith('image/'))
    ) {
      setMessage('Choose exactly one approved starting image for this LTX motion take.')
      return
    }
    if (
      selected.workflowId === 'ltx2-audio-driven-dialogue' &&
      (selectedMedia.length !== 2 ||
        !(
          selectedMedia[0]?.mimeType.startsWith('image/') ||
          selectedMedia[0]?.mimeType.startsWith('video/')
        ) ||
        !selectedMedia[1]?.mimeType.startsWith('audio/'))
    ) {
      setMessage(
        'For dialogue motion, select the approved visual first and approved dialogue audio second.'
      )
      return
    }
    if (
      selected.workflowId === 'latentsync-lip-repair' &&
      (selectedMedia.length !== 2 ||
        !selectedMedia[0]?.mimeType.startsWith('video/') ||
        !selectedMedia[1]?.mimeType.startsWith('audio/'))
    ) {
      setMessage(
        'For lip repair, select the approved video first and its approved dialogue audio second.'
      )
      return
    }
    const controlKinds = new Set([
      'reference-image',
      'start-frame-control',
      'end-frame-control',
      'pose-control',
      'depth-control',
      'edge-control',
      'segmentation-control',
      'region-mask',
      'motion-track',
      'reference-clip',
      'foreground-layer',
      'subject-layer',
      'background-layer'
    ])
    if (
      selected.workflowId === 'qwen-image-controlled-board' &&
      (selectedMedia.length !== 1 ||
        !selectedMedia[0]?.mimeType.startsWith('image/') ||
        !controlKinds.has(selectedMedia[0]?.kind))
    ) {
      setMessage(
        'Select exactly one approved image labelled as a control or reference. Ordinary output images cannot be silently treated as controls.'
      )
      return
    }
    if (
      selected.workflowId === 'ltx2-controlled-shot' &&
      (selectedMedia.length !== 1 ||
        !selectedMedia[0]?.mimeType.startsWith('image/') ||
        selectedMedia[0]?.kind !== 'reference-image')
    ) {
      setMessage(
        'Select exactly one approved reference-sheet image. This profile does not substitute pose, depth, edge, or motion controls.'
      )
      return
    }
    if (
      selected.workflowId === 'ltx25-project-lora-adaptation' &&
      (selectedMedia.length < 5 ||
        selectedMedia.length > 101 ||
        selectedMedia[0]?.kind !== 'adaptation-dataset' ||
        selectedMedia
          .slice(1)
          .some(
            (asset) => !asset.mimeType.startsWith('image/') && !asset.mimeType.startsWith('video/')
          ))
    ) {
      setMessage(
        'Select the approved rights manifest first, followed by 4 to 100 approved image or video samples in the manifest order.'
      )
      return
    }
    if (
      selected.workflowId === 'ltx25-project-lora-adaptation' &&
      (!referenceBenchmarkFailed || !adaptationRightsConfirmed)
    ) {
      setMessage(
        'Confirm both the failed reference-only benchmark and the dataset rights review before estimating adaptation.'
      )
      return
    }
    setBusy(true)
    try {
      const result = await window.studio.production.estimateWorkflow({
        projectId: project.manifest.id,
        workflowId: selected.workflowId,
        workflowVersion: selected.version,
        gpuTypeId: selected.requiresGpu ? gpuTypeId : null,
        priceTier: selected.requiresGpu ? priceTier : null,
        gpuCount: selected.requiresGpu ? 1 : 0
      })
      if (!result.ok) {
        setMessage(result.error.message)
        return
      }
      setEstimate(result.estimate)
      setPlannedJob(undefined)
      setCostConfirmed(false)
      setMessage('Estimate ready. Nothing has been rented or queued.')
    } catch {
      setMessage('The estimate could not be prepared. No GPU was started.')
    } finally {
      setBusy(false)
    }
  }

  const plan = async (): Promise<void> => {
    if (!selected || !estimate) return
    if (!costConfirmed) {
      setMessage('Tick the maximum-cost confirmation before creating the approved job record.')
      return
    }
    setBusy(true)
    try {
      const parameters = workflowParameters(
        selected,
        instruction.trim(),
        referenceText.trim(),
        selectedAssets
          .map((assetId) => workspace?.media.find((asset) => asset.assetId === assetId))
          .filter((asset): asset is MediaAssetView => Boolean(asset)),
        referenceBenchmarkFailed,
        adaptationRightsConfirmed,
        seed,
        selected.requiresGpu ? gpuTypeId : null,
        selected.requiresGpu ? priceTier : null,
        quickCreate?.outputKind ?? null
      )
      const canonIds =
        workspace?.canon
          .filter((canon) => canon.state === 'active')
          .map((canon) => canon.canonId) ?? []
      const identity = {
        projectId: project.manifest.id,
        workflowId: selected.workflowId,
        workflowVersion: selected.version,
        label: label.trim(),
        parameters,
        selectedAssets,
        canonIds,
        parentJobId: retakeLineage?.job.jobId ?? null,
        retakeOfAssetId: retakeLineage?.asset.assetId ?? null,
        estimateId: estimate.estimateId
      }
      const result = await window.studio.production.planJob({
        projectId: project.manifest.id,
        kind: selected.jobKind,
        label: label.trim(),
        workflowId: selected.workflowId,
        workflowVersion: selected.version,
        inputAssetIds: selectedAssets,
        canonIds,
        parentJobId: retakeLineage?.job.jobId ?? null,
        retakeOfAssetId: retakeLineage?.asset.assetId ?? null,
        parameters,
        idempotencyKey: await makeIdempotencyKey(identity),
        estimate
      })
      if (!result.ok) {
        setMessage(result.error.message)
        return
      }
      const approval = await window.studio.production.approveJob({
        projectId: project.manifest.id,
        jobId: result.details.job.jobId,
        expectedEstimateId: estimate.estimateId,
        acceptedMaximumUsd: estimate.maximumTotalUsd,
        confirmation: true
      })
      if (!approval.ok) {
        setMessage(approval.error.message)
        return
      }
      setPlannedJob(approval.details.job)
      if (retakeLineage) {
        setRetakeLineage(undefined)
        onRetakePlanned?.()
      }
      setMessage(
        'The exact maximum cost is approved. No GPU has started; use the separate start confirmation.'
      )
      await refresh()
    } catch {
      setMessage('The job approval could not be saved safely. No GPU was started.')
    } finally {
      setBusy(false)
    }
  }

  const start = async (): Promise<void> => {
    if (!plannedJob || !estimate || !startConfirmed) {
      setMessage('Tick the separate worker-start confirmation first.')
      return
    }
    if (
      !window.confirm(
        `Start one rented GPU with a hard maximum of ${formatUsd(estimate.maximumTotalUsd)}?`
      )
    )
      return
    setBusy(true)
    try {
      const result = await window.studio.production.queueJob({
        projectId: project.manifest.id,
        jobId: plannedJob.jobId,
        expectedEstimateId: estimate.estimateId,
        confirmation: true
      })
      setMessage(
        result.ok
          ? (result.details.events.at(-1)?.message ?? 'Worker lease queued.')
          : result.error.message
      )
      await refresh()
    } catch {
      setMessage('The worker start could not be confirmed. No automatic retry was made.')
    } finally {
      setBusy(false)
    }
  }

  const approvedMedia = workspace?.media.filter((asset) => asset.state === 'approved') ?? []
  const adaptationEligibleMedia = approvedMedia.filter(
    (asset) => asset.mimeType.startsWith('image/') || asset.mimeType.startsWith('video/')
  )
  const selectedGpu = cloudStatus?.gpuOptions.find((gpu) => gpu.id === gpuTypeId)

  const setAdaptationSampleSelected = (assetId: string, selected: boolean): void => {
    setAdaptationSampleOrder((current) =>
      selected
        ? current.includes(assetId)
          ? current
          : [...current, assetId]
        : current.filter((id) => id !== assetId)
    )
    if (selected) {
      setAdaptationSampleDrafts((current) => ({
        ...current,
        [assetId]: current[assetId] ?? {
          caption: '',
          rightsBasis: '',
          licenseReference: '',
          consentConfirmed: false
        }
      }))
    }
  }

  const updateAdaptationSample = (
    assetId: string,
    update: Partial<AdaptationSampleDraft>
  ): void => {
    setAdaptationSampleDrafts((current) => {
      const prior = current[assetId]
      return {
        ...current,
        [assetId]: {
          caption: update.caption ?? prior?.caption ?? '',
          rightsBasis: update.rightsBasis ?? prior?.rightsBasis ?? '',
          licenseReference: update.licenseReference ?? prior?.licenseReference ?? '',
          consentConfirmed: update.consentConfirmed ?? prior?.consentConfirmed ?? false
        }
      }
    })
  }

  const createAdaptationDataset = async (): Promise<void> => {
    if (adaptationDatasetLabel.trim().length < 3 || adaptationPurpose.trim().length < 10) {
      setMessage('Name the dataset and explain its project-only purpose in at least 10 characters.')
      return
    }
    if (adaptationSampleOrder.length < 4 || adaptationSampleOrder.length > 100) {
      setMessage('Choose between 4 and 100 approved image or video samples.')
      return
    }
    if (!adaptationHumanReview) {
      setMessage('Confirm the human rights and provenance review before creating the manifest.')
      return
    }
    const samples = adaptationSampleOrder.map((assetId) => ({
      assetId,
      ...(adaptationSampleDrafts[assetId] ?? {
        caption: '',
        rightsBasis: '' as const,
        licenseReference: '',
        consentConfirmed: false
      })
    }))
    const incomplete = samples.find(
      (sample) =>
        sample.caption.trim().length < 10 ||
        !sample.rightsBasis ||
        !sample.consentConfirmed ||
        (sample.rightsBasis === 'licensed-for-model-training' &&
          sample.licenseReference.trim().length < 3)
    )
    if (incomplete) {
      setMessage(
        'Every selected sample needs a useful caption, an explicit rights basis, and a consent decision. Licensed samples also need a permission reference.'
      )
      return
    }
    setBusy(true)
    try {
      const result = await window.studio.production.createAdaptationDataset({
        projectId: project.manifest.id,
        label: adaptationDatasetLabel.trim(),
        purpose: adaptationPurpose.trim(),
        projectScopeOnly: true,
        humanRightsReviewConfirmed: true,
        trainingSteps: 400,
        learningRate: 0.0001,
        resolutionBuckets: ['576x576x1', '768x448x49'],
        samples: samples.map((sample) => ({
          assetId: sample.assetId,
          caption: sample.caption.trim(),
          rightsBasis: sample.rightsBasis as 'owned-original' | 'licensed-for-model-training',
          licenseReference:
            sample.rightsBasis === 'licensed-for-model-training'
              ? sample.licenseReference.trim()
              : null,
          consentConfirmed: true
        }))
      })
      if (!result.ok) {
        setMessage(result.error.message)
        return
      }
      await refresh()
      setMessage(
        'The project-only rights manifest was created locally. Review and approve it in Media Review before using it for an estimate.'
      )
    } catch {
      setMessage(
        'The rights manifest could not be created safely. Approved samples were unchanged.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="production-room generate-room">
      <button className="text-button back-link" onClick={onHome}>
        ← {quickCreate ? 'One-off asset tool' : 'Production overview'}
      </button>
      <header className="page-heading">
        <div>
          <p className="eyebrow">
            {quickCreate ? `Quick ${quickCreate.mode}` : 'Prepared generation'} ·{' '}
            {project.manifest.code}
          </p>
          <h1>
            {quickCreate
              ? `Prepare this ${quickCreate.mode} without starting a GPU.`
              : 'See every stage, input, limit, and lock before spending.'}
          </h1>
          <p>
            {quickCreate
              ? 'Your name and brief are ready. Choose approved references, review the production method, and request an estimate before deciding whether to continue.'
              : 'One job uses one GPU. Two or three GPUs mean separate compatible jobs running at the same time under the saved combined limit.'}
          </p>
        </div>
        {cloudStatus?.connectionState !== 'connected' && (
          <button className="button button-primary" onClick={onSettings}>
            Connect RunPod
          </button>
        )}
      </header>

      {!quickCreate && (
        <div className="room-assistant-row">
          <div>
            <strong>Turn story intent into a production prompt</strong>
            <span>
              Generate names, visual prompts, voice direction, motion, controls, or foley plans.
            </span>
          </div>
          <IdeaAssistant
            project={project}
            buttonLabel="Generate production ideas"
            targets={[
              {
                id: 'job-name',
                label: 'Clear job name',
                taskKind: 'design_visual_generation',
                instruction:
                  'Return one short, descriptive production-job name that identifies the subject, purpose, and shot or scene.',
                currentValue: label,
                onUse: setLabel
              },
              {
                id: 'visual-prompt',
                label: 'Image or board prompt',
                taskKind: 'design_visual_generation',
                instruction:
                  'Write a paste-ready visual prompt separating identity, rendering style, composition, expression/action, lighting, environment, continuity anchors, and things to avoid.',
                currentValue: instruction,
                onUse: setInstruction
              },
              {
                id: 'voice-direction',
                label: 'Voice design or dialogue delivery',
                taskKind: 'design_voice_performance',
                instruction:
                  'Write paste-ready voice or performance direction with original vocal qualities, speaking rhythm, emotion, pronunciation, and a useful calibration line.',
                currentValue: instruction,
                onUse: setInstruction
              },
              {
                id: 'motion-prompt',
                label: 'Movement and camera direction',
                taskKind: 'plan_motion',
                instruction:
                  'Write paste-ready movement and camera direction with performance beats, start/end state, shot duration, continuity constraints, and what must remain still.',
                currentValue: instruction,
                onUse: setInstruction
              },
              {
                id: 'control-plan',
                label: 'Advanced control plan',
                taskKind: 'plan_advanced_controls',
                instruction:
                  'Recommend the minimum pose, depth, edge, segmentation, mask, layer, start/end frame, motion-track, or reference controls needed and state why each matters.',
                currentValue: instruction,
                onUse: setInstruction
              },
              {
                id: 'foley-plan',
                label: 'Ambience, effects, and foley plan',
                taskKind: 'plan_foley',
                instruction:
                  'Create paste-ready, time-addressable ambience, effects, and foley direction. Preserve dialogue and music as separate layers.',
                currentValue: instruction,
                onUse: setInstruction
              },
              {
                id: 'reference-transcript',
                label: 'Reference-voice transcript guidance',
                taskKind: 'design_voice_performance',
                instruction:
                  'Explain how to transcribe the selected reference exactly and what pronunciation details to verify. Do not invent words that cannot be heard.',
                currentValue: referenceText,
                humanOnly: true
              }
            ]}
          />
        </div>
      )}

      {message && (
        <div className="safety-feedback" role="status">
          {message}
        </div>
      )}

      {retakeLineage && (
        <aside className="retake-banner" aria-label="Linked retake">
          <div>
            <strong>Linked retake · {retakeLineage.asset.label}</strong>
            <span>
              The earlier take remains in history. This child must use changed settings, receive a
              fresh estimate, and pass its own review.
            </span>
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setRetakeLineage(undefined)
              setMessage('The linked retake was cleared. No job or worker was created.')
            }}
          >
            Clear retake
          </button>
        </aside>
      )}

      {!quickCreate && (
        <section className="workflow-stage-grid" aria-label="Full production stages">
          {[...new Set(workflows.map(workflowStage))].map((stage) => {
            const stageWorkflows = workflows.filter((workflow) => workflowStage(workflow) === stage)
            const ready = stageWorkflows.filter((workflow) => workflow.readyForPaidWork).length
            return (
              <article key={stage}>
                <span
                  className={`stage-state ${ready === stageWorkflows.length ? 'ready' : 'locked'}`}
                >
                  {ready}/{stageWorkflows.length} qualified
                </span>
                <h3>{stage}</h3>
                <p>{stageWorkflows.map((workflow) => workflow.label).join(' · ')}</p>
              </article>
            )
          })}
        </section>
      )}

      <form className="generation-form" onSubmit={(event) => void estimateWork(event)}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">{quickCreate ? 'Prepared one-off asset' : 'Prepare one job'}</p>
            <h2>
              {quickCreate
                ? `Review the ${quickCreate.mode} method`
                : 'Choose the production operation'}
            </h2>
          </div>
          <span className="status-chip local">Estimate first</span>
        </div>
        <fieldset className="operation-selector">
          <legend>
            {quickCreate
              ? `Choose ${quickCreate.mode === 'image' || quickCreate.mode === 'audio' ? 'an' : 'a'} ${quickCreate.mode} method`
              : 'Choose an operation'}{' '}
            <RequiredMark />
          </legend>
          <div className="operation-card-grid" role="radiogroup" aria-label="Generation operation">
            {selectableWorkflows.map((workflow) => (
              <label
                className={`operation-card ${selectedId === workflow.workflowId ? 'selected' : ''}`}
                key={`${workflow.workflowId}-${workflow.version}`}
              >
                <input
                  type="radio"
                  name="generation-operation"
                  value={workflow.workflowId}
                  checked={selectedId === workflow.workflowId}
                  onChange={() => selectWorkflow(workflow.workflowId)}
                />
                <span>
                  <strong>{workflow.label}</strong>
                  <small>{workflowStage(workflow)}</small>
                  <small
                    className={workflow.readyForPaidWork ? 'positive-status' : 'field-warning'}
                  >
                    {workflow.readyForPaidWork
                      ? 'Ready for paid generation'
                      : 'Still needs production proof'}
                  </small>
                </span>
              </label>
            ))}
          </div>
          <small>
            Local timelines, captions, thumbnails, and release packages are completed in Edit &amp;
            Export without renting a GPU.
          </small>
        </fieldset>
        {selected && (
          <div
            className={`workflow-lock-summary ${selected.readyForPaidWork ? 'ready' : 'locked'}`}
          >
            <strong>
              {selected.readyForPaidWork ? 'Production qualified' : 'Paid start remains locked'}
            </strong>
            <span>
              Needs {selected.minimumVramGb} GB graphics memory · expected{' '}
              {selected.expectedRuntimeMinutes} minutes
            </span>
            {selected.blockers.map((blocker) => (
              <small key={blocker}>• {blocker}</small>
            ))}
          </div>
        )}
        <label>
          Job name <RequiredMark />
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            minLength={3}
            maxLength={240}
            required
            placeholder="Ayo expression board — scene 4"
          />
          <TextRequirement
            id="generation-job-name-guidance"
            value={label}
            minimum={3}
            maximum={240}
          />
        </label>
        <label>
          {selected?.workflowId === 'qwen3-tts-line-book'
            ? 'Dialogue lines — one line per row'
            : 'Creative direction or production data'}{' '}
          <RequiredMark />
          <textarea
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            minLength={10}
            maxLength={4000}
            required
            rows={5}
            placeholder={
              selected?.workflowId === 'qwen3-tts-line-book'
                ? 'The eastern lantern is awake.\nTell the harbour master we are ready.'
                : 'Describe the exact identity, voice, movement, correction, timing, or package decision for this job.'
            }
          />
          <TextRequirement
            id="generation-direction-guidance"
            value={instruction}
            minimum={10}
            maximum={4000}
          />
        </label>
        {selected?.workflowId === 'qwen3-tts-line-book' && (
          <label>
            Exact words in the approved voice reference <RequiredMark />
            <textarea
              value={referenceText}
              onChange={(event) => setReferenceText(event.target.value)}
              minLength={1}
              maxLength={1200}
              required
              rows={3}
              placeholder="Type exactly what the speaker says in the selected reference audio."
            />
            <TextRequirement
              id="generation-reference-text-guidance"
              value={referenceText}
              minimum={1}
              maximum={1200}
            />
          </label>
        )}
        {selected?.workflowId === 'ltx25-project-lora-adaptation' && (
          <section className="adaptation-builder" aria-labelledby="adaptation-builder-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Project-only learning</p>
                <h2 id="adaptation-builder-title">Prepare the rights-reviewed sample set</h2>
                <p>
                  Choose 4–100 approved images or videos in training order. The studio records the
                  exact file checks automatically and uses reviewed safe training defaults.
                </p>
              </div>
              <span className="status-chip local">
                {adaptationSampleOrder.length} sample
                {adaptationSampleOrder.length === 1 ? '' : 's'} selected
              </span>
            </div>
            <div className="form-grid two-column">
              <label>
                Dataset name <RequiredMark />
                <input
                  value={adaptationDatasetLabel}
                  minLength={3}
                  maxLength={240}
                  onChange={(event) => setAdaptationDatasetLabel(event.target.value)}
                />
                <TextRequirement
                  id="adaptation-dataset-label-guidance"
                  value={adaptationDatasetLabel}
                  minimum={3}
                  maximum={240}
                />
              </label>
              <label>
                Why this adaptation is needed <RequiredMark />
                <textarea
                  value={adaptationPurpose}
                  minLength={10}
                  maxLength={500}
                  rows={3}
                  onChange={(event) => setAdaptationPurpose(event.target.value)}
                  placeholder="Example: Keep the approved lead character consistent in this production after the reference-only proof failed."
                />
                <TextRequirement
                  id="adaptation-purpose-guidance"
                  value={adaptationPurpose}
                  minimum={10}
                  maximum={500}
                />
              </label>
            </div>
            {adaptationEligibleMedia.length === 0 ? (
              <div className="settings-card backup-empty">
                No approved image or video samples are available. Import and approve the
                rights-cleared source material in Media Review first.
              </div>
            ) : (
              <div className="adaptation-sample-list">
                {adaptationEligibleMedia.map((asset) => {
                  const order = adaptationSampleOrder.indexOf(asset.assetId)
                  const checked = order >= 0
                  const draft = adaptationSampleDrafts[asset.assetId] ?? {
                    caption: '',
                    rightsBasis: '' as const,
                    licenseReference: '',
                    consentConfirmed: false
                  }
                  return (
                    <article
                      className={checked ? 'adaptation-sample selected' : 'adaptation-sample'}
                      key={asset.assetId}
                    >
                      <label className="checkbox-row adaptation-sample-choice">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setAdaptationSampleSelected(asset.assetId, event.target.checked)
                          }
                        />
                        <span>
                          <strong>
                            {checked ? `${order + 1}. ` : ''}
                            {asset.label}
                          </strong>
                          <small>
                            {asset.mimeType.startsWith('video/')
                              ? 'Approved video sample'
                              : 'Approved image sample'}
                          </small>
                        </span>
                      </label>
                      {checked && (
                        <div className="adaptation-sample-fields">
                          <label>
                            What this sample should teach <RequiredMark />
                            <textarea
                              rows={2}
                              minLength={10}
                              maxLength={1500}
                              value={draft.caption}
                              onChange={(event) =>
                                updateAdaptationSample(asset.assetId, {
                                  caption: event.target.value
                                })
                              }
                              placeholder="Describe the approved identity, clothing, expression, composition, or style shown here."
                            />
                            <TextRequirement
                              id={`adaptation-caption-${asset.assetId}`}
                              value={draft.caption}
                              minimum={10}
                              maximum={1500}
                            />
                          </label>
                          <label>
                            Training rights <RequiredMark />
                            <select
                              value={draft.rightsBasis}
                              onChange={(event) =>
                                updateAdaptationSample(asset.assetId, {
                                  rightsBasis: event.target
                                    .value as AdaptationSampleDraft['rightsBasis'],
                                  licenseReference:
                                    event.target.value === 'owned-original'
                                      ? ''
                                      : draft.licenseReference
                                })
                              }
                            >
                              <option value="">Choose after review</option>
                              <option value="owned-original">Owned original material</option>
                              <option value="licensed-for-model-training">
                                Licensed for model training
                              </option>
                            </select>
                          </label>
                          {draft.rightsBasis === 'licensed-for-model-training' && (
                            <label>
                              License or permission reference <RequiredMark />
                              <input
                                value={draft.licenseReference}
                                minLength={3}
                                maxLength={300}
                                onChange={(event) =>
                                  updateAdaptationSample(asset.assetId, {
                                    licenseReference: event.target.value
                                  })
                                }
                                placeholder="Agreement, receipt, or permission record"
                              />
                              <TextRequirement
                                id={`adaptation-license-${asset.assetId}`}
                                value={draft.licenseReference}
                                minimum={3}
                                maximum={300}
                              />
                            </label>
                          )}
                          <label className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={draft.consentConfirmed}
                              onChange={(event) =>
                                updateAdaptationSample(asset.assetId, {
                                  consentConfirmed: event.target.checked
                                })
                              }
                            />
                            <span>
                              I confirmed any required person or contributor consent for training.{' '}
                              <RequiredMark />
                            </span>
                          </label>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
            <label className="checkbox-row strong-confirmation">
              <input
                type="checkbox"
                checked={adaptationHumanReview}
                onChange={(event) => setAdaptationHumanReview(event.target.checked)}
              />
              <span>
                I reviewed every selected sample, its provenance, its rights, its consent, and the
                project-only scope. <RequiredMark />
              </span>
            </label>
            <button
              className="button button-secondary"
              type="button"
              disabled={busy || adaptationEligibleMedia.length < 4}
              onClick={() => void createAdaptationDataset()}
            >
              Create rights-reviewed dataset for approval
            </button>
            <div className="adaptation-estimate-confirmations">
              <h3>Before estimating training</h3>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={referenceBenchmarkFailed}
                  onChange={(event) => setReferenceBenchmarkFailed(event.target.checked)}
                />
                <span>
                  I compared the reference-only workflow first and recorded that it did not meet the
                  approved benchmark. <RequiredMark />
                </span>
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={adaptationRightsConfirmed}
                  onChange={(event) => setAdaptationRightsConfirmed(event.target.checked)}
                />
                <span>
                  I rechecked the approved dataset manifest and project-only scope for this exact
                  job. <RequiredMark />
                </span>
              </label>
              <small>
                These confirmations only permit an estimate. Paid start remains blocked until the
                exact trainer, models, GPU, and unchanged comparison fixtures pass qualification.
              </small>
            </div>
          </section>
        )}
        {selected?.requiresGpu && (
          <div className="gpu-picker">
            <div className="form-grid two-column">
              <label>
                Price tier <RequiredMark />
                <select
                  value={priceTier}
                  onChange={(event) => setPriceTier(event.target.value as 'secure' | 'community')}
                >
                  <option value="secure">
                    Secure cloud ·{' '}
                    {selectedGpu?.secureHourlyUsd == null
                      ? 'unavailable'
                      : `${formatUsd(selectedGpu.secureHourlyUsd)}/hr`}
                  </option>
                  <option value="community">
                    Community cloud ·{' '}
                    {selectedGpu?.communityHourlyUsd == null
                      ? 'unavailable'
                      : `${formatUsd(selectedGpu.communityHourlyUsd)}/hr`}
                  </option>
                </select>
              </label>
            </div>
            <fieldset>
              <legend>
                Choose a cloud computer <RequiredMark />
              </legend>
              <div className="gpu-card-grid">
                {cloudStatus?.gpuOptions.map((gpu) => {
                  const hourlyPrice =
                    priceTier === 'secure' ? gpu.secureHourlyUsd : gpu.communityHourlyUsd
                  const compatible = gpu.memoryGb >= selected.minimumVramGb && hourlyPrice !== null
                  const expectedCost =
                    hourlyPrice === null
                      ? null
                      : (hourlyPrice * selected.expectedRuntimeMinutes) / 60
                  const maximumCost =
                    hourlyPrice === null
                      ? null
                      : (hourlyPrice * selected.maximumRuntimeMinutes) / 60
                  return (
                    <button
                      className={`gpu-option-card ${gpuTypeId === gpu.id ? 'selected' : ''}`}
                      disabled={!compatible}
                      key={gpu.id}
                      onClick={() => setGpuTypeId(gpu.id)}
                      type="button"
                    >
                      <span>
                        <strong>{gpu.name}</strong>
                        <small>{gpu.memoryGb} GB graphics memory</small>
                      </span>
                      {compatible ? (
                        <span>
                          <strong>{formatUsd(hourlyPrice)}/hour</strong>
                          <small>
                            About {selected.expectedRuntimeMinutes} minutes ·{' '}
                            {formatUsd(expectedCost ?? 0)} expected · {formatUsd(maximumCost ?? 0)}{' '}
                            maximum
                          </small>
                        </span>
                      ) : (
                        <small className="field-warning">
                          {gpu.memoryGb < selected.minimumVramGb
                            ? `Needs ${selected.minimumVramGb} GB; this option has ${gpu.memoryGb} GB.`
                            : 'No current price is available for this tier.'}
                        </small>
                      )}
                    </button>
                  )
                })}
              </div>
              {!cloudStatus?.gpuOptions.length && (
                <p className="field-warning">
                  No cloud computers are available yet. Connect or refresh RunPod in Settings.
                </p>
              )}
            </fieldset>
          </div>
        )}
        {selected?.requiresGpu && (
          <label>
            Repeatable seed <RequiredMark />
            <input
              type="number"
              min={0}
              max={2147483647}
              value={seed}
              onChange={(event) => setSeed(Number(event.target.value))}
              required
            />
          </label>
        )}
        <fieldset className="asset-selector">
          <legend>Approved source media</legend>
          {selected?.workflowId === 'qwen3-tts-line-book' && (
            <p>Select exactly one rights-cleared approved voice reference.</p>
          )}
          {selected?.workflowId === 'qwen-image-targeted-edit' && (
            <p>
              Select exactly two approved images in this order: 1) the parent image, 2) its
              white-on-black region mask. Only the white region may change; the correction becomes a
              new child asset.
            </p>
          )}
          {['ltx2-image-to-video-draft', 'ltx2-image-to-video-final'].includes(
            selected?.workflowId ?? ''
          ) && <p>Select exactly one approved starting image for the shot.</p>}
          {selected?.workflowId === 'ltx2-audio-driven-dialogue' && (
            <p>
              Select exactly two items in this order: 1) approved visual, 2) approved dialogue
              audio.
            </p>
          )}
          {selected?.workflowId === 'latentsync-lip-repair' && (
            <p>
              Select exactly two items in this order: 1) approved video, 2) approved dialogue audio.
              The selection numbers below show the order.
            </p>
          )}
          {selected?.workflowId === 'qwen-image-controlled-board' && (
            <p>
              Select exactly one approved control/reference image. Its role is saved in the job
              manifest; an unsupported kind blocks the estimate.
            </p>
          )}
          {selected?.workflowId === 'ltx2-controlled-shot' && (
            <p>
              Select exactly one approved reference-sheet image for the reviewed Ingredients
              profile. Pose, depth, edge, and motion controls are not substituted into this graph.
            </p>
          )}
          {selected?.workflowId === 'ltx25-project-lora-adaptation' && (
            <p>
              Select the approved rights manifest first, then 4 to 100 approved image or video
              samples in its reviewed order. The selection numbers below confirm that order.
            </p>
          )}
          {approvedMedia.length === 0 ? (
            <p>No approved media yet. Prompt-only workflows can still be estimated.</p>
          ) : (
            approvedMedia.map((asset) => (
              <label key={asset.assetId} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={selectedAssets.includes(asset.assetId)}
                  onChange={(event) =>
                    setSelectedAssets((current) =>
                      event.target.checked
                        ? [...current, asset.assetId]
                        : current.filter((id) => id !== asset.assetId)
                    )
                  }
                />
                <span>
                  {selectedAssets.includes(asset.assetId)
                    ? `${selectedAssets.indexOf(asset.assetId) + 1}. `
                    : ''}
                  {asset.label}
                  <small>{asset.kind}</small>
                </span>
              </label>
            ))
          )}
        </fieldset>
        <button
          className="button button-primary button-large"
          disabled={busy || !selected}
          type="submit"
        >
          {busy ? 'Checking…' : 'Calculate time and maximum cost'}
        </button>
      </form>

      {estimate && selected && (
        <section className="cost-approval-card">
          <div>
            <p className="eyebrow">No GPU started</p>
            <h2>
              {formatUsd(estimate.expectedTotalUsd)} expected ·{' '}
              {formatUsd(estimate.maximumTotalUsd)} hard maximum
            </h2>
            <p>
              {estimate.expectedRuntimeMinutes} minutes expected; automatic worker deadline after{' '}
              {estimate.maximumRuntimeMinutes} minutes.
            </p>
            <ul>
              {estimate.explanation.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <label className="checkbox-row strong-confirmation">
            <input
              type="checkbox"
              checked={costConfirmed}
              onChange={(event) => setCostConfirmed(event.target.checked)}
            />
            <span>
              I approve this exact maximum cost. <RequiredMark />
            </span>
          </label>
          <button className="button button-secondary" disabled={busy} onClick={() => void plan()}>
            Save cost approval — still do not start
          </button>
          {plannedJob && (
            <div className="start-worker-gate">
              <div
                className={`field-warning ${selected.readyForPaidWork ? '' : 'danger'}`}
                role="status"
              >
                {selected.readyForPaidWork
                  ? 'This next action can rent one GPU. The hard deadline and idle protection will be sent with the worker.'
                  : (selected.blockers[0] ??
                    'This workflow has not passed production qualification.')}
              </div>
              <label className="checkbox-row strong-confirmation">
                <input
                  type="checkbox"
                  checked={startConfirmed}
                  onChange={(event) => setStartConfirmed(event.target.checked)}
                />
                <span>
                  I understand the next action may start paid GPU time. <RequiredMark />
                </span>
              </label>
              <button
                className="button button-primary button-large"
                disabled={busy || !selected.readyForPaidWork}
                onClick={() => void start()}
              >
                Start approved worker
              </button>
            </div>
          )}
        </section>
      )}

      <section className="job-list-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Recoverable queue</p>
            <h2>Every planned and running job</h2>
          </div>
        </div>
        {workspace?.jobs.length ? (
          workspace.jobs.map((job) => (
            <JobCard key={job.jobId} job={job} onChanged={refresh} onNotice={setMessage} />
          ))
        ) : (
          <div className="settings-card backup-empty">No production jobs have been prepared.</div>
        )}
      </section>
    </div>
  )
}
