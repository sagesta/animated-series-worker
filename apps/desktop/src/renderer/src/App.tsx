import { useEffect, useMemo, useState, type JSX } from 'react'
import {
  type CloudConnectionStatus,
  type ProjectBackupSummary,
  type ProjectDetails,
  type ProjectMigrationPreview,
  type ProjectSummary,
  type SupportBundleSummary,
  type SystemStatus,
  type VisualDirection,
  type WritingSettingsStatus
} from '@studio/contracts'
import { CloudSetup } from './CloudSetup'
import { CreativeDirectionPanel } from './CreativeDirectionPanel'
import { CreativeRoom } from './CreativeRoom'
import { ProjectWizard } from './ProjectWizard'
import { SkillSetup } from './SkillSetup'
import { WritingSetup } from './WritingSetup'

type Page = 'home' | 'story' | 'world' | 'storyboard' | 'generate' | 'review' | 'edit' | 'settings'

const navigation: Array<{ id: Page; label: string; icon: string; needsProject: boolean }> = [
  { id: 'home', label: 'Home', icon: 'H', needsProject: false },
  { id: 'story', label: 'Story', icon: 'S', needsProject: true },
  { id: 'world', label: 'World & Cast', icon: 'W', needsProject: true },
  { id: 'storyboard', label: 'Storyboard', icon: 'B', needsProject: true },
  { id: 'generate', label: 'Generate', icon: 'G', needsProject: true },
  { id: 'review', label: 'Review', icon: 'R', needsProject: true },
  { id: 'edit', label: 'Edit & Export', icon: 'E', needsProject: true },
  { id: 'settings', label: 'Settings', icon: '⚙', needsProject: false }
]

const visualLabels: Record<VisualDirection, string> = {
  '2d': '2D animation',
  '3d-look': '3D-style animation',
  mixed: 'Mixed 2D and 3D',
  undecided: 'Direction not chosen'
}

const pageCopy: Record<
  Exclude<Page, 'home' | 'settings'>,
  { eyebrow: string; title: string; description: string; next: string }
> = {
  story: {
    eyebrow: 'Creative room',
    title: 'Shape the story with protected GPT, Claude, or Gemini connections',
    description:
      'Create locally stored character, world, outline, scene, dialogue, and continuity proposals.',
    next: 'The first guided writing workflow is ready.'
  },
  world: {
    eyebrow: 'World and cast',
    title: 'Keep characters, voices, locations, and style consistent',
    description:
      'This workspace will hold approved character boards, voice profiles, style bibles, props, and locations.',
    next: 'Character and style-board tools will unlock after story foundations.'
  },
  storyboard: {
    eyebrow: 'Storyboard',
    title: 'Plan every shot before paying for video generation',
    description:
      'Shots will connect story intent, dialogue, movement, framing, and approved references.',
    next: 'Storyboard editing will arrive before any cloud generation.'
  },
  generate: {
    eyebrow: 'Generation',
    title: 'Paid generation is intentionally locked',
    description:
      'You can now connect RunPod safely in Settings. Creating GPUs, LTX workflows, TTS, and lip sync remain unavailable until the prepared worker and shutdown guards pass a controlled test.',
    next: 'Connect the account and save safety defaults in Settings; this still rents no GPU.'
  },
  review: {
    eyebrow: 'Review',
    title: 'Compare takes without losing earlier work',
    description:
      'This area will make approvals, rejection notes, retakes, continuity checks, and costs visible.',
    next: 'Review tools will activate with the first local media pipeline.'
  },
  edit: {
    eyebrow: 'Edit and export',
    title: 'Assemble only approved material',
    description:
      'The final workspace will build timelines, sound, captions, quality checks, and YouTube-ready exports.',
    next: 'Export stays locked until the media and review pipeline is verified.'
  }
}

function formatDate(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(timestamp))
}

function formatCurrencyForSidebar(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

function formatFileSize(byteSize: number): string {
  if (byteSize < 1024) return `${byteSize} bytes`
  if (byteSize < 1024 * 1024) return `${Math.ceil(byteSize / 1024)} KB`
  if (byteSize < 1024 * 1024 * 1024) {
    return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`
  }

  return `${(byteSize / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function projectTypeLabel(project: Pick<ProjectSummary, 'type'>): string {
  return project.type === 'series' ? 'Series' : 'One-off film'
}

function toSummary(project: ProjectDetails): ProjectSummary {
  const { manifest, workspacePath } = project
  return {
    id: manifest.id,
    code: manifest.code,
    title: manifest.title,
    type: manifest.type,
    status: manifest.status,
    targetDurationMinutes: manifest.targetDurationMinutes,
    visualDirection: manifest.visualDirection,
    safeCheckpointAt: manifest.safeCheckpoint.createdAt,
    updatedAt: manifest.updatedAt,
    workspacePath
  }
}

function Logo(): JSX.Element {
  return (
    <div className="logo-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  )
}

function EmptyLibrary({ onCreate }: { onCreate(): void }): JSX.Element {
  return (
    <div className="library-view">
      <section className="welcome-panel">
        <div>
          <p className="eyebrow">Local production studio</p>
          <h1>Your production library is ready.</h1>
          <p className="welcome-copy">
            Start an animated series or a one-off film. Each project remains separate, organised,
            and stored on this computer before any paid tools are introduced.
          </p>
          <button className="button button-primary button-large" onClick={onCreate}>
            <span>＋</span> Start a production
          </button>
        </div>
        <div className="welcome-visual" aria-hidden="true">
          <div className="frame-card frame-one">
            <span>01</span>
          </div>
          <div className="frame-card frame-two">
            <span>02</span>
          </div>
          <div className="frame-card frame-three">
            <span>03</span>
          </div>
          <div className="story-line" />
        </div>
      </section>

      <section className="getting-started">
        <div className="section-heading">
          <div>
            <p className="eyebrow">How it will grow</p>
            <h2>One calm step at a time</h2>
          </div>
          <span className="status-chip local">No GPU cost</span>
        </div>
        <div className="stage-grid">
          <article>
            <span className="stage-number">1</span>
            <h3>Create the production</h3>
            <p>Choose series or film, give it a name, and create a safe local checkpoint.</p>
            <span className="stage-state ready">Ready now</span>
          </article>
          <article>
            <span className="stage-number">2</span>
            <h3>Lock the creative plan</h3>
            <p>Develop story, style, characters, voices, boards, and shot decisions.</p>
            <span className="stage-state planned">Coming next</span>
          </article>
          <article>
            <span className="stage-number">3</span>
            <h3>Generate with approval</h3>
            <p>See time and cost estimates before temporary cloud workers can start.</p>
            <span className="stage-state locked">Safety locked</span>
          </article>
        </div>
      </section>
    </div>
  )
}

interface ProjectLibraryProps {
  projects: ProjectSummary[]
  onCreate(): void
  onOpen(projectId: string): void
  openingProjectId?: string
}

function ProjectLibrary({
  projects,
  onCreate,
  onOpen,
  openingProjectId
}: ProjectLibraryProps): JSX.Element {
  if (projects.length === 0) {
    return <EmptyLibrary onCreate={onCreate} />
  }

  return (
    <div className="library-view">
      <section className="library-heading">
        <div>
          <p className="eyebrow">Production library</p>
          <h1>Welcome back.</h1>
          <p>Choose a production to continue, or give a new story its own workspace.</p>
        </div>
        <button className="button button-primary" onClick={onCreate}>
          <span>＋</span> New production
        </button>
      </section>

      <section>
        <div className="section-heading">
          <div>
            <h2>Your productions</h2>
            <p>
              {projects.length} {projects.length === 1 ? 'project' : 'projects'} stored locally
            </p>
          </div>
          <span className="status-chip local">Local only</span>
        </div>
        <div className="project-grid">
          {projects.map((project, index) => (
            <button
              className="project-card"
              key={project.id}
              onClick={() => onOpen(project.id)}
              disabled={openingProjectId === project.id}
            >
              <div className={`project-art art-${(index % 4) + 1}`}>
                <span>{project.code.slice(0, 2)}</span>
                <div className="project-art-lines" />
              </div>
              <div className="project-card-body">
                <div className="project-card-meta">
                  <span>{projectTypeLabel(project)}</span>
                  <span>•</span>
                  <span>{project.targetDurationMinutes} min</span>
                </div>
                <h3>{project.title}</h3>
                <p>{visualLabels[project.visualDirection]}</p>
                <div className="project-card-footer">
                  <span className="checkpoint-mark">✓</span>
                  Safe checkpoint {formatDate(project.safeCheckpointAt)}
                </div>
              </div>
              <span className="open-arrow" aria-hidden="true">
                {openingProjectId === project.id ? '…' : '→'}
              </span>
            </button>
          ))}
          <button className="project-card new-project-card" onClick={onCreate}>
            <span className="new-project-plus">＋</span>
            <strong>New production</strong>
            <span>Series or one-off film</span>
          </button>
        </div>
      </section>
    </div>
  )
}

function ProjectBackupPanel({ project }: { project: ProjectDetails }): JSX.Element {
  const [latestBackup, setLatestBackup] = useState<ProjectBackupSummary>()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void window.studio.projects
      .listBackups()
      .then((backups) => {
        if (!cancelled) {
          setLatestBackup(backups.find((backup) => backup.projectId === project.manifest.id))
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true)
          setMessage('Existing backups could not be checked. Your project remains unchanged.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [project.manifest.id])

  const createBackup = async (): Promise<void> => {
    setBusy(true)
    setFailed(false)
    setMessage('Copying and checking every project file…')
    try {
      const backup = await window.studio.projects.backup(project.manifest.id)
      setLatestBackup(backup)
      setMessage('Verified backup complete. It is safe to use for recovery.')
    } catch {
      setFailed(true)
      setMessage('The backup did not pass its safety checks. Your project was not changed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="project-safety-card" aria-labelledby="project-safety-title">
      <div>
        <p className="eyebrow">Project safety</p>
        <h2 id="project-safety-title">Keep a verified recovery copy</h2>
        <p>
          The studio copies every project file, checks the copy, and never replaces an existing
          project during recovery.
        </p>
        {latestBackup && (
          <small>
            Latest verified backup: {formatDate(latestBackup.createdAt)} ·{' '}
            {formatFileSize(latestBackup.totalBytes)} · {latestBackup.fileCount} files
          </small>
        )}
        {message && (
          <div className={`safety-feedback ${failed ? 'error' : ''}`} role="status">
            {message}
          </div>
        )}
      </div>
      <button
        className="button button-secondary"
        disabled={busy}
        onClick={() => void createBackup()}
      >
        {busy ? 'Creating verified backup…' : 'Create verified backup'}
      </button>
    </section>
  )
}

function ProjectMigrationPanel({
  project,
  onUpdated
}: {
  project: ProjectDetails
  onUpdated(project: ProjectDetails): void
}): JSX.Element | null {
  const [preview, setPreview] = useState<ProjectMigrationPreview | null>()
  const [updating, setUpdating] = useState(false)
  const [message, setMessage] = useState<string>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void window.studio.projects
      .getMigrationPreview(project.manifest.id)
      .then((result) => {
        if (!cancelled) setPreview(result)
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true)
          setMessage('The project format could not be checked. No project file was changed.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [project.manifest.id, project.manifest.updatedAt])

  if (preview === null && !message) {
    return null
  }
  if (preview === undefined && !message) {
    return null
  }

  const migrate = async (): Promise<void> => {
    if (!preview) return
    setUpdating(true)
    setFailed(false)
    setMessage('Creating a verified backup before changing the project format…')
    try {
      const result = await window.studio.projects.migrate({
        projectId: preview.projectId,
        expectedUpdatedAt: preview.expectedUpdatedAt
      })
      onUpdated(result.project)
    } catch {
      setFailed(true)
      setMessage(
        'The format update did not finish. The recovery backup was retained and existing creative files were not replaced.'
      )
    } finally {
      setUpdating(false)
    }
  }

  return (
    <section className="migration-card" aria-labelledby="migration-title">
      <div>
        <p className="eyebrow">Safe project update</p>
        <h2 id="migration-title">This older project needs a small format update</h2>
        <p>
          The update adds reversible archive history. It changes one metadata file, expects no data
          loss, and creates a verified backup first.
        </p>
        {preview && (
          <ul>
            {preview.changes.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        )}
        {message && (
          <div className={`safety-feedback ${failed ? 'error' : ''}`} role="status">
            {message}
          </div>
        )}
      </div>
      <button
        className="button button-primary"
        disabled={updating || !preview}
        onClick={() => void migrate()}
      >
        {updating ? 'Updating safely…' : 'Back up and update project'}
      </button>
    </section>
  )
}

interface ProjectOverviewProps {
  project: ProjectDetails
  cloudStatus?: CloudConnectionStatus
  onNavigate(page: Page): void
  onLibrary(): void
  onProjectUpdated(project: ProjectDetails): void
}

function ProjectOverview({
  project,
  cloudStatus,
  onNavigate,
  onLibrary,
  onProjectUpdated
}: ProjectOverviewProps): JSX.Element {
  const { manifest, workspacePath } = project

  return (
    <div className="project-overview">
      <section className="project-hero">
        <div>
          <button className="text-button back-link" onClick={onLibrary}>
            ← All productions
          </button>
          <div className="hero-title-row">
            <span className="project-code">{manifest.code}</span>
            <span className="status-chip development">In development</span>
          </div>
          <h1>{manifest.title}</h1>
          <p>
            {manifest.type === 'series' ? 'Animated series' : 'One-off film'} ·{' '}
            {manifest.targetDurationMinutes} minutes · {visualLabels[manifest.visualDirection]}
          </p>
        </div>
        <button className="button button-primary" onClick={() => onNavigate('story')}>
          Start story planning <span>→</span>
        </button>
      </section>

      <ProjectMigrationPanel project={project} onUpdated={onProjectUpdated} />

      <CreativeDirectionPanel project={project} onUpdated={onProjectUpdated} />

      <section className="health-grid">
        <article className="health-card">
          <span className="health-icon safe">✓</span>
          <div>
            <span>Last safe checkpoint</span>
            <strong>{manifest.safeCheckpoint.label}</strong>
            <small>{formatDate(manifest.safeCheckpoint.createdAt)}</small>
          </div>
        </article>
        <article className="health-card">
          <span className="health-icon local-icon">⌂</span>
          <div>
            <span>Storage</span>
            <strong>Saved on this computer</strong>
            <small title={workspacePath}>{workspacePath}</small>
          </div>
        </article>
        <article className="health-card">
          <span className="health-icon locked-icon">◇</span>
          <div>
            <span>Cloud GPU</span>
            <strong>
              {cloudStatus?.connectionState === 'connected'
                ? 'Account connected · generation locked'
                : 'Not configured'}
            </strong>
            <small>
              {cloudStatus?.account && cloudStatus.account.activePods > 0
                ? `${cloudStatus.account.activePods} existing active RunPod ${cloudStatus.account.activePods === 1 ? 'Pod' : 'Pods'}`
                : '$0 active cloud spend'}
            </small>
          </div>
        </article>
      </section>

      <ProjectBackupPanel project={project} />

      <section className="production-roadmap">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Production path</p>
            <h2>Build confidence before compute</h2>
          </div>
        </div>
        <div className="roadmap-list">
          <button onClick={() => onNavigate('story')}>
            <span className="roadmap-number current">1</span>
            <span>
              <strong>Story foundation</strong>
              <small>Structure the story, scenes, dialogue, and production intent.</small>
            </span>
            <span className="roadmap-state current">Next</span>
          </button>
          <button onClick={() => onNavigate('world')}>
            <span className="roadmap-number">2</span>
            <span>
              <strong>World and cast</strong>
              <small>Lock visual style, character boards, voices, locations, and props.</small>
            </span>
            <span className="roadmap-state">Planned</span>
          </button>
          <button onClick={() => onNavigate('storyboard')}>
            <span className="roadmap-number">3</span>
            <span>
              <strong>Storyboard and shots</strong>
              <small>Decide movement, framing, dialogue, and references shot by shot.</small>
            </span>
            <span className="roadmap-state">Planned</span>
          </button>
          <button onClick={() => onNavigate('generate')}>
            <span className="roadmap-number">4</span>
            <span>
              <strong>Generate, review, and finish</strong>
              <small>Paid work remains locked until estimates and safety controls are ready.</small>
            </span>
            <span className="roadmap-state locked">Locked</span>
          </button>
        </div>
      </section>
    </div>
  )
}

function WorkspacePlaceholder({
  page,
  project,
  onHome
}: {
  page: Exclude<Page, 'home' | 'settings'>
  project: ProjectDetails
  onHome(): void
}): JSX.Element {
  const copy = pageCopy[page]
  const locked = page === 'generate'

  return (
    <div className="placeholder-view">
      <button className="text-button back-link" onClick={onHome}>
        ← Production overview
      </button>
      <section className="placeholder-card">
        <div className={`placeholder-symbol ${locked ? 'locked' : ''}`}>
          {locked ? '◇' : navigation.find((item) => item.id === page)?.icon}
        </div>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
        <div className="placeholder-project">
          <span>{project.manifest.code}</span>
          <div>
            <strong>{project.manifest.title}</strong>
            <small>This production remains safely stored and unchanged.</small>
          </div>
        </div>
        <div className="planned-notice">
          <span>i</span>
          <p>{copy.next}</p>
        </div>
        {locked && (
          <button className="button button-disabled" disabled>
            GPU setup not available yet
          </button>
        )}
      </section>
    </div>
  )
}

function BackupRecovery({
  projectIds,
  onRestored
}: {
  projectIds: ReadonlySet<string>
  onRestored(project: ProjectDetails): void
}): JSX.Element {
  const [backups, setBackups] = useState<ProjectBackupSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [restoringId, setRestoringId] = useState<string>()
  const [message, setMessage] = useState<string>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void window.studio.projects
      .listBackups()
      .then((availableBackups) => {
        if (!cancelled) setBackups(availableBackups)
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true)
          setMessage('Backups could not be checked. No project was changed.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const restore = async (backupId: string): Promise<void> => {
    setRestoringId(backupId)
    setFailed(false)
    setMessage('Restoring to a new project folder and checking every file…')
    try {
      const result = await window.studio.projects.restore(backupId)
      onRestored(result.project)
    } catch {
      setFailed(true)
      setMessage(
        'This backup could not be restored safely. Existing project files were not overwritten.'
      )
    } finally {
      setRestoringId(undefined)
    }
  }

  if (loading) {
    return <div className="settings-card backup-empty">Checking verified backups…</div>
  }

  if (backups.length === 0) {
    return (
      <div className="settings-card backup-empty">
        {message ?? 'No verified backup is available yet. Create one from a production overview.'}
      </div>
    )
  }

  return (
    <div className="backup-list">
      {message && (
        <div className={`safety-feedback ${failed ? 'error' : ''}`} role="status">
          {message}
        </div>
      )}
      {backups.map((backup) => {
        const alreadyPresent = projectIds.has(backup.projectId)
        return (
          <article className="backup-item" key={backup.backupId}>
            <div>
              <strong>{backup.projectTitle}</strong>
              <span>
                Verified {formatDate(backup.createdAt)} · {formatFileSize(backup.totalBytes)} ·{' '}
                {backup.fileCount} files
              </span>
            </div>
            <button
              className="button button-secondary"
              disabled={alreadyPresent || restoringId !== undefined}
              onClick={() => void restore(backup.backupId)}
            >
              {alreadyPresent
                ? 'Already in library'
                : restoringId === backup.backupId
                  ? 'Restoring…'
                  : 'Restore project'}
            </button>
          </article>
        )
      })}
    </div>
  )
}

function SupportDiagnosticsPanel(): JSX.Element {
  const [creating, setCreating] = useState(false)
  const [bundle, setBundle] = useState<SupportBundleSummary>()
  const [message, setMessage] = useState<string>()
  const [failed, setFailed] = useState(false)

  const createBundle = async (): Promise<void> => {
    setCreating(true)
    setFailed(false)
    setMessage('Collecting recent app events and checking redaction…')
    try {
      const result = await window.studio.support.createBundle()
      setBundle(result)
      setMessage('Redaction check passed. The support file is ready.')
    } catch {
      setFailed(true)
      setMessage('The support file could not be created safely. Nothing was uploaded.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="settings-card support-card">
      <p>
        This creates one local JSON support file with app state and recent safety events. It does
        not include API keys, provider responses, scripts, prompts, images, audio, or video, and it
        is never uploaded automatically.
      </p>
      {bundle && (
        <div className="support-result">
          <span>Saved locally</span>
          <strong title={bundle.bundlePath}>{bundle.bundlePath}</strong>
          <small>{bundle.eventCount} redacted events included</small>
        </div>
      )}
      {message && (
        <div className={`safety-feedback ${failed ? 'error' : ''}`} role="status">
          {message}
        </div>
      )}
      <button
        className="button button-secondary"
        disabled={creating}
        onClick={() => void createBundle()}
      >
        {creating ? 'Creating safe support file…' : 'Create redacted support file'}
      </button>
    </div>
  )
}

function Settings({
  status,
  cloudStatus,
  writingStatus,
  projects,
  projectIds,
  onCloudStatus,
  onWritingStatus,
  onProjectRestored
}: {
  status?: SystemStatus
  cloudStatus?: CloudConnectionStatus
  writingStatus?: WritingSettingsStatus
  projects: ProjectSummary[]
  projectIds: ReadonlySet<string>
  onCloudStatus(status: CloudConnectionStatus): void
  onWritingStatus(status: WritingSettingsStatus): void
  onProjectRestored(project: ProjectDetails): void
}): JSX.Element {
  return (
    <div className="settings-view">
      <header className="page-heading">
        <p className="eyebrow">Studio settings</p>
        <h1>Connect creative AI and the GPU account safely.</h1>
        <p>
          Connection checks are free. Text requests need separate approval, and GPU generation
          remains locked.
        </p>
      </header>

      <section className="settings-section">
        <div>
          <h2>GPT, Claude, and Gemini writing</h2>
          <p>
            Connect a service, see the models available to your own account, and choose what the
            Story room should use.
          </p>
        </div>
        <WritingSetup status={writingStatus} onStatus={onWritingStatus} />
      </section>

      <section className="settings-section">
        <div>
          <h2>Creative skills</h2>
          <p>
            Add reviewed writing guidance and choose exactly which production may use each skill.
          </p>
        </div>
        <SkillSetup projects={projects} />
      </section>

      <section className="settings-section">
        <div>
          <h2>Local workspace</h2>
          <p>Every production is given an isolated folder inside this location.</p>
        </div>
        <div className="settings-card">
          <div className="settings-row">
            <span>Project storage</span>
            <strong title={status?.storagePath}>{status?.storagePath ?? 'Loading…'}</strong>
          </div>
          <div className="settings-row">
            <span>Local catalog</span>
            <strong className="positive-status">● Ready</strong>
          </div>
          <div className="settings-row">
            <span>Projects found</span>
            <strong>{status?.indexedProjects ?? '—'}</strong>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <div>
          <h2>Backup and recovery</h2>
          <p>
            Restore a verified copy only when its original project is no longer in the library.
            Existing folders are never replaced.
          </p>
        </div>
        <BackupRecovery projectIds={projectIds} onRestored={onProjectRestored} />
      </section>

      <section className="settings-section">
        <div>
          <h2>RunPod and spending</h2>
          <p>
            Store the API key securely, verify access, view current planning prices, and choose
            conservative defaults.
          </p>
        </div>
        <CloudSetup status={cloudStatus} onStatus={onCloudStatus} />
      </section>

      <section className="settings-section">
        <div>
          <h2>Application</h2>
          <p>Useful when checking a future update or support report.</p>
        </div>
        <div className="settings-card">
          <div className="settings-row">
            <span>Studio version</span>
            <strong>{status?.appVersion ?? '—'}</strong>
          </div>
          <div className="settings-row">
            <span>Desktop runtime</span>
            <strong>{status ? `Electron ${status.electronVersion}` : '—'}</strong>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <div>
          <h2>Safe support file</h2>
          <p>Create diagnostics you can inspect and choose to share if the studio needs help.</p>
        </div>
        <SupportDiagnosticsPanel />
      </section>
    </div>
  )
}

export function App(): JSX.Element {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [status, setStatus] = useState<SystemStatus>()
  const [cloudStatus, setCloudStatus] = useState<CloudConnectionStatus>()
  const [writingStatus, setWritingStatus] = useState<WritingSettingsStatus>()
  const [activeProject, setActiveProject] = useState<ProjectDetails>()
  const [page, setPage] = useState<Page>('home')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [openingProjectId, setOpeningProjectId] = useState<string>()

  useEffect(() => {
    let cancelled = false

    void Promise.allSettled([
      window.studio.projects.list(),
      window.studio.system.getStatus(),
      window.studio.cloud.getStatus(),
      window.studio.writing.getStatus()
    ]).then(([projectsResult, systemResult, cloudResult, writingResult]) => {
      if (cancelled) return

      if (projectsResult.status === 'fulfilled') setProjects(projectsResult.value)
      if (systemResult.status === 'fulfilled') setStatus(systemResult.value)
      if (cloudResult.status === 'fulfilled') setCloudStatus(cloudResult.value)
      if (writingResult.status === 'fulfilled') setWritingStatus(writingResult.value)

      if (projectsResult.status === 'rejected' || systemResult.status === 'rejected') {
        setError('The local project library could not be opened. No cloud service was started.')
      } else if (cloudResult.status === 'rejected') {
        setError('Cloud settings need attention. Local productions remain available and unchanged.')
      } else if (writingResult.status === 'rejected') {
        setError('Writing connections need attention. Local productions remain unchanged.')
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const activeSummary = useMemo(
    () => (activeProject ? toSummary(activeProject) : undefined),
    [activeProject]
  )
  const projectIds = useMemo(() => new Set(projects.map((project) => project.id)), [projects])

  const openProject = async (projectId: string): Promise<void> => {
    setError(undefined)
    setOpeningProjectId(projectId)
    try {
      const project = await window.studio.projects.open(projectId)
      setActiveProject(project)
      setPage('home')
    } catch {
      setError('That production could not be opened safely. Its files were not changed.')
    } finally {
      setOpeningProjectId(undefined)
    }
  }

  const projectCreated = (project: ProjectDetails): void => {
    setActiveProject(project)
    setProjects((current) => [
      toSummary(project),
      ...current.filter((item) => item.id !== project.manifest.id)
    ])
    setStatus((current) =>
      current ? { ...current, indexedProjects: current.indexedProjects + 1 } : current
    )
    setPage('home')
    setWizardOpen(false)
  }

  const projectRestored = (project: ProjectDetails): void => {
    const alreadyIndexed = projects.some((item) => item.id === project.manifest.id)
    setActiveProject(project)
    setProjects((current) => [
      toSummary(project),
      ...current.filter((item) => item.id !== project.manifest.id)
    ])
    if (!alreadyIndexed) {
      setStatus((current) =>
        current ? { ...current, indexedProjects: current.indexedProjects + 1 } : current
      )
    }
    setError(undefined)
    setPage('home')
  }

  const projectUpdated = (project: ProjectDetails): void => {
    setActiveProject(project)
    setProjects((current) =>
      current.map((item) => (item.id === project.manifest.id ? toSummary(project) : item))
    )
    setError(undefined)
  }

  const goToLibrary = (): void => {
    setActiveProject(undefined)
    setPage('home')
  }

  const mainContent = (): JSX.Element => {
    if (page === 'settings') {
      return (
        <Settings
          status={status}
          cloudStatus={cloudStatus}
          writingStatus={writingStatus}
          projects={projects}
          projectIds={projectIds}
          onCloudStatus={setCloudStatus}
          onWritingStatus={setWritingStatus}
          onProjectRestored={projectRestored}
        />
      )
    }

    if (!activeProject) {
      return (
        <ProjectLibrary
          projects={projects}
          onCreate={() => setWizardOpen(true)}
          onOpen={(projectId) => void openProject(projectId)}
          openingProjectId={openingProjectId}
        />
      )
    }

    if (page === 'home') {
      return (
        <ProjectOverview
          project={activeProject}
          cloudStatus={cloudStatus}
          onNavigate={setPage}
          onLibrary={goToLibrary}
          onProjectUpdated={projectUpdated}
        />
      )
    }

    if (page === 'story') {
      return (
        <CreativeRoom
          project={activeProject}
          writingStatus={writingStatus}
          onHome={() => setPage('home')}
          onSettings={() => setPage('settings')}
        />
      )
    }

    return (
      <WorkspacePlaceholder page={page} project={activeProject} onHome={() => setPage('home')} />
    )
  }

  if (loading) {
    return (
      <main className="loading-screen">
        <Logo />
        <h1>Opening your studio…</h1>
        <p>Checking the local production library.</p>
      </main>
    )
  }

  const cloudConnected = cloudStatus?.connectionState === 'connected'
  const reportedActivePods = cloudStatus?.account?.activePods ?? 0
  const reportedHourlyCost = cloudStatus?.account?.activeHourlyCostUsd ?? 0

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Logo />
          <div>
            <strong>Animated</strong>
            <span>Series Studio</span>
          </div>
        </div>

        <button className="project-switcher" onClick={goToLibrary}>
          <span className={`switcher-art ${activeProject ? 'active' : ''}`}>
            {activeSummary?.code.slice(0, 1) ?? '＋'}
          </span>
          <span>
            <small>{activeProject ? 'Current production' : 'Production library'}</small>
            <strong>{activeProject?.manifest.title ?? 'Choose a project'}</strong>
          </span>
          <span className="switcher-arrow">⌄</span>
        </button>

        <nav aria-label="Studio sections">
          <span className="nav-label">Workspace</span>
          {navigation.map((item) => {
            const disabled = item.needsProject && !activeProject
            return (
              <button
                key={item.id}
                className={page === item.id ? 'active' : ''}
                aria-current={page === item.id ? 'page' : undefined}
                disabled={disabled}
                title={disabled ? 'Choose or create a production first' : undefined}
                onClick={() => setPage(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
                {item.id === 'generate' && <span className="mini-lock">◇</span>}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-spacer" />
        <div className="cloud-summary">
          <div>
            <span className={`cloud-light ${cloudConnected ? 'connected' : ''}`} />
            <strong>{cloudConnected ? 'RunPod linked' : 'Local mode'}</strong>
          </div>
          <p>
            {cloudConnected
              ? reportedActivePods > 0
                ? `RunPod reports ${reportedActivePods} active ${reportedActivePods === 1 ? 'Pod' : 'Pods'}`
                : 'No active Pods at last check'
              : 'Cloud GPU is not configured'}
          </p>
          <span>
            {cloudConnected
              ? `${formatCurrencyForSidebar(reportedHourlyCost)}/hr reported · generation locked`
              : '$0 current spend'}
          </span>
        </div>
        <div className="sidebar-version">Safe connection build · v{status?.appVersion}</div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="topbar-dot" />
            Local workspace ready
          </div>
          <div className="topbar-safety">
            {reportedActivePods > 0
              ? 'Existing RunPod activity found · generation locked'
              : 'GPU off · text calls require approval'}
          </div>
        </header>
        {error && (
          <div className="error-banner" role="alert">
            <span>!</span>
            {error}
            <button aria-label="Dismiss message" onClick={() => setError(undefined)}>
              ×
            </button>
          </div>
        )}
        <div className="workspace-scroll">{mainContent()}</div>
      </main>

      {wizardOpen && (
        <ProjectWizard onClose={() => setWizardOpen(false)} onCreated={projectCreated} />
      )}
    </div>
  )
}
