import { useCallback, useEffect, useMemo, useState, type FormEvent, type JSX } from 'react'
import {
  type FinishWorkspace,
  type LocalMediaRuntimeStatus,
  type MediaAssetView,
  type ProductionTimeline,
  type ProductionWorkspaceSummary,
  type ProjectDetails,
  type ReleaseDetails
} from '@studio/contracts'
import { RequiredMark, TextRequirement, ValidationAlert } from './FormGuidance'
import { IdeaAssistant } from './IdeaAssistant'
import { ProductionReadinessStrip } from './ProductionRooms'
import { ReleasePlanningPanel } from './ReleasePlanningPanel'

const crockford = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function browserUlid(): string {
  let time = Date.now()
  let prefix = ''
  for (let index = 0; index < 10; index += 1) {
    prefix = crockford[time % 32] + prefix
    time = Math.floor(time / 32)
  }
  const random = crypto.getRandomValues(new Uint8Array(16))
  return `${prefix}${[...random]
    .map((value) => crockford[value % 32])
    .join('')
    .slice(0, 16)}`
}

function seconds(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed * 1000) : 0
}

function parseCsv(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ]
}

function parseCaptions(value: string): Array<{
  cueId: string
  startMs: number
  endMs: number
  text: string
}> {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [start, end, ...text] = line.split('|')
      return {
        cueId: browserUlid(),
        startMs: seconds(start ?? ''),
        endMs: seconds(end ?? ''),
        text: text.join('|').trim()
      }
    })
}

function latestDraft(workspace?: FinishWorkspace): ProductionTimeline | undefined {
  return workspace?.timelines.find((timeline) => timeline.state === 'draft')
}

function approvedByKind(
  production: ProductionWorkspaceSummary | undefined,
  kinds: MediaAssetView['kind'][]
): MediaAssetView[] {
  return (
    production?.media.filter((asset) => asset.state === 'approved' && kinds.includes(asset.kind)) ??
    []
  )
}

function Readiness({ finish }: { finish?: FinishWorkspace }): JSX.Element {
  if (!finish) return <div className="settings-card backup-empty">Checking release readiness…</div>
  return (
    <section className={`release-readiness ${finish.blockers.length ? 'blocked' : 'ready'}`}>
      <div>
        <p className="eyebrow">Release readiness</p>
        <h2>
          {finish.blockers.length
            ? `${finish.blockers.length} decisions remain`
            : 'Manual upload package can be locked'}
        </h2>
      </div>
      {finish.blockers.length ? (
        <ul>
          {finish.blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      ) : (
        <span className="status-chip local">All recorded gates passed</span>
      )}
    </section>
  )
}

export function FinishRoom({
  project,
  onHome,
  onReview
}: {
  project: ProjectDetails
  onHome(): void
  onReview(): void
}): JSX.Element {
  const [production, setProduction] = useState<ProductionWorkspaceSummary>()
  const [finish, setFinish] = useState<FinishWorkspace>()
  const [localMedia, setLocalMedia] = useState<LocalMediaRuntimeStatus>()
  const [selectedVisuals, setSelectedVisuals] = useState<string[]>([])
  const [selectedAudio, setSelectedAudio] = useState<string[]>([])
  const [clipSeconds, setClipSeconds] = useState(5)
  const [timelineLabel, setTimelineLabel] = useState('Episode rough cut')
  const [captionSource, setCaptionSource] = useState('0|2|Opening caption')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Film & Animation')
  const [playlist, setPlaylist] = useState('')
  const [tags, setTags] = useState('animation')
  const [hashtags, setHashtags] = useState('#Animation')
  const [credits, setCredits] = useState('')
  const [endScreenNotes, setEndScreenNotes] = useState('')
  const [madeForKids, setMadeForKids] = useState<'' | 'yes' | 'no'>('')
  const [syntheticDisclosure, setSyntheticDisclosure] = useState<'' | 'yes' | 'no'>('')
  const [truthful, setTruthful] = useState(false)
  const [originality, setOriginality] = useState(false)
  const [rights, setRights] = useState(false)
  const [fullWatch, setFullWatch] = useState(false)
  const [attestationNotes, setAttestationNotes] = useState('')
  const [masterId, setMasterId] = useState('')
  const [thumbnailId, setThumbnailId] = useState('')
  const [captionIds, setCaptionIds] = useState<string[]>([])
  const [renderLabel, setRenderLabel] = useState('Final episode master')
  const [burnCaptions, setBurnCaptions] = useState(false)
  const [thumbnailSourceId, setThumbnailSourceId] = useState('')
  const [thumbnailLabel, setThumbnailLabel] = useState('YouTube thumbnail')
  const [thumbnailHeadline, setThumbnailHeadline] = useState('')
  const [thumbnailPosition, setThumbnailPosition] = useState<'top' | 'bottom'>('bottom')
  const [thumbnailAccent, setThumbnailAccent] = useState<'gold' | 'cyan' | 'coral' | 'white'>(
    'gold'
  )
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string>()
  const [issues, setIssues] = useState<string[]>([])

  const refresh = useCallback(async (): Promise<void> => {
    const [productionWorkspace, finishWorkspace, localMediaStatus] = await Promise.all([
      window.studio.production.getWorkspace(project.manifest.id),
      window.studio.finish.getWorkspace(project.manifest.id),
      window.studio.finish.getLocalMediaStatus()
    ])
    setProduction(productionWorkspace)
    setFinish(finishWorkspace)
    setLocalMedia(localMediaStatus)
  }, [project.manifest.id])

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      window.studio.production.getWorkspace(project.manifest.id),
      window.studio.finish.getWorkspace(project.manifest.id),
      window.studio.finish.getLocalMediaStatus()
    ])
      .then(([productionWorkspace, finishWorkspace, localMediaStatus]) => {
        if (cancelled) return
        setProduction(productionWorkspace)
        setFinish(finishWorkspace)
        setLocalMedia(localMediaStatus)
        const current = finishWorkspace.releaseDetails[0]
        if (!current) return
        setTitle(current.title)
        setDescription(current.description)
        setCategory(current.category)
        setPlaylist(current.playlist)
        setTags(current.tags.join(', '))
        setHashtags(current.hashtags.join(', '))
        setCredits(current.credits)
        setEndScreenNotes(current.endScreenNotes)
      })
      .catch(() => {
        if (!cancelled) setNotice('The edit and release workspace could not be opened safely.')
      })
    return () => {
      cancelled = true
    }
  }, [project.manifest.id])

  const visualAssets = useMemo(
    () =>
      approvedByKind(production, ['video-take', 'animatic', 'master-video', 'storyboard-frame']),
    [production]
  )
  const audioAssets = useMemo(
    () => approvedByKind(production, ['voice-line', 'ambience', 'effect', 'music']),
    [production]
  )
  const masters = useMemo(() => approvedByKind(production, ['master-video']), [production])
  const thumbnails = useMemo(() => approvedByKind(production, ['thumbnail']), [production])
  const captionAssets = useMemo(() => approvedByKind(production, ['caption']), [production])
  const thumbnailSources = useMemo(
    () =>
      production?.media.filter(
        (asset) =>
          asset.state === 'approved' &&
          (asset.mimeType.startsWith('image/') || asset.mimeType.startsWith('video/'))
      ) ?? [],
    [production]
  )

  const lockedTimeline = useMemo(
    () => finish?.timelines.find((timeline) => timeline.state === 'locked'),
    [finish]
  )

  const saveTimeline = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const problems: string[] = []
    if (timelineLabel.trim().length < 2) problems.push('Give the timeline a name.')
    if (selectedVisuals.length === 0) problems.push('Select at least one approved visual clip.')
    if (clipSeconds < 0.1 || clipSeconds > 3600)
      problems.push('Clip duration must be between 0.1 and 3,600 seconds.')
    let captions: ReturnType<typeof parseCaptions> = []
    try {
      captions = parseCaptions(captionSource)
      if (captions.some((caption) => !caption.text || caption.endMs <= caption.startMs)) {
        problems.push(
          'Each caption line must use start seconds|end seconds|text, with an end after its start.'
        )
      }
    } catch {
      problems.push('Caption lines could not be read.')
    }
    if (problems.length) {
      setIssues(problems)
      return
    }
    const draft = latestDraft(finish)
    setBusy(true)
    try {
      const durationMs = Math.round(clipSeconds * 1000)
      const result = await window.studio.finish.saveTimeline({
        projectId: project.manifest.id,
        timelineId: draft?.timelineId ?? null,
        expectedUpdatedAt: draft?.updatedAt ?? null,
        label: timelineLabel.trim(),
        clips: selectedVisuals.map((assetId, order) => ({
          clipId: browserUlid(),
          assetId,
          order,
          durationMs,
          trimInMs: 0,
          transition: 'cut'
        })),
        audioCues: selectedAudio.map((assetId, index) => ({
          cueId: browserUlid(),
          assetId,
          layer: (production?.media.find((asset) => asset.assetId === assetId)?.kind ===
          'voice-line'
            ? 'dialogue'
            : production?.media.find((asset) => asset.assetId === assetId)?.kind === 'music'
              ? 'music'
              : production?.media.find((asset) => asset.assetId === assetId)?.kind === 'ambience'
                ? 'ambience'
                : 'effect') as 'dialogue' | 'ambience' | 'effect' | 'music',
          startMs: index === 0 ? 0 : index * 500,
          durationMs: durationMs * selectedVisuals.length,
          gainDb: 0
        })),
        captions
      })
      if (!result.ok) {
        setNotice(result.error.message)
        return
      }
      setFinish(result.workspace)
      setNotice('Timeline draft saved. Locking is a separate human decision.')
    } catch {
      setNotice('The timeline could not be saved safely.')
    } finally {
      setBusy(false)
    }
  }

  const lockTimeline = async (): Promise<void> => {
    const draft = latestDraft(finish)
    if (!draft) return setIssues(['Save a timeline draft before locking it.'])
    if (
      !window.confirm('Lock this exact timeline revision? Later changes must use a new revision.')
    )
      return
    setBusy(true)
    try {
      const result = await window.studio.finish.lockTimeline({
        projectId: project.manifest.id,
        timelineId: draft.timelineId,
        expectedUpdatedAt: draft.updatedAt,
        confirmation: true
      })
      setNotice(result.ok ? 'Timeline revision locked.' : result.error.message)
      if (result.ok) setFinish(result.workspace)
    } finally {
      setBusy(false)
    }
  }

  const saveDetails = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const current: ReleaseDetails | undefined = finish?.releaseDetails[0]
    const problems: string[] = []
    if (!title.trim()) problems.push('Enter a title. YouTube allows up to 100 characters.')
    if (title.length > 100) problems.push('Shorten the title to 100 characters or fewer.')
    if (description.length > 5000)
      problems.push('Shorten the description to 5,000 characters or fewer.')
    if (!category.trim()) problems.push('Choose or enter a category.')
    if (problems.length) return setIssues(problems)
    setBusy(true)
    try {
      const result = await window.studio.finish.saveReleaseDetails({
        projectId: project.manifest.id,
        releaseDetailsId: current?.releaseDetailsId ?? null,
        expectedUpdatedAt: current?.updatedAt ?? null,
        title: title.trim(),
        description,
        language: project.manifest.language,
        category: category.trim(),
        playlist: playlist.trim(),
        tags: parseCsv(tags),
        hashtags: parseCsv(hashtags),
        chapters: [{ startMs: 0, label: 'Opening' }],
        credits,
        endScreenNotes
      })
      setNotice(
        result.ok
          ? 'Release details saved locally. They have not been uploaded.'
          : result.error.message
      )
      if (result.ok) setFinish(result.workspace)
    } finally {
      setBusy(false)
    }
  }

  const renderMaster = async (): Promise<void> => {
    const problems: string[] = []
    if (!lockedTimeline) problems.push('Lock the exact timeline before rendering a master.')
    if (localMedia?.state !== 'ready')
      problems.push(localMedia?.message ?? 'Check the free local media tools.')
    if (renderLabel.trim().length < 2) problems.push('Give the master candidate a clear name.')
    if (problems.length) return setIssues(problems)
    if (
      !window.confirm(
        'Render this exact locked timeline on this computer? This uses no rented GPU and creates a candidate for review.'
      )
    )
      return
    setBusy(true)
    try {
      const result = await window.studio.finish.renderTimeline({
        projectId: project.manifest.id,
        timelineId: lockedTimeline!.timelineId,
        expectedUpdatedAt: lockedTimeline!.updatedAt,
        label: renderLabel.trim(),
        width: 1920,
        height: 1080,
        framesPerSecond: 24,
        burnCaptions,
        confirmation: true
      })
      if (!result.ok) return setNotice(result.error.message)
      setFinish(result.workspace)
      await refresh()
      setNotice(`Master candidate created locally. ${result.warnings.join(' ')}`)
    } finally {
      setBusy(false)
    }
  }

  const installLocalTools = async (): Promise<void> => {
    if (
      !window.confirm(
        'Install the free FFmpeg media tools through Windows Package Manager? This changes this computer, but it does not rent or start a GPU.'
      )
    )
      return
    setBusy(true)
    try {
      const result = await window.studio.finish.installLocalMediaTools({ confirmation: true })
      if (!result.ok) return setNotice(result.error.message)
      setLocalMedia(result.status)
      setNotice('The free local media tools passed their feature check. Local rendering is ready.')
    } finally {
      setBusy(false)
    }
  }

  const exportCaptions = async (format: 'srt' | 'vtt'): Promise<void> => {
    if (!lockedTimeline) return setIssues(['Lock the exact timeline before exporting captions.'])
    setBusy(true)
    try {
      const result = await window.studio.finish.exportCaptions({
        projectId: project.manifest.id,
        timelineId: lockedTimeline.timelineId,
        label: `${timelineLabel} ${format.toUpperCase()} captions`,
        format,
        confirmation: true
      })
      if (!result.ok) return setNotice(result.error.message)
      setFinish(result.workspace)
      await refresh()
      setNotice(
        `Editable ${format.toUpperCase()} caption candidate created locally.${result.warnings.length ? ` ${result.warnings.join(' ')}` : ''}`
      )
    } finally {
      setBusy(false)
    }
  }

  const renderThumbnail = async (): Promise<void> => {
    const problems: string[] = []
    if (localMedia?.state !== 'ready')
      problems.push(localMedia?.message ?? 'Check the free local media tools.')
    if (!thumbnailSourceId) problems.push('Choose one approved visual for the thumbnail.')
    if (thumbnailLabel.trim().length < 2)
      problems.push('Give the thumbnail candidate a clear name.')
    if (!thumbnailHeadline.trim()) problems.push('Enter truthful thumbnail words.')
    if (thumbnailHeadline.trim().length > 80)
      problems.push('Keep thumbnail words to 80 characters or fewer.')
    if (problems.length) return setIssues(problems)
    if (
      !window.confirm(
        'Create a 16:9 thumbnail candidate from this approved visual and these exact words?'
      )
    )
      return
    setBusy(true)
    try {
      const result = await window.studio.finish.renderThumbnail({
        projectId: project.manifest.id,
        sourceAssetId: thumbnailSourceId,
        label: thumbnailLabel.trim(),
        headline: thumbnailHeadline.trim(),
        textPosition: thumbnailPosition,
        accent: thumbnailAccent,
        confirmation: true
      })
      if (!result.ok) return setNotice(result.error.message)
      setFinish(result.workspace)
      await refresh()
      setNotice(`Thumbnail candidate created locally. ${result.warnings.join(' ')}`)
    } finally {
      setBusy(false)
    }
  }

  const saveAttestations = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const problems: string[] = []
    if (!madeForKids) problems.push('Explicitly choose whether the production is made for kids.')
    if (!syntheticDisclosure)
      problems.push('Explicitly choose the altered or synthetic content answer.')
    if (!truthful)
      problems.push('Confirm that the title and thumbnail truthfully represent the video.')
    if (!originality) problems.push('Confirm that originality was reviewed.')
    if (!rights) problems.push('Confirm that rights and credits were reviewed.')
    if (!fullWatch) problems.push('Watch the complete master and confirm it before release.')
    if (attestationNotes.trim().length < 10)
      problems.push('Add at least 10 characters of review notes.')
    if (problems.length) return setIssues(problems)
    setBusy(true)
    try {
      const result = await window.studio.finish.saveAttestations({
        projectId: project.manifest.id,
        madeForKids: madeForKids as 'yes' | 'no',
        syntheticDisclosure: syntheticDisclosure as 'yes' | 'no',
        truthfulPackagingConfirmed: true,
        originalityReviewed: true,
        rightsAndCreditsReviewed: true,
        fullWatchCompleted: true,
        notes: attestationNotes.trim()
      })
      setNotice(
        result.ok ? 'Human release decisions recorded as a new attestation.' : result.error.message
      )
      if (result.ok) setFinish(result.workspace)
    } finally {
      setBusy(false)
    }
  }

  const packageRelease = async (): Promise<void> => {
    const timeline = finish?.timelines.find((item) => item.state === 'locked')
    const details = finish?.releaseDetails[0]
    const attestation = finish?.attestations[0]
    const problems: string[] = []
    if (!timeline) problems.push('Lock the exact timeline first.')
    if (!details) problems.push('Save the release details first.')
    if (!attestation) problems.push('Complete the human release attestations first.')
    if (!masterId) problems.push('Choose the approved master video.')
    if (!thumbnailId) problems.push('Choose the approved thumbnail.')
    if (problems.length) return setIssues(problems)
    if (
      !window.confirm(
        'Create a new immutable manual-upload package from these exact approved files?'
      )
    )
      return
    setBusy(true)
    try {
      const result = await window.studio.finish.createReleasePackage({
        projectId: project.manifest.id,
        timelineId: timeline!.timelineId,
        releaseDetailsId: details!.releaseDetailsId,
        attestationId: attestation!.attestationId,
        masterAssetId: masterId,
        thumbnailAssetId: thumbnailId,
        captionAssetIds: captionIds,
        confirmation: true
      })
      setNotice(
        result.ok
          ? 'Verified manual-upload package locked locally. Nothing was uploaded to YouTube.'
          : result.error.message
      )
      if (result.ok) setFinish(result.workspace)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="production-room finish-room">
      <ValidationAlert
        title="Finish and release needs attention"
        messages={issues}
        onClose={() => setIssues([])}
      />
      <button className="text-button back-link" onClick={onHome}>
        ← Production overview
      </button>
      <header className="page-heading">
        <div>
          <p className="eyebrow">
            Edit, sound, captions, thumbnail, and release · {project.manifest.code}
          </p>
          <h1>Build the final package only from approved local work.</h1>
          <p>
            Nothing here publishes automatically. Every saved package remains a verified folder for
            manual upload through YouTube Studio.
          </p>
        </div>
        <button className="button button-secondary" onClick={onReview}>
          Review media first
        </button>
      </header>
      <div className="room-assistant-row">
        <div>
          <strong>Get help with any editable finishing field</strong>
          <span>
            Generate timeline, caption, sound, thumbnail, title, description, tags, credit, and
            end-screen ideas. Policy attestations remain human decisions.
          </span>
        </div>
        <IdeaAssistant
          project={project}
          buttonLabel="Generate finishing and release ideas"
          targets={[
            {
              id: 'timeline-name',
              label: 'Timeline name',
              taskKind: 'plan_edit_sound',
              instruction:
                'Return a short production timeline name that identifies the episode or film and edit stage.',
              currentValue: timelineLabel,
              onUse: setTimelineLabel
            },
            {
              id: 'captions',
              label: 'Editable caption draft',
              taskKind: 'plan_edit_sound',
              instruction:
                'Using only dialogue or narration supplied in project context or the creator request, return caption rows as start seconds|end seconds|text. Do not invent unheard dialogue; mark missing timings for human correction.',
              currentValue: captionSource,
              onUse: setCaptionSource
            },
            {
              id: 'sound-plan',
              label: 'Timeline sound-layer plan',
              taskKind: 'plan_edit_sound',
              instruction:
                'Plan dialogue placement, ambience, effects, foley, music placeholders, gain considerations, transitions, pacing, and human review checkpoints. Preserve approved dialogue separately.',
              currentValue: selectedAudio
                .map((assetId) => audioAssets.find((asset) => asset.assetId === assetId)?.label)
                .filter(Boolean)
                .join(', ')
            },
            {
              id: 'foley',
              label: 'Ambience, effects, and foley cue sheet',
              taskKind: 'plan_foley',
              instruction:
                'Create a time-addressable cue sheet that separates ambience, synchronized effects, foley, dialogue, and music; include source/rights questions and intentional silence.',
              currentValue: captionSource
            },
            {
              id: 'master-name',
              label: 'Master candidate name',
              taskKind: 'plan_edit_sound',
              instruction:
                'Return one short, clear master-video candidate name including the production and revision purpose.',
              currentValue: renderLabel,
              onUse: setRenderLabel
            },
            {
              id: 'thumbnail-name',
              label: 'Thumbnail candidate name',
              taskKind: 'plan_thumbnail',
              instruction:
                'Return a short internal candidate name that describes its subject and hypothesis without calling it an audience test.',
              currentValue: thumbnailLabel,
              onUse: setThumbnailLabel
            },
            {
              id: 'thumbnail-words',
              label: 'Truthful thumbnail words',
              taskKind: 'plan_thumbnail',
              instruction:
                'Return one concise truthful thumbnail phrase, ideally two to five words and never more than 80 characters. It must represent the actual episode rather than manufacture a false event.',
              currentValue: thumbnailHeadline,
              onUse: setThumbnailHeadline
            },
            {
              id: 'thumbnail-concept',
              label: 'Thumbnail visual concept',
              taskKind: 'plan_thumbnail',
              instruction:
                'Propose subject, expression/action, composition, contrast, optional words, small-card readability, continuity checks, and misleading-imagery risks using only truthful production facts.'
            },
            {
              id: 'release-title',
              label: 'YouTube title',
              taskKind: 'plan_youtube_release',
              instruction:
                'Return one truthful, compelling paste-ready title no longer than 100 characters. Avoid fake urgency, unsupported claims, keyword stuffing, and promises of views.',
              currentValue: title,
              onUse: setTitle
            },
            {
              id: 'description',
              label: 'YouTube description',
              taskKind: 'plan_youtube_release',
              instruction:
                'Write a truthful paste-ready description with a clear opening, factual episode summary, appropriate call to action, chapter/credit placeholders where evidence is missing, and no fabricated links or claims.',
              currentValue: description,
              onUse: setDescription
            },
            {
              id: 'category',
              label: 'Category guidance',
              taskKind: 'plan_youtube_release',
              instruction:
                'Recommend the best fitting official category from the facts supplied and explain the tradeoff. The creator must verify the current platform choice.',
              currentValue: category,
              onUse: setCategory
            },
            {
              id: 'playlist',
              label: 'Playlist name',
              taskKind: 'plan_youtube_release',
              instruction:
                'Return a concise playlist name that groups only genuinely related releases.',
              currentValue: playlist,
              onUse: setPlaylist
            },
            {
              id: 'tags',
              label: 'Relevant tags',
              taskKind: 'plan_youtube_release',
              instruction:
                'Return a conservative comma-separated list of relevant factual tags. Do not add unrelated trends, names, or claims.',
              currentValue: tags,
              onUse: setTags
            },
            {
              id: 'hashtags',
              label: 'Relevant hashtags',
              taskKind: 'plan_youtube_release',
              instruction:
                'Return a concise comma-separated list of no more than 15 directly relevant hashtags, each beginning with #.',
              currentValue: hashtags,
              onUse: setHashtags
            },
            {
              id: 'credits',
              label: 'Credits draft',
              taskKind: 'plan_youtube_release',
              instruction:
                'Create a clearly labelled credits template using only names, roles, sources, licenses, and links supplied by the creator. Leave explicit blanks instead of inventing attribution.',
              currentValue: credits,
              onUse: setCredits
            },
            {
              id: 'end-screen',
              label: 'End-screen and card notes',
              taskKind: 'plan_youtube_release',
              instruction:
                'Suggest a truthful end-screen plan and call to action that fits the story and channel promise without claiming nonexistent videos or links.',
              currentValue: endScreenNotes,
              onUse: setEndScreenNotes
            },
            {
              id: 'made-for-kids',
              label: 'Made-for-kids considerations',
              taskKind: 'plan_youtube_release',
              instruction:
                'Explain the current factors the creator should independently review. Do not choose yes or no, and do not infer the answer merely because the production is animated or has a creative age band.',
              humanOnly: true
            },
            {
              id: 'synthetic-disclosure',
              label: 'Altered or synthetic disclosure considerations',
              taskKind: 'plan_youtube_release',
              instruction:
                'Explain which facts and current platform guidance the creator should check. Do not choose yes or no or provide legal advice.',
              humanOnly: true
            },
            {
              id: 'rights-review',
              label: 'Rights and credits review checklist',
              taskKind: 'plan_youtube_release',
              instruction:
                'Create a checklist covering voices, likeness, references, music, effects, fonts, source material, model/license evidence, and credits. Do not attest that any right exists.',
              humanOnly: true
            }
          ]}
        />
      </div>
      {notice && (
        <div className="safety-feedback" role="status">
          {notice}
        </div>
      )}
      {production && <ProductionReadinessStrip workspace={production} />}
      <Readiness finish={finish} />

      <section className="finish-grid">
        <form className="finish-card" onSubmit={(event) => void saveTimeline(event)}>
          <p className="eyebrow">1 · Deterministic timeline</p>
          <h2>Order approved visuals and sound</h2>
          <label>
            Timeline name <RequiredMark />
            <input
              value={timelineLabel}
              onChange={(event) => setTimelineLabel(event.target.value)}
              required
            />
          </label>
          <label>
            Seconds per selected visual <RequiredMark />
            <input
              type="number"
              min="0.1"
              max="3600"
              step="0.1"
              value={clipSeconds}
              onChange={(event) => setClipSeconds(Number(event.target.value))}
              required
            />
          </label>
          <fieldset>
            <legend>
              Approved visual order <RequiredMark />
            </legend>
            {visualAssets.map((asset) => (
              <label key={asset.assetId} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={selectedVisuals.includes(asset.assetId)}
                  onChange={(event) =>
                    setSelectedVisuals((current) =>
                      event.target.checked
                        ? [...current, asset.assetId]
                        : current.filter((id) => id !== asset.assetId)
                    )
                  }
                />
                <span>
                  {asset.label}
                  <small>{asset.kind}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Sound layers</legend>
            {audioAssets.map((asset) => (
              <label key={asset.assetId} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={selectedAudio.includes(asset.assetId)}
                  onChange={(event) =>
                    setSelectedAudio((current) =>
                      event.target.checked
                        ? [...current, asset.assetId]
                        : current.filter((id) => id !== asset.assetId)
                    )
                  }
                />
                <span>
                  {asset.label}
                  <small>{asset.kind}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <label>
            Editable captions: start seconds|end seconds|text
            <textarea
              rows={5}
              value={captionSource}
              onChange={(event) => setCaptionSource(event.target.value)}
            />
          </label>
          <div className="finish-actions">
            <button className="button button-secondary" disabled={busy} type="submit">
              Save timeline draft
            </button>
            <button
              className="button button-primary"
              disabled={busy || !latestDraft(finish)}
              type="button"
              onClick={() => void lockTimeline()}
            >
              Lock reviewed timeline
            </button>
          </div>
        </form>

        <section className="finish-card">
          <p className="eyebrow">2 · Free local render</p>
          <h2>Master, captions, and truthful thumbnail</h2>
          <div className={`runtime-status ${localMedia?.state === 'ready' ? 'ready' : 'blocked'}`}>
            <strong>
              {localMedia?.state === 'ready' ? 'Local media tools ready' : 'One-time setup needed'}
            </strong>
            <span>{localMedia?.message ?? 'Checking this computer…'}</span>
          </div>
          {localMedia?.state === 'missing' && (
            <button
              className="button button-secondary"
              disabled={busy}
              type="button"
              onClick={() => void installLocalTools()}
            >
              Install free local media tools
            </button>
          )}
          <label>
            Master candidate name <RequiredMark />
            <input
              value={renderLabel}
              onChange={(event) => setRenderLabel(event.target.value)}
              required
            />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={burnCaptions}
              onChange={(event) => setBurnCaptions(event.target.checked)}
            />
            <span>Burn the editable timeline captions into the picture</span>
          </label>
          <div className="finish-actions">
            <button
              className="button button-primary"
              disabled={busy || !lockedTimeline || localMedia?.state !== 'ready'}
              type="button"
              onClick={() => void renderMaster()}
            >
              Render master on this computer
            </button>
            <button
              className="button button-secondary"
              disabled={busy || !lockedTimeline}
              type="button"
              onClick={() => void exportCaptions('srt')}
            >
              Create SRT captions
            </button>
            <button
              className="button button-secondary"
              disabled={busy || !lockedTimeline}
              type="button"
              onClick={() => void exportCaptions('vtt')}
            >
              Create VTT captions
            </button>
          </div>
          <hr />
          <label>
            Approved thumbnail visual <RequiredMark />
            <select
              value={thumbnailSourceId}
              onChange={(event) => setThumbnailSourceId(event.target.value)}
            >
              <option value="">Choose approved image or video</option>
              {thumbnailSources.map((asset) => (
                <option key={asset.assetId} value={asset.assetId}>
                  {asset.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Thumbnail candidate name <RequiredMark />
            <input
              value={thumbnailLabel}
              onChange={(event) => setThumbnailLabel(event.target.value)}
              required
            />
          </label>
          <label>
            Truthful thumbnail words <RequiredMark />
            <input
              value={thumbnailHeadline}
              maxLength={80}
              onChange={(event) => setThumbnailHeadline(event.target.value)}
              required
            />
            <TextRequirement
              id="thumbnail-headline-guidance"
              value={thumbnailHeadline}
              minimum={1}
              maximum={80}
            />
          </label>
          <div className="field-pair">
            <label>
              Words position
              <select
                value={thumbnailPosition}
                onChange={(event) => setThumbnailPosition(event.target.value as 'top' | 'bottom')}
              >
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
              </select>
            </label>
            <label>
              Accent
              <select
                value={thumbnailAccent}
                onChange={(event) =>
                  setThumbnailAccent(event.target.value as 'gold' | 'cyan' | 'coral' | 'white')
                }
              >
                <option value="gold">Gold</option>
                <option value="cyan">Cyan</option>
                <option value="coral">Coral</option>
                <option value="white">White</option>
              </select>
            </label>
          </div>
          <button
            className="button button-secondary"
            disabled={busy || localMedia?.state !== 'ready'}
            type="button"
            onClick={() => void renderThumbnail()}
          >
            Create 16:9 thumbnail candidate
          </button>
          <small>Every result returns to Review Media. Nothing is approved automatically.</small>
        </section>

        <form className="finish-card" onSubmit={(event) => void saveDetails(event)}>
          <p className="eyebrow">3 · Release details</p>
          <h2>Factual YouTube packaging</h2>
          <label>
            Title <RequiredMark />
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={100}
              required
            />
            <TextRequirement id="release-title-guidance" value={title} minimum={1} maximum={100} />
          </label>
          <label>
            Description
            <textarea
              rows={7}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={5000}
            />
            <small>{description.length} / 5,000 characters</small>
          </label>
          <label>
            Category <RequiredMark />
            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              required
            />
          </label>
          <label>
            Playlist
            <input value={playlist} onChange={(event) => setPlaylist(event.target.value)} />
          </label>
          <label>
            Tags, separated by commas
            <input value={tags} onChange={(event) => setTags(event.target.value)} />
          </label>
          <label>
            Hashtags, separated by commas
            <input value={hashtags} onChange={(event) => setHashtags(event.target.value)} />
          </label>
          <label>
            Credits
            <textarea
              rows={4}
              value={credits}
              onChange={(event) => setCredits(event.target.value)}
            />
          </label>
          <label>
            End-screen notes
            <textarea
              rows={3}
              value={endScreenNotes}
              onChange={(event) => setEndScreenNotes(event.target.value)}
            />
          </label>
          <button className="button button-secondary" disabled={busy} type="submit">
            Save release details
          </button>
        </form>

        <form className="finish-card" onSubmit={(event) => void saveAttestations(event)}>
          <p className="eyebrow">4 · Human decisions</p>
          <h2>No policy answer is guessed</h2>
          <label>
            Made for kids? <RequiredMark />
            <select
              value={madeForKids}
              onChange={(event) => setMadeForKids(event.target.value as '' | 'yes' | 'no')}
              required
            >
              <option value="">Choose explicitly</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label>
            Altered or synthetic content disclosure? <RequiredMark />
            <select
              value={syntheticDisclosure}
              onChange={(event) => setSyntheticDisclosure(event.target.value as '' | 'yes' | 'no')}
              required
            >
              <option value="">Choose explicitly</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          {[
            [
              'truthful',
              truthful,
              setTruthful,
              'The title and thumbnail truthfully represent the video.'
            ],
            [
              'originality',
              originality,
              setOriginality,
              'Originality and reused-content risk were reviewed.'
            ],
            [
              'rights',
              rights,
              setRights,
              'Rights, likeness consent, sources, and credits were reviewed.'
            ],
            [
              'watch',
              fullWatch,
              setFullWatch,
              'I watched the complete master from start to finish.'
            ]
          ].map(([key, checked, setter, text]) => (
            <label key={String(key)} className="checkbox-row strong-confirmation">
              <input
                type="checkbox"
                checked={Boolean(checked)}
                onChange={(event) => (setter as (value: boolean) => void)(event.target.checked)}
              />
              <span>
                {String(text)} <RequiredMark />
              </span>
            </label>
          ))}
          <label>
            Review notes <RequiredMark />
            <textarea
              rows={4}
              minLength={10}
              maxLength={2000}
              value={attestationNotes}
              onChange={(event) => setAttestationNotes(event.target.value)}
              required
            />
            <TextRequirement
              id="attestation-notes-guidance"
              value={attestationNotes}
              minimum={10}
              maximum={2000}
            />
          </label>
          <button className="button button-secondary" disabled={busy} type="submit">
            Record new human attestation
          </button>
        </form>

        <section className="finish-card">
          <p className="eyebrow">5 · Immutable package</p>
          <h2>Select the exact approved files</h2>
          <label>
            Master video <RequiredMark />
            <select value={masterId} onChange={(event) => setMasterId(event.target.value)}>
              <option value="">Choose approved master</option>
              {masters.map((asset) => (
                <option key={asset.assetId} value={asset.assetId}>
                  {asset.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Thumbnail <RequiredMark />
            <select value={thumbnailId} onChange={(event) => setThumbnailId(event.target.value)}>
              <option value="">Choose approved thumbnail</option>
              {thumbnails.map((asset) => (
                <option key={asset.assetId} value={asset.assetId}>
                  {asset.label}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>Caption files</legend>
            {captionAssets.map((asset) => (
              <label key={asset.assetId} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={captionIds.includes(asset.assetId)}
                  onChange={(event) =>
                    setCaptionIds((current) =>
                      event.target.checked
                        ? [...current, asset.assetId]
                        : current.filter((id) => id !== asset.assetId)
                    )
                  }
                />
                <span>{asset.label}</span>
              </label>
            ))}
          </fieldset>
          <button
            className="button button-primary button-large"
            disabled={busy}
            type="button"
            onClick={() => void packageRelease()}
          >
            Create verified manual-upload package
          </button>
          {finish?.releasePackages.map((item) => (
            <div className="package-receipt" key={item.releaseId}>
              <strong>Package {item.releaseId.slice(-6)}</strong>
              <span>{item.files.length} hash-checked files</span>
              <small>{item.relativePath}</small>
            </div>
          ))}
        </section>
      </section>
      {finish && (
        <ReleasePlanningPanel
          project={project}
          workspace={finish}
          onWorkspace={setFinish}
          onNotice={setNotice}
        />
      )}
    </div>
  )
}
