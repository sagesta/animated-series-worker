import { useEffect, useState, type JSX } from 'react'
import type { ExternalSkillStatus, ProjectSummary, WritingTaskKind } from '@studio/contracts'

const taskLabels: Record<WritingTaskKind, string> = {
  design_creative_direction: 'Audience and creative direction',
  develop_character: 'Character development',
  build_world: 'World building',
  outline_episode: 'Episode or film outlines',
  plan_storyboard: 'Shot-by-shot storyboard plans',
  draft_scene: 'Scene drafting',
  rewrite_dialogue: 'Dialogue rewriting',
  check_continuity: 'Continuity checks',
  design_visual_generation: 'Image and visual prompts',
  design_voice_performance: 'Voice and performance direction',
  plan_motion: 'Movement and camera plans',
  plan_advanced_controls: 'Pose, depth, mask, layer, and motion controls',
  plan_edit_sound: 'Timeline, caption, and sound plans',
  plan_foley: 'Ambience, effects, and foley plans',
  plan_adaptation: 'Optional project adaptation plans',
  plan_thumbnail: 'Truthful thumbnail concepts',
  analyze_performance: 'Performance evidence analysis',
  plan_youtube_release: 'YouTube title, SEO, thumbnail, and release plans'
}

const permissionLabels = {
  'read-project': 'Read the project facts selected for this request',
  'read-creative-direction': 'Read the selected audience and creative direction',
  'read-writing-history': 'Read earlier writing proposals (not available yet)'
} as const

export function SkillSetup({ projects }: { projects: ProjectSummary[] }): JSX.Element {
  const [status, setStatus] = useState<ExternalSkillStatus>({ installed: [] })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string>()
  const [message, setMessage] = useState<string>()
  const [failed, setFailed] = useState(false)
  const [removingSkillId, setRemovingSkillId] = useState<string>()

  useEffect(() => {
    let cancelled = false
    void window.studio.skills
      .getStatus()
      .then((result) => {
        if (!cancelled) setStatus(result)
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true)
          setMessage('The local creative-skill library needs attention.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const install = async (): Promise<void> => {
    setBusy('install')
    setFailed(false)
    setMessage(undefined)
    try {
      const result = await window.studio.skills.install()
      if (result.ok) {
        setStatus(result.status)
        setMessage(
          'The skill was inspected and installed without running code. Choose the projects that may use it.'
        )
      } else if (result.error.code !== 'cancelled') {
        setFailed(true)
        setMessage(result.error.message)
      }
    } catch {
      setFailed(true)
      setMessage('The skill package could not be reviewed safely. Nothing was enabled.')
    } finally {
      setBusy(undefined)
    }
  }

  const setProjectEnabled = async (
    skillId: string,
    projectId: string,
    enabled: boolean
  ): Promise<void> => {
    setBusy(`${skillId}:${projectId}`)
    setFailed(false)
    try {
      const result = await window.studio.skills.setProjectEnabled({ skillId, projectId, enabled })
      if (result.ok) {
        setStatus(result.status)
        setMessage(
          enabled
            ? 'The skill is now available only to the selected project.'
            : 'The skill was disabled for that project. Existing proposal receipts remain.'
        )
      } else {
        setFailed(true)
        setMessage(result.error.message)
      }
    } catch {
      setFailed(true)
      setMessage('That project setting could not be changed safely.')
    } finally {
      setBusy(undefined)
    }
  }

  const remove = async (skillId: string): Promise<void> => {
    setBusy(`remove:${skillId}`)
    setFailed(false)
    try {
      const result = await window.studio.skills.remove({ skillId })
      if (result.ok) {
        setStatus(result.status)
        setRemovingSkillId(undefined)
        setMessage(
          'The skill was removed from active use. Earlier proposals still show their exact receipts.'
        )
      } else {
        setFailed(true)
        setMessage(result.error.message)
      }
    } catch {
      setFailed(true)
      setMessage('The skill could not be removed safely.')
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <div className="skill-setup">
      <div className="settings-card skill-intro-card">
        <div>
          <strong>Declarative skills only</strong>
          <p>
            A skill can add checked writing instructions and output requirements. It cannot run
            programs, see API keys, open arbitrary files, use the network, or start a GPU.
          </p>
        </div>
        <button
          className="button button-secondary"
          disabled={Boolean(busy)}
          onClick={() => void install()}
        >
          {busy === 'install' ? 'Reviewing package…' : 'Install skill file'}
        </button>
      </div>

      {message && (
        <div className={`safety-feedback ${failed ? 'error' : ''}`} role="status">
          {message}
        </div>
      )}

      {loading ? (
        <div className="settings-card backup-empty">Checking installed creative skills…</div>
      ) : status.installed.length === 0 ? (
        <div className="settings-card backup-empty">
          No external creative skill is installed. Writing still works with the studio’s built-in
          structure.
        </div>
      ) : (
        <div className="skill-card-list">
          {status.installed.map((installed) => {
            const { manifest } = installed
            return (
              <article className="settings-card skill-card" key={manifest.skillId}>
                <div className="skill-card-heading">
                  <div>
                    <span
                      className={`status-chip ${installed.compatibilityState === 'compatible' ? 'local' : 'attention'}`}
                    >
                      {installed.compatibilityState === 'compatible'
                        ? 'Compatible'
                        : 'Needs attention'}
                    </span>
                    <h3>{manifest.displayName}</h3>
                    <p>{manifest.description}</p>
                  </div>
                  <span className="skill-version">Version {manifest.version}</span>
                </div>

                <dl className="skill-facts">
                  <div>
                    <dt>Publisher claim</dt>
                    <dd>{manifest.publisher}</dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>{manifest.source}</dd>
                  </div>
                  <div>
                    <dt>Signature</dt>
                    <dd>{manifest.signatureStatus === 'verified' ? 'Verified' : 'Not verified'}</dd>
                  </div>
                  <div>
                    <dt>Package fingerprint</dt>
                    <dd title={manifest.packageSha256}>{manifest.packageSha256.slice(0, 12)}…</dd>
                  </div>
                </dl>

                <div className="skill-tags" aria-label="Matching writing tasks">
                  {manifest.taskKinds.map((taskKind) => (
                    <span key={taskKind}>{taskLabels[taskKind]}</span>
                  ))}
                </div>

                <details className="skill-details">
                  <summary>Review instructions and permissions</summary>
                  <p>{manifest.instructions}</p>
                  <strong>Requested access</strong>
                  <ul>
                    {manifest.requestedPermissions.length === 0 ? (
                      <li>No additional project context.</li>
                    ) : (
                      manifest.requestedPermissions.map((permission) => (
                        <li key={permission}>{permissionLabels[permission]}</li>
                      ))
                    )}
                  </ul>
                  <p>{installed.compatibilityReason}</p>
                  <p>
                    Installing a newer version turns project access off until you review and enable
                    it again.
                  </p>
                </details>

                <div className="skill-project-access">
                  <strong>Enable for a project</strong>
                  {projects.length === 0 ? (
                    <p>Create a production first; installation never enables a skill globally.</p>
                  ) : (
                    projects.map((project) => {
                      const enabled = installed.enabledProjectIds.includes(project.id)
                      const operationId = `${manifest.skillId}:${project.id}`
                      return (
                        <label key={project.id}>
                          <input
                            type="checkbox"
                            checked={enabled}
                            disabled={
                              Boolean(busy) || installed.compatibilityState !== 'compatible'
                            }
                            onChange={(event) =>
                              void setProjectEnabled(
                                manifest.skillId,
                                project.id,
                                event.target.checked
                              )
                            }
                          />
                          <span>{project.title}</span>
                          {busy === operationId && <small>Saving…</small>}
                        </label>
                      )
                    })
                  )}
                </div>

                {removingSkillId === manifest.skillId ? (
                  <div className="skill-remove-confirmation" role="alert">
                    <p>
                      Remove this skill from active use? Existing proposals and receipts will not be
                      deleted.
                    </p>
                    <div>
                      <button
                        className="button button-secondary"
                        disabled={Boolean(busy)}
                        onClick={() => setRemovingSkillId(undefined)}
                      >
                        Keep skill
                      </button>
                      <button
                        className="button button-danger"
                        disabled={Boolean(busy)}
                        onClick={() => void remove(manifest.skillId)}
                      >
                        {busy === `remove:${manifest.skillId}` ? 'Removing…' : 'Remove skill'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="text-button"
                    disabled={Boolean(busy)}
                    onClick={() => setRemovingSkillId(manifest.skillId)}
                  >
                    Review removal
                  </button>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
