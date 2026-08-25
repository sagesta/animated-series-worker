import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import {
  type CanonKind,
  type CloudConnectionStatus,
  type ExternalSkillPlanPreview,
  type FinishWorkspace,
  type ProductionWorkspaceSummary,
  type ProjectDetails,
  type WritingContextPreview,
  type WritingDraftRecord,
  type WritingProvider,
  type WritingSettingsStatus,
  type WritingTaskKind
} from '@studio/contracts'
import { RequiredMark, ValidationAlert } from './FormGuidance'
import type { QuickCreateIntent, QuickCreateMode } from './ProductionRooms'

type CreatorDestination =
  'story' | 'world' | 'storyboard' | 'generate' | 'review' | 'edit' | 'settings'

type GuidedActionId =
  'plan' | 'characters' | 'world' | 'script' | 'storyboard' | 'look' | 'voice' | 'release'

interface GuidedAction {
  id: GuidedActionId
  shortLabel: string
  eyebrow: string
  title: string
  description: string
  taskKind: WritingTaskKind
  canonKind: CanonKind
  canonLabel: string
  instruction: string
  maximumOutputTokens: number
}

interface ProgressFlags {
  hasPlan: boolean
  hasCharacter: boolean
  hasWorld: boolean
  hasScript: boolean
  hasStoryboard: boolean
  hasLook: boolean
  hasVoice: boolean
  hasMaster: boolean
  hasRelease: boolean
}

const providerOrder: WritingProvider[] = ['openai', 'anthropic', 'gemini']
const textActionOrder: GuidedActionId[] = [
  'plan',
  'characters',
  'world',
  'script',
  'storyboard',
  'look',
  'voice',
  'release'
]

type GenerationQuickCreateMode = Exclude<QuickCreateMode, 'stitch'>

interface QuickCreateChoice {
  id: string
  label: string
  workflowId: string
  outputKind: NonNullable<QuickCreateIntent['outputKind']>
}

interface QuickCreateDefinition {
  title: string
  description: string
  placeholder: string
  choices: QuickCreateChoice[]
}

const quickCreateDefinitions: Record<GenerationQuickCreateMode, QuickCreateDefinition> = {
  image: {
    title: 'Create an image',
    description:
      'Prepare one reusable visual asset, then choose approved references and review an estimate.',
    placeholder:
      'Describe the subject, expression, environment, framing, lighting, continuity anchors, and what must not change.',
    choices: [
      {
        id: 'character-board',
        label: 'Character board',
        workflowId: 'qwen-image-character-board',
        outputKind: 'character-board'
      },
      {
        id: 'style-board',
        label: 'Style and look board',
        workflowId: 'qwen-image-character-board',
        outputKind: 'style-board'
      },
      {
        id: 'environment-board',
        label: 'Environment board',
        workflowId: 'qwen-image-character-board',
        outputKind: 'environment-board'
      },
      {
        id: 'storyboard-frame',
        label: 'Storyboard frame',
        workflowId: 'qwen-image-character-board',
        outputKind: 'storyboard-frame'
      }
    ]
  },
  video: {
    title: 'Create a video take',
    description:
      'Prepare motion from approved visual and audio material, then review the exact method and cost.',
    placeholder:
      'Describe performance beats, camera movement, start and end state, duration, continuity constraints, and what stays still.',
    choices: [
      {
        id: 'motion-draft',
        label: 'Motion draft',
        workflowId: 'ltx2-image-to-video-draft',
        outputKind: 'video-take'
      },
      {
        id: 'final-shot',
        label: 'Final-quality shot',
        workflowId: 'ltx2-image-to-video-final',
        outputKind: 'video-take'
      },
      {
        id: 'dialogue-performance',
        label: 'Dialogue performance',
        workflowId: 'ltx2-audio-driven-dialogue',
        outputKind: 'video-take'
      },
      {
        id: 'lip-repair',
        label: 'Lip-sync repair',
        workflowId: 'latentsync-lip-repair',
        outputKind: 'video-take'
      }
    ]
  },
  audio: {
    title: 'Create audio',
    description:
      'Prepare an original voice, dialogue batch, or sound layer while keeping rights and speech separate.',
    placeholder:
      'Describe the original voice or sound, delivery, emotion, timing, pronunciation, ambience, and review criteria.',
    choices: [
      {
        id: 'voice-design',
        label: 'Original voice proof',
        workflowId: 'qwen3-tts-voice-design',
        outputKind: 'voice-line'
      },
      {
        id: 'dialogue-lines',
        label: 'Dialogue line book',
        workflowId: 'qwen3-tts-line-book',
        outputKind: 'voice-line'
      },
      {
        id: 'foley',
        label: 'Ambience, effects, and foley',
        workflowId: 'rights-aware-foley-generation',
        outputKind: 'effect'
      }
    ]
  },
  composition: {
    title: 'Create a composition',
    description:
      'Prepare a storyboard composition from the approved story, look, and reusable production assets.',
    placeholder:
      'Describe subject placement, foreground and background, camera, lighting, depth, continuity, and the story beat this frame must communicate.',
    choices: [
      {
        id: 'story-composition',
        label: 'Storyboard composition',
        workflowId: 'qwen-image-character-board',
        outputKind: 'storyboard-frame'
      },
      {
        id: 'controlled-composition',
        label: 'Controlled composition',
        workflowId: 'qwen-image-controlled-board',
        outputKind: 'storyboard-frame'
      }
    ]
  }
}

function actions(project: ProjectDetails): Record<GuidedActionId, GuidedAction> {
  const format = project.manifest.type === 'series' ? 'series and first episode' : 'one-off film'
  const title = project.manifest.title
  return {
    plan: {
      id: 'plan',
      shortLabel: 'Story plan',
      eyebrow: 'First AI pass',
      title: 'Build the creative production plan',
      description:
        'AI will turn your source into a reviewable story direction, episode shape and practical roadmap.',
      taskKind: 'outline_episode',
      canonKind: 'series-bible',
      canonLabel: `${title} — approved production blueprint`,
      maximumOutputTokens: 8_000,
      instruction: `Act as the production manager for this ${format}. Use the creator's source and all approved canon. Prepare one comprehensive, reviewable production blueprint with: logline; audience and niche recommendation; genre, tone, themes and boundaries; complete plot structure; episode or film timing; cast needs; world needs; three feasible animation-style directions with one recommendation; voice and performance approach; storyboard strategy; image, LTX video, TTS, lip-sync, sound and editing approach; continuity risks; cultural and rights review flags; low-cost proof plan; full-production plan; and plain-language review decisions. Do not claim anything is approved. Clearly mark assumptions and questions.`
    },
    characters: {
      id: 'characters',
      shortLabel: 'Characters',
      eyebrow: 'Cast development',
      title: 'Develop the complete character cast',
      description:
        'AI will create a consistent cast book that can guide scripts, character boards, voices and future episodes.',
      taskKind: 'develop_character',
      canonKind: 'character',
      canonLabel: `${title} — approved character cast book`,
      maximumOutputTokens: 8_000,
      instruction: `Develop the complete recurring and episode-specific cast for ${title} from the approved production blueprint. For every character include story function, goals, fears, contradictions, relationships, arc, age presentation, silhouette, face and body identity anchors, palette, wardrobe and prop logic, expression range, movement language, original voice direction, pronunciation needs, forbidden identity drift and character-board views. Include a relationship map, multi-character scene rules, continuity risks, and creator decisions. Treat protected canon as binding. Do not imitate a real person or protected character.`
    },
    world: {
      id: 'world',
      shortLabel: 'World',
      eyebrow: 'World development',
      title: 'Build the world, locations and important props',
      description:
        'AI will define reusable environments and continuity rules before expensive images are made.',
      taskKind: 'build_world',
      canonKind: 'world',
      canonLabel: `${title} — approved world and location book`,
      maximumOutputTokens: 8_000,
      instruction: `Build the complete production world for ${title} from approved canon. Include world rules and physics; cultural and time setting; geography; recurring and episode locations; lighting, weather, palette and materials; location continuity anchors; important props and their state changes; scale references; environment-board views; reusable background strategy; sound ambience; rights and sensitivity flags; and creator decisions. Reconcile every detail with the plot and cast. Mark assumptions instead of inventing approval.`
    },
    script: {
      id: 'script',
      shortLabel: 'Screenplay',
      eyebrow: 'Screenplay',
      title: 'Write the production screenplay',
      description:
        'AI will use the approved story, characters and world to prepare a complete timed screenplay.',
      taskKind: 'draft_scene',
      canonKind: 'script',
      canonLabel: `${title} — approved production screenplay`,
      maximumOutputTokens: 12_000,
      instruction: `Write the complete production screenplay for ${title}. Treat every active approved canon record as binding. Cover the full target duration of ${project.manifest.targetDurationMinutes} minutes. Use numbered scenes with location and time, action, complete dialogue or narration, performance pauses, sound intent, transitions and target duration. Preserve identity, motivation, world physics, props, chronology, cultural boundaries and the approved ending. Do not return a synopsis. End with a validation section proving scene-duration arithmetic, character speaking roles, prop and continuity states, review flags and unresolved decisions. Shorten descriptive prose before cutting dialogue, scenes, timing or validation.`
    },
    storyboard: {
      id: 'storyboard',
      shortLabel: 'Storyboard',
      eyebrow: 'Pre-production',
      title: 'Create the shot-by-shot storyboard plan',
      description:
        'AI will translate the approved screenplay into reviewable shots before any GPU is started.',
      taskKind: 'plan_storyboard',
      canonKind: 'storyboard',
      canonLabel: `${title} — approved storyboard plan`,
      maximumOutputTokens: 12_000,
      instruction: `Create the complete shot-by-shot storyboard plan from the approved screenplay and all active canon. For every shot include scene and shot number, duration, story purpose, characters and locked identity state, location and continuity state, composition, camera, action, expression, dialogue or sound, transition, required reference assets, LTX motion intent and generation risks. Shot durations must reconcile to the approved screenplay and project target. Identify dialogue holds, expensive shots, continuity traps and opportunities to reuse approved environments. Return a reviewable plan only.`
    },
    look: {
      id: 'look',
      shortLabel: 'Animation look',
      eyebrow: 'Visual direction',
      title: 'Lock the animation look and image rules',
      description:
        'AI will turn the approved story world into practical character, environment and shot-generation direction.',
      taskKind: 'design_visual_generation',
      canonKind: 'visual-style',
      canonLabel: `${title} — approved animation look`,
      maximumOutputTokens: 8_000,
      instruction: `Design one production-feasible visual system for ${title} from all approved canon. Provide the recommended 2D, 3D-look or mixed animation treatment; shape language; line, texture, lighting and palette rules; character and environment rendering rules; camera and lens language; expression and motion readability; negative constraints; identity-preserving prompt blocks; character/style/environment/storyboard board specifications; reference hierarchy; seed and variation policy; LTX handoff rules; thumbnail compatibility; and a low-cost proof checklist. Explain tradeoffs in plain language. Do not claim an engine has reproduced the look until reviewed media proves it.`
    },
    voice: {
      id: 'voice',
      shortLabel: 'Voices',
      eyebrow: 'Performance direction',
      title: 'Design the original voices and dialogue plan',
      description:
        'AI will create reviewable voice directions, calibration lines and lip-sync guidance for the whole cast.',
      taskKind: 'design_voice_performance',
      canonKind: 'voice',
      canonLabel: `${title} — approved voice and performance book`,
      maximumOutputTokens: 8_000,
      instruction: `Create the original voice and performance book for every speaking character in ${title}. For each include vocal age presentation, range, texture, rhythm, energy, accent approach, emotional limits, pronunciation guide, safe calibration lines, performance notes, continuity anchors and forbidden drift. Include narrator rules where needed, dialogue segmentation for Qwen3-TTS, pause and emphasis markup guidance, language handling, voice-review criteria, audio-driven LTX and LatentSync handoff rules, room tone and retake policy. Do not clone or imitate a real person. Flag consent or rights decisions for creator review.`
    },
    release: {
      id: 'release',
      shortLabel: 'YouTube release',
      eyebrow: 'Release preparation',
      title: 'Prepare the YouTube release package',
      description:
        'AI will propose truthful titles, thumbnail concepts, description, chapters, captions and SEO without publishing anything.',
      taskKind: 'plan_youtube_release',
      canonKind: 'release-strategy',
      canonLabel: `${title} — approved release strategy`,
      maximumOutputTokens: 6_000,
      instruction: `Prepare a truthful YouTube release plan for ${title} using approved canon and available production evidence. Include title options, thumbnail concepts, description, chapter structure, keywords, audience positioning, accessibility and caption checks, disclosure and rights-review flags, and a pre-publication checklist. Do not fabricate performance evidence, policy compliance or rights clearance, and do not publish anything.`
    }
  }
}

function nextTextAction(flags: ProgressFlags): GuidedActionId | null {
  if (!flags.hasPlan) return 'plan'
  if (!flags.hasCharacter) return 'characters'
  if (!flags.hasWorld) return 'world'
  if (!flags.hasScript) return 'script'
  if (!flags.hasStoryboard) return 'storyboard'
  if (!flags.hasLook) return 'look'
  if (!flags.hasVoice) return 'voice'
  if (flags.hasMaster && !flags.hasRelease) return 'release'
  return null
}

function stageState(done: boolean, current: boolean): string {
  return done ? 'complete' : current ? 'current' : 'waiting'
}

function stageLabel(done: boolean, current: boolean): string {
  return done ? 'Approved' : current ? 'Next review' : 'Waiting'
}

export function CreatorMode({
  project,
  writingStatus,
  cloudStatus,
  onNavigate,
  onQuickCreate
}: {
  project: ProjectDetails
  writingStatus?: WritingSettingsStatus
  cloudStatus?: CloudConnectionStatus
  onNavigate(page: CreatorDestination): void
  onQuickCreate(intent: QuickCreateIntent): void
}): JSX.Element {
  const [workspace, setWorkspace] = useState<ProductionWorkspaceSummary>()
  const [finishWorkspace, setFinishWorkspace] = useState<FinishWorkspace>()
  const [draft, setDraft] = useState<WritingDraftRecord>()
  const [context, setContext] = useState<WritingContextPreview>()
  const [skillPlan, setSkillPlan] = useState<ExternalSkillPlanPreview>()
  const [selectedAction, setSelectedAction] = useState<GuidedActionId>('plan')
  const [changeRequest, setChangeRequest] = useState('')
  const [questionAnswers, setQuestionAnswers] = useState<string[]>([])
  const [canonConfirmed, setCanonConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(
    'Checking the production and choosing the next useful step…'
  )
  const [validationTitle, setValidationTitle] = useState('One confirmation is still needed')
  const [validationMode, setValidationMode] = useState<'correction' | 'status'>('correction')
  const [validationMessages, setValidationMessages] = useState<string[]>([])
  const [quickMode, setQuickMode] = useState<QuickCreateMode>('image')
  const [quickChoiceId, setQuickChoiceId] = useState(
    quickCreateDefinitions.image.choices[0]?.id ?? ''
  )
  const [quickLabel, setQuickLabel] = useState('')
  const [quickInstruction, setQuickInstruction] = useState('')
  const changeRequestRef = useRef<HTMLTextAreaElement>(null)

  const actionMap = useMemo(() => actions(project), [project])
  const activeCanon = workspace?.canon.filter((item) => item.state === 'active') ?? []
  const approvedMedia = workspace?.media.filter((item) => item.state === 'approved') ?? []
  const flags: ProgressFlags = {
    hasPlan: activeCanon.some((item) => ['series-bible', 'episode-outline'].includes(item.kind)),
    hasCharacter: activeCanon.some((item) => item.kind === 'character'),
    hasWorld: activeCanon.some((item) => ['world', 'location'].includes(item.kind)),
    hasScript: activeCanon.some((item) => item.kind === 'script'),
    hasStoryboard: activeCanon.some((item) => item.kind === 'storyboard'),
    hasLook: activeCanon.some((item) => item.kind === 'visual-style'),
    hasVoice: activeCanon.some((item) => item.kind === 'voice'),
    hasMaster: approvedMedia.some((item) => item.kind === 'master-video'),
    hasRelease: activeCanon.some((item) => item.kind === 'release-strategy')
  }
  const suggestedAction = nextTextAction(flags)
  const productionPending =
    flags.hasStoryboard && flags.hasLook && flags.hasVoice && !flags.hasMaster
  const productionComplete = flags.hasMaster && flags.hasRelease
  const action = actionMap[selectedAction]

  const chooseSuggestedAction = (result: ProductionWorkspaceSummary): GuidedActionId => {
    const canon = result.canon.filter((item) => item.state === 'active')
    const media = result.media.filter((item) => item.state === 'approved')
    return (
      nextTextAction({
        hasPlan: canon.some((item) => ['series-bible', 'episode-outline'].includes(item.kind)),
        hasCharacter: canon.some((item) => item.kind === 'character'),
        hasWorld: canon.some((item) => ['world', 'location'].includes(item.kind)),
        hasScript: canon.some((item) => item.kind === 'script'),
        hasStoryboard: canon.some((item) => item.kind === 'storyboard'),
        hasLook: canon.some((item) => item.kind === 'visual-style'),
        hasVoice: canon.some((item) => item.kind === 'voice'),
        hasMaster: media.some((item) => item.kind === 'master-video'),
        hasRelease: canon.some((item) => item.kind === 'release-strategy')
      }) ?? 'voice'
    )
  }

  const reload = async (keepCurrentAction = false): Promise<void> => {
    const [result, finish] = await Promise.all([
      window.studio.production.getWorkspace(project.manifest.id),
      window.studio.finish.getWorkspace(project.manifest.id)
    ])
    setWorkspace(result)
    setFinishWorkspace(finish)
    if (!keepCurrentAction) {
      setContext(undefined)
      setSkillPlan(undefined)
      setSelectedAction(chooseSuggestedAction(result))
    }
  }

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      window.studio.production.getWorkspace(project.manifest.id),
      window.studio.finish.getWorkspace(project.manifest.id)
    ])
      .then(([result, finish]) => {
        if (cancelled) return
        setWorkspace(result)
        setFinishWorkspace(finish)
        setSelectedAction(chooseSuggestedAction(result))
        setMessage('Ready. AI will prepare the next stage and keep every result reviewable.')
      })
      .catch(() =>
        setMessage('The production summary needs attention. Existing work was not changed.')
      )
    return () => {
      cancelled = true
    }
  }, [project.manifest.id])

  useEffect(() => {
    if (productionPending || productionComplete) {
      return
    }
    let cancelled = false
    void Promise.all([
      window.studio.writing.previewContext({
        projectId: project.manifest.id,
        context: {
          includeProjectBrief: true,
          includeProductionSettings: true,
          includeCreativeDirection: true,
          includeApprovedCanon: true
        }
      }),
      window.studio.skills.previewPlan({
        projectId: project.manifest.id,
        taskKind: action.taskKind
      })
    ])
      .then(([nextContext, nextPlan]) => {
        if (!cancelled) {
          setContext(nextContext)
          setSkillPlan(nextPlan)
        }
      })
      .catch(() => {
        if (!cancelled)
          setMessage('The AI preparation context needs attention. No request was sent.')
      })
    return () => {
      cancelled = true
    }
  }, [action.taskKind, productionComplete, productionPending, project.manifest.id])

  const candidates = useMemo(() => {
    if (!writingStatus) return []
    const connected = providerOrder.filter(
      (provider) => writingStatus.providers[provider].connectionState === 'connected'
    )
    const preferred = writingStatus.defaultProfile?.provider
    const orderedProviders =
      preferred && connected.includes(preferred)
        ? [preferred, ...connected.filter((item) => item !== preferred)]
        : connected
    return orderedProviders.flatMap((provider) => {
      const models = writingStatus.providers[provider].models
      const preferredModel =
        writingStatus.defaultProfile?.provider === provider
          ? writingStatus.defaultProfile.model
          : undefined
      return [...models]
        .sort((left, right) =>
          left.id === preferredModel ? -1 : right.id === preferredModel ? 1 : 0
        )
        .map((model) => ({ provider, model: model.id, label: model.displayName }))
    })
  }, [writingStatus])

  const selectAction = (id: GuidedActionId): void => {
    setContext(undefined)
    setSkillPlan(undefined)
    setSelectedAction(id)
    setDraft(undefined)
    setQuestionAnswers([])
    setCanonConfirmed(false)
    setMessage(
      id === suggestedAction
        ? 'This is the studio’s recommended next stage.'
        : 'You are revisiting an earlier approved stage. A new approval will create a new revision.'
    )
  }

  const generate = async (): Promise<void> => {
    if (!context || !skillPlan?.ready || candidates.length === 0) {
      setMessage(
        candidates.length === 0
          ? 'Connect GPT, Claude, or Gemini once in Settings.'
          : 'The protected project context is not ready yet.'
      )
      return
    }
    setValidationMessages([])
    setBusy(true)
    setDraft(undefined)
    setQuestionAnswers([])
    setCanonConfirmed(false)
    setMessage('AI is preparing a reviewable production stage…')
    const instruction = [
      action.instruction,
      changeRequest.trim() ? `CREATOR CHANGE REQUEST:\n${changeRequest.trim()}` : '',
      'Use plain language. Put the strongest complete deliverable in clearly named sections. Mark assumptions and decisions needing creator review.'
    ]
      .filter(Boolean)
      .join('\n\n')
    let lastMessage = 'No connected writing model completed the request.'
    for (const candidate of candidates) {
      try {
        const result = await window.studio.writing.generateDraft({
          projectId: project.manifest.id,
          taskKind: action.taskKind,
          instruction,
          context: {
            includeProjectBrief: true,
            includeProductionSettings: true,
            includeCreativeDirection: true,
            includeApprovedCanon: true
          },
          provider: candidate.provider,
          model: candidate.model,
          profile: 'best-draft',
          maxOutputTokens: action.maximumOutputTokens,
          skillPlanSha256: skillPlan.planSha256,
          paidConfirmed: true
        })
        if (result.ok) {
          setDraft(result.draft)
          setQuestionAnswers(result.draft.output.continuityQuestions.map(() => ''))
          setChangeRequest('')
          await reload(true)
          setMessage(
            `Draft prepared with ${candidate.label}. Review it below; nothing has become canon.`
          )
          setBusy(false)
          return
        }
        lastMessage = result.error.message
        if (
          !['provider-unavailable', 'timed-out', 'rate-limited', 'unsupported-model'].includes(
            result.error.code
          )
        ) {
          break
        }
      } catch {
        lastMessage = 'A writing service could not be reached. No local proposal was changed.'
      }
    }
    setMessage(lastMessage)
    setBusy(false)
  }

  const approve = async (): Promise<void> => {
    if (!draft || !canonConfirmed || !workspace) {
      setValidationMode('correction')
      setValidationTitle('Review this exact proposal first')
      setValidationMessages(['Confirm that you reviewed this exact proposal and approve it.'])
      return
    }
    const fingerprint = workspace.draftFingerprints.find((item) => item.draftId === draft.draftId)
    if (!fingerprint) {
      setMessage('The proposal fingerprint needs to be refreshed before approval.')
      await reload(true)
      return
    }
    setValidationMessages([])
    setBusy(true)
    const result = await window.studio.production.promoteDraft({
      projectId: project.manifest.id,
      draftId: draft.draftId,
      expectedDraftSha256: fingerprint.sha256,
      kind: action.canonKind,
      label: action.canonLabel,
      reason:
        'The creator reviewed this exact guided-stage proposal and approved it for downstream production.',
      confirmation: true
    })
    if (result.ok) {
      setDraft(undefined)
      setQuestionAnswers([])
      setCanonConfirmed(false)
      await reload(false)
      setMessage(
        `Approved as ${result.canon.kind} canon, revision ${result.canon.revision}. The next stage is ready.`
      )
    } else {
      setMessage(result.error.message)
    }
    setBusy(false)
  }

  const prepareQuestionRevision = (): void => {
    if (!draft) return
    const unanswered = draft.output.continuityQuestions
      .map((_, index) => index)
      .filter((index) => !questionAnswers[index]?.trim())
    if (unanswered.length > 0) {
      setValidationMode('correction')
      setValidationTitle('Answer every question or let AI recommend')
      setValidationMessages(
        unanswered.map(
          (index) => `Question ${index + 1} still needs your answer or “Let AI recommend”.`
        )
      )
      return
    }

    const answers = draft.output.continuityQuestions
      .map(
        (question, index) =>
          `QUESTION ${index + 1}: ${question}\nCREATOR DECISION: ${questionAnswers[index].trim()}`
      )
      .join('\n\n')
    setValidationMessages([])
    setChangeRequest(
      [
        'Revise the proposal to resolve every question below. Treat direct creator answers as binding. Where the creator asks AI to recommend, choose the safest canon-consistent option, explain it plainly, and make the chosen rule explicit in the revised proposal.',
        answers
      ]
        .join('\n\n')
        .slice(0, 4_000)
    )
    setCanonConfirmed(false)
    setMessage(
      'Your answers are ready for a revision. Review the change request above, then create the revised stage.'
    )
    changeRequestRef.current?.focus()
  }

  const canOpenAction = (id: GuidedActionId): boolean => {
    if (id === 'plan') return true
    if (['characters', 'world'].includes(id)) return flags.hasPlan
    if (id === 'script') return flags.hasCharacter && flags.hasWorld
    if (id === 'storyboard') return flags.hasScript
    if (['look', 'voice'].includes(id)) return flags.hasStoryboard
    return flags.hasMaster
  }

  const hasCharacterProof = approvedMedia.some((item) =>
    ['character-board', 'style-board', 'environment-board'].includes(item.kind)
  )
  const hasVoiceProof = approvedMedia.some((item) => item.kind === 'voice-line')
  const hasMotionProof = approvedMedia.some((item) =>
    ['animatic', 'video-take'].includes(item.kind)
  )
  const activeJobCount =
    workspace?.jobs.filter(
      (job) => !['succeeded', 'failed', 'cancelled', 'terminated'].includes(job.state)
    ).length ?? 0
  const accountConnected = cloudStatus?.setupChecklist.accountConnected === true
  const guardrailsSaved = cloudStatus?.setupChecklist.guardrailsSaved === true
  const creatorSetupComplete = accountConnected && guardrailsSaved
  const openProductionNext = (): void => {
    if (!cloudStatus) {
      setValidationMode('status')
      setValidationTitle('Production setup is still being checked')
      setValidationMessages(['Wait a moment, then try again. No GPU has been started.'])
      return
    }
    if (cloudStatus.generationState === 'ready') {
      onNavigate('generate')
      return
    }
    if (!accountConnected || !guardrailsSaved) {
      onNavigate('settings')
      return
    }
    setValidationMode('status')
    setValidationTitle('Your setup steps are complete')
    setValidationMessages([
      'You do not need to create a Pod or change another setting.',
      cloudStatus.generationReason,
      'The studio-managed model storage, worker verification, and automatic shutdown proof must finish before paid generation can be offered.'
    ])
  }
  const castAndWorldDone = flags.hasCharacter && flags.hasWorld
  const lookAndVoiceDone = flags.hasLook && flags.hasVoice
  const stageData = [
    { label: 'Story plan', done: flags.hasPlan, current: !flags.hasPlan },
    {
      label: 'Characters & world',
      done: castAndWorldDone,
      current: flags.hasPlan && !castAndWorldDone
    },
    {
      label: 'Screenplay',
      done: flags.hasScript,
      current: castAndWorldDone && !flags.hasScript
    },
    {
      label: 'Storyboard',
      done: flags.hasStoryboard,
      current: flags.hasScript && !flags.hasStoryboard
    },
    {
      label: 'Voices & look',
      done: lookAndVoiceDone,
      current: flags.hasStoryboard && !lookAndVoiceDone
    },
    {
      label: 'Production',
      done: flags.hasMaster,
      current: lookAndVoiceDone && !flags.hasMaster
    },
    {
      label: 'Release',
      done: flags.hasRelease,
      current: flags.hasMaster && !flags.hasRelease
    }
  ]
  const completedStageCount = stageData.filter((stage) => stage.done).length
  const currentStageNumber = Math.min(completedStageCount + 1, stageData.length)
  const primaryCandidate = candidates[0]
  const hasStoryboardFrames = approvedMedia.some((item) => item.kind === 'storyboard-frame')
  const hasVideoShots = approvedMedia.some((item) => item.kind === 'video-take')
  const hasLockedTimeline =
    finishWorkspace?.timelines.some((timeline) => timeline.state === 'locked') === true
  const hasCaptions = approvedMedia.some((item) => item.kind === 'caption')
  const storyPackageDone =
    flags.hasPlan &&
    flags.hasCharacter &&
    flags.hasWorld &&
    flags.hasScript &&
    flags.hasStoryboard &&
    flags.hasLook &&
    flags.hasVoice
  const pipelineChecks = [
    {
      label: 'Story package',
      description: 'Story, cast, world, screenplay, shot plan, look, and voice direction approved.',
      done: storyPackageDone
    },
    {
      label: 'Character & location references',
      description: 'Reusable visual identity and environment references reviewed and approved.',
      done: hasCharacterProof
    },
    {
      label: 'Storyboard frames',
      description: 'Approved frames give every shot a stable visual starting point.',
      done: hasStoryboardFrames
    },
    {
      label: 'Voices & dialogue',
      description: 'Original voice proofs and spoken lines are generated and reviewed separately.',
      done: hasVoiceProof
    },
    {
      label: 'Video shots',
      description: 'Short LTX takes are generated from approved frames, then selected in review.',
      done: hasVideoShots
    },
    {
      label: 'Edit, sound & captions',
      description: 'Approved picture and audio are assembled locally on a locked timeline.',
      done: hasLockedTimeline && hasCaptions
    },
    {
      label: 'Verified master',
      description: 'The final delivery-profile video passes review before release packaging.',
      done: flags.hasMaster
    },
    {
      label: 'Worker cleanup',
      description: 'No production job or rented GPU remains active after the master is recovered.',
      done: flags.hasMaster && activeJobCount === 0 && (cloudStatus?.account?.activePods ?? 0) === 0
    }
  ]
  const currentPipelineIndex = pipelineChecks.findIndex((stage) => !stage.done)
  const pipelineRunData = pipelineChecks.map((stage, index) => ({
    ...stage,
    current: index === currentPipelineIndex
  }))
  const quickDefinition = quickMode === 'stitch' ? null : quickCreateDefinitions[quickMode]
  const selectedQuickChoice = quickDefinition?.choices.find((choice) => choice.id === quickChoiceId)
  const quickAvailability = (() => {
    if (quickMode === 'image') {
      return {
        ready: flags.hasCharacter && flags.hasWorld && flags.hasLook,
        reason: 'Approve the cast, world, and animation look first.'
      }
    }
    if (quickMode === 'composition') {
      return {
        ready: flags.hasStoryboard && flags.hasLook,
        reason: 'Approve the storyboard and animation look first.'
      }
    }
    if (quickMode === 'audio') {
      return {
        ready: flags.hasVoice,
        reason: 'Approve the original voice and performance direction first.'
      }
    }
    if (quickMode === 'video') {
      return {
        ready: flags.hasStoryboard && flags.hasLook && flags.hasVoice && hasCharacterProof,
        reason: 'Approve the storyboard, look, voice direction, and a visual reference first.'
      }
    }
    return {
      ready: approvedMedia.length > 0,
      reason: 'Approve at least one image, audio, or video asset before assembling it.'
    }
  })()

  const selectQuickMode = (mode: QuickCreateMode): void => {
    setQuickMode(mode)
    const definition = mode === 'stitch' ? null : quickCreateDefinitions[mode]
    setQuickChoiceId(definition?.choices[0]?.id ?? '')
    setQuickLabel('')
    setQuickInstruction('')
  }

  const openQuickTool = (): void => {
    if (!quickAvailability.ready) {
      setValidationMode('status')
      setValidationTitle('This one-off tool is not ready yet')
      setValidationMessages([
        quickAvailability.reason,
        'Continue the recommended production step above; completed work will be reused automatically.'
      ])
      return
    }
    if (quickMode === 'stitch') {
      onQuickCreate({
        mode: 'stitch',
        workflowId: null,
        outputKind: null,
        label: quickLabel.trim() || `${project.manifest.title} assembly`,
        instruction: 'Assemble approved local picture, dialogue, sound, and captions.'
      })
      return
    }
    if (!selectedQuickChoice || quickLabel.trim().length < 3) {
      setValidationMode('correction')
      setValidationTitle('Name the asset before continuing')
      setValidationMessages(['Use a clear asset name containing at least 3 characters.'])
      return
    }
    if (quickInstruction.trim().length < 10) {
      setValidationMode('correction')
      setValidationTitle('Describe the asset before continuing')
      setValidationMessages(['Add at least 10 characters of creative direction.'])
      return
    }
    onQuickCreate({
      mode: quickMode,
      workflowId: selectedQuickChoice.workflowId,
      outputKind: selectedQuickChoice.outputKind,
      label: quickLabel.trim(),
      instruction: quickInstruction.trim()
    })
  }

  return (
    <div className="creator-mode">
      <section className="creator-hero">
        <div>
          <p className="creator-kicker">
            <span>Production run</span>
            <small>{project.manifest.title}</small>
          </p>
          <h1>Continue from the next unfinished production step.</h1>
          <p>
            The studio carries approved story and media forward, saves every checkpoint, and keeps
            the GPU off until a qualified job has a reviewed cost and separate start confirmation.
          </p>
        </div>
        <div className="creator-safety-summary">
          <strong>
            {cloudStatus?.account?.activePods
              ? `${cloudStatus.account.activePods} GPU active`
              : 'GPU is off'}
          </strong>
          <span>
            {activeCanon.length} approved canon records · {approvedMedia.length} approved media
            items
          </span>
        </div>
      </section>

      <details className="creator-run-overview">
        <summary>
          <span>
            <strong>View the complete production run</strong>
            <small>Story package to verified master and worker cleanup</small>
          </span>
          <span aria-hidden="true">⌄</span>
        </summary>
        <div className="creator-run-grid" aria-label="Complete production run">
          {pipelineRunData.map((stage, index) => (
            <article className={stageState(stage.done, stage.current)} key={stage.label}>
              <span>{stage.done ? '✓' : index + 1}</span>
              <div>
                <strong>{stage.label}</strong>
                <small>{stage.description}</small>
                <em>{stageLabel(stage.done, stage.current)}</em>
              </div>
            </article>
          ))}
        </div>
        <p>
          A failed or interrupted job keeps its approved inputs and outputs. Reopening this project
          resumes from the first incomplete checkpoint instead of rebuilding earlier work.
        </p>
      </details>

      <section className="creator-progress-compact" aria-label="Production progress">
        <div className="creator-progress-current">
          <span>
            Creative approvals · step {currentStageNumber} of {stageData.length}
          </span>
          <strong>{stageData[currentStageNumber - 1]?.label ?? 'Complete'}</strong>
        </div>
        <div
          className="creator-progress-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={stageData.length}
          aria-valuenow={completedStageCount}
        >
          <span style={{ width: `${(completedStageCount / stageData.length) * 100}%` }} />
        </div>
        <details>
          <summary>View all steps</summary>
          <div className="creator-progress">
            {stageData.map((stage, index) => (
              <article className={stageState(stage.done, stage.current)} key={stage.label}>
                <span>{stage.done ? '✓' : index + 1}</span>
                <div>
                  <strong>{stage.label}</strong>
                  <small>{stageLabel(stage.done, stage.current)}</small>
                </div>
              </article>
            ))}
          </div>
        </details>
      </section>

      <div className="creator-layout">
        <main>
          {!productionPending && !productionComplete && (
            <section className="creator-next-card">
              <span className="creator-card-handle" aria-hidden="true" />
              <div className="creator-next-heading">
                <div>
                  <p className="eyebrow">Next production step</p>
                  <h2>{action.title}</h2>
                  <p>{action.description}</p>
                </div>
              </div>
              <div className="creator-source-note">
                <span aria-hidden="true">✦</span>
                <strong>Your story and approved work are added automatically.</strong>
              </div>
              <details className="creator-revisit">
                <summary>Choose a different available step</summary>
                <div className="creator-action-picker" role="group" aria-label="Production stage">
                  {textActionOrder.filter(canOpenAction).map((id) => (
                    <button
                      type="button"
                      key={id}
                      className={selectedAction === id ? 'selected' : ''}
                      onClick={() => selectAction(id)}
                    >
                      {actionMap[id].shortLabel}
                    </button>
                  ))}
                </div>
              </details>
              {candidates.length === 0 ? (
                <div className="creator-connection-needed">
                  <div>
                    <strong>Connect a writing service once</strong>
                    <p>Gemini, GPT, or Claude can prepare this step. No GPU is needed.</p>
                  </div>
                  <button className="button button-primary" onClick={() => onNavigate('settings')}>
                    Open connections
                  </button>
                </div>
              ) : (
                <>
                  <label className="creator-change-request">
                    <span>
                      Anything to change? <small>(optional)</small>
                    </span>
                    <textarea
                      ref={changeRequestRef}
                      value={changeRequest}
                      maxLength={4000}
                      onChange={(event) => setChangeRequest(event.target.value)}
                      placeholder="Example: Make the ending more hopeful."
                    />
                  </label>
                  <div className="creator-billing-note">
                    <span aria-hidden="true">i</span>
                    <p>
                      Uses {primaryCandidate?.label ?? 'your saved writing service'}. This text
                      request may be billed. No GPU starts.
                      {candidates.length > 1
                        ? ` If it is unavailable, up to ${candidates.length - 1} connected fallback ${candidates.length === 2 ? 'service may' : 'services may'} be tried and billed.`
                        : ''}
                    </p>
                  </div>
                  <button
                    className="button button-primary button-large creator-build-button"
                    disabled={busy}
                    onClick={() => void generate()}
                  >
                    {busy ? 'Preparing your draft…' : `Create ${action.shortLabel.toLowerCase()} →`}
                  </button>
                </>
              )}
              <div className="creator-message" role="status">
                {message}
              </div>
            </section>
          )}

          {productionPending && (
            <section className="creator-next-card creator-production-card">
              <span className="creator-card-handle" aria-hidden="true" />
              <div className="creator-next-heading">
                <div>
                  <p className="eyebrow">Visual and audio production</p>
                  <h2>Make a small proof before the full episode</h2>
                  <p>
                    The creative decisions are ready. The studio now uses approved character, look,
                    voice and storyboard records to prepare image, TTS, LTX motion and lip-sync
                    work.
                  </p>
                </div>
                <span
                  className={`status-chip ${cloudStatus?.generationState === 'ready' ? 'local' : 'locked'}`}
                >
                  {cloudStatus?.generationState === 'ready'
                    ? 'Ready to estimate'
                    : 'Setup protected'}
                </span>
              </div>
              <div className="creator-proof-list">
                {[
                  ['Character and style proof', hasCharacterProof],
                  ['Original voice proof', hasVoiceProof],
                  ['Short motion and lip-sync proof', hasMotionProof],
                  ['Approved episode master', flags.hasMaster]
                ].map(([label, done], index) => (
                  <div
                    className={
                      done ? 'complete' : index === 0 && !hasCharacterProof ? 'current' : ''
                    }
                    key={String(label)}
                  >
                    <span>{done ? '✓' : index + 1}</span>
                    <strong>{label}</strong>
                    <small>{done ? 'Approved' : 'Still needed'}</small>
                  </div>
                ))}
              </div>
              {activeJobCount > 0 && (
                <div className="creator-message" role="status">
                  {activeJobCount} production {activeJobCount === 1 ? 'job needs' : 'jobs need'}
                  review or attention.
                </div>
              )}
              <div className="creator-production-actions">
                <button className="button button-secondary" onClick={() => onNavigate('review')}>
                  Review existing images, audio and video
                </button>
                <button className="button button-primary button-large" onClick={openProductionNext}>
                  {cloudStatus?.generationState === 'ready'
                    ? 'Prepare the next proof →'
                    : !accountConnected
                      ? 'Connect RunPod safely →'
                      : !guardrailsSaved
                        ? 'Save spending limits →'
                        : 'View protected setup status'}
                </button>
              </div>
              {cloudStatus?.generationState !== 'ready' && (
                <div className="creator-readiness-panel" role="status">
                  <div>
                    <strong>
                      {creatorSetupComplete
                        ? 'Your one-time setup steps are complete'
                        : 'Complete only the highlighted creator steps'}
                    </strong>
                    <p>
                      {creatorSetupComplete
                        ? 'The remaining checks are prepared by the studio. You do not need to create a Pod.'
                        : 'Connecting the account and saving spending limits cannot rent a GPU.'}
                    </p>
                  </div>
                  <details>
                    <summary>View setup checks</summary>
                    <ul aria-label="Production readiness">
                      <li className={accountConnected ? 'complete' : 'current'}>
                        <span>{accountConnected ? '✓' : '1'}</span>
                        RunPod connection
                      </li>
                      <li className={guardrailsSaved ? 'complete' : 'current'}>
                        <span>{guardrailsSaved ? '✓' : '2'}</span>
                        Spending limits
                      </li>
                      <li
                        className={cloudStatus?.setupChecklist.modelStorageReady ? 'complete' : ''}
                      >
                        <span>{cloudStatus?.setupChecklist.modelStorageReady ? '✓' : '3'}</span>
                        Studio model storage
                      </li>
                      <li
                        className={cloudStatus?.setupChecklist.workerImageReady ? 'complete' : ''}
                      >
                        <span>{cloudStatus?.setupChecklist.workerImageReady ? '✓' : '4'}</span>
                        Image, voice, motion and lip-sync worker
                      </li>
                      <li
                        className={
                          cloudStatus?.setupChecklist.automaticShutdownTested ? 'complete' : ''
                        }
                      >
                        <span>
                          {cloudStatus?.setupChecklist.automaticShutdownTested ? '✓' : '5'}
                        </span>
                        Automatic shutdown proof
                      </li>
                    </ul>
                    <p className="creator-readiness-reason">
                      {cloudStatus?.generationReason ?? 'Production readiness is being checked.'}
                    </p>
                  </details>
                </div>
              )}
              <p className="creator-fine-print">
                Opening setup or preparing an estimate does not rent a GPU. Starting paid generation
                still requires an exact cost approval and a separate start confirmation.
              </p>
            </section>
          )}

          {productionComplete && (
            <section className="creator-next-card creator-complete-card">
              <span className="creator-card-handle" aria-hidden="true" />
              <p className="eyebrow">Production path complete</p>
              <h2>Your approved master and release strategy are ready for final checks.</h2>
              <p>
                Review the full watch, captions, thumbnail, rights, audience and disclosure
                decisions before creating the local YouTube package. The studio will not publish
                automatically.
              </p>
              <button
                className="button button-primary button-large"
                onClick={() => onNavigate('edit')}
              >
                Finish and export →
              </button>
            </section>
          )}

          {draft && (
            <section className="creator-proposal">
              <div className="creator-proposal-heading">
                <div>
                  <p className="eyebrow">Draft · not approved yet</p>
                  <h2>{draft.output.title}</h2>
                  <p>{draft.output.summary}</p>
                </div>
                <span>Review first</span>
              </div>
              <div className="creator-review-sections">
                {draft.output.sections.map((section) => (
                  <details key={section.heading}>
                    <summary>{section.heading}</summary>
                    <p>{section.body}</p>
                  </details>
                ))}
              </div>
              {draft.output.continuityQuestions.length > 0 && (
                <div className="creator-questions">
                  <strong>Questions and cautions</strong>
                  <p>
                    These are creative decisions, not technical tasks. Answer in your own words or
                    ask AI to recommend; the studio will prepare a revised proposal before anything
                    becomes canon.
                  </p>
                  <div className="creator-question-list">
                    {draft.output.continuityQuestions.map((question, index) => (
                      <section className="creator-question-item" key={`${index}-${question}`}>
                        <p>
                          <span>{index + 1}</span>
                          <strong>{question}</strong>
                        </p>
                        <label htmlFor={`creator-question-${index}`}>
                          Your answer <RequiredMark />
                        </label>
                        <textarea
                          id={`creator-question-${index}`}
                          value={questionAnswers[index] ?? ''}
                          maxLength={600}
                          onChange={(event) =>
                            setQuestionAnswers((current) => {
                              const next = [...current]
                              next[index] = event.target.value
                              return next
                            })
                          }
                          placeholder="Write a short decision in plain language."
                        />
                        <div>
                          <small>{questionAnswers[index]?.length ?? 0} / 600 characters</small>
                          <button
                            className="text-button"
                            type="button"
                            onClick={() =>
                              setQuestionAnswers((current) => {
                                const next = [...current]
                                next[index] =
                                  'Let AI recommend the safest canon-consistent option and explain it in plain language.'
                                return next
                              })
                            }
                          >
                            Let AI recommend
                          </button>
                        </div>
                      </section>
                    ))}
                  </div>
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={prepareQuestionRevision}
                  >
                    Use these answers in a revision →
                  </button>
                </div>
              )}
              <label className="creator-confirmation approve">
                <input
                  type="checkbox"
                  checked={canonConfirmed}
                  onChange={(event) => setCanonConfirmed(event.target.checked)}
                />
                <span>
                  I reviewed this exact proposal and approve it for the next production stages.{' '}
                  <RequiredMark />
                </span>
              </label>
              <div className="creator-proposal-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => {
                    setChangeRequest('')
                    changeRequestRef.current?.focus()
                  }}
                >
                  Request changes
                </button>
                <button
                  className="button button-primary"
                  disabled={busy}
                  onClick={() => void approve()}
                >
                  Approve this stage →
                </button>
              </div>
            </section>
          )}
        </main>
      </div>

      <details className="creator-one-off-tool">
        <summary>
          <span>
            <strong>Create or repair one production asset</strong>
            <small>Image, video, audio, composition, or local assembly</small>
          </span>
          <span aria-hidden="true">⌄</span>
        </summary>
        <div className="creator-one-off-body">
          <p>
            Use this only when one asset needs a variation or repair. The full production run above
            remains the recommended path.
          </p>
          <div className="creator-one-off-modes" role="group" aria-label="One-off asset type">
            {(['image', 'video', 'audio', 'composition', 'stitch'] as const).map((mode) => (
              <button
                type="button"
                className={quickMode === mode ? 'selected' : ''}
                key={mode}
                onClick={() => selectQuickMode(mode)}
              >
                {mode === 'stitch' ? 'Assemble' : `${mode[0]?.toUpperCase()}${mode.slice(1)}`}
              </button>
            ))}
          </div>

          {quickDefinition ? (
            <div className="creator-one-off-form">
              <div>
                <strong>{quickDefinition.title}</strong>
                <p>{quickDefinition.description}</p>
              </div>
              <label>
                Asset type
                <select
                  aria-label="One-off asset type choice"
                  value={quickChoiceId}
                  onChange={(event) => setQuickChoiceId(event.target.value)}
                >
                  {quickDefinition.choices.map((choice) => (
                    <option value={choice.id} key={choice.id}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Asset name
                <input
                  value={quickLabel}
                  maxLength={240}
                  onChange={(event) => setQuickLabel(event.target.value)}
                  placeholder="Example: Rooftop farewell — wide shot"
                />
              </label>
              <label>
                Creative direction
                <textarea
                  value={quickInstruction}
                  maxLength={4_000}
                  onChange={(event) => setQuickInstruction(event.target.value)}
                  placeholder={quickDefinition.placeholder}
                />
              </label>
            </div>
          ) : (
            <div className="creator-one-off-form">
              <div>
                <strong>Assemble approved material</strong>
                <p>
                  Open the local finishing room with the production name prepared. No rented GPU is
                  used for timeline, caption, or master assembly.
                </p>
              </div>
              <label>
                Timeline name <small>(optional)</small>
                <input
                  value={quickLabel}
                  maxLength={240}
                  onChange={(event) => setQuickLabel(event.target.value)}
                  placeholder={`${project.manifest.title} rough cut`}
                />
              </label>
            </div>
          )}

          <div className={`creator-one-off-readiness ${quickAvailability.ready ? 'ready' : ''}`}>
            <span aria-hidden="true">{quickAvailability.ready ? '✓' : 'i'}</span>
            <p>
              <strong>
                {quickAvailability.ready ? 'Approved inputs are available' : 'Not ready yet'}
              </strong>
              <small>
                {quickAvailability.ready
                  ? quickMode === 'stitch'
                    ? 'The local assembly room can be opened without renting a GPU.'
                    : 'The next screen still requires approved references, an estimate, exact cost approval, and a separate start.'
                  : quickAvailability.reason}
              </small>
            </p>
          </div>
          <button className="button button-secondary" type="button" onClick={openQuickTool}>
            {quickMode === 'stitch' ? 'Open local assembly →' : `Prepare one ${quickMode} →`}
          </button>
        </div>
      </details>
      <ValidationAlert
        title={validationTitle}
        eyebrow={validationMode === 'status' ? 'Production status' : 'Before continuing'}
        description={
          validationMode === 'status'
            ? 'Nothing was submitted, changed, or charged. Current status:'
            : 'Nothing was submitted or charged. Please correct the following:'
        }
        closeLabel={validationMode === 'status' ? 'Close' : 'Go back and fix'}
        messages={validationMessages}
        onClose={() => setValidationMessages([])}
      />
    </div>
  )
}
