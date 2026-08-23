import { useMemo, useState, type FormEvent, type JSX } from 'react'
import type { FinishWorkspace, ProjectDetails, ReleaseLearning } from '@studio/contracts'
import { IdeaAssistant } from './IdeaAssistant'
import { RequiredMark, TextRequirement, ValidationAlert } from './FormGuidance'

function parseList(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ]
}

function optionalNumber(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function optionalWholeNumber(value: string): number | null {
  const parsed = optionalNumber(value)
  return parsed === null || !Number.isInteger(parsed) ? null : parsed
}

function optionalPercentage(value: string): number | null {
  const parsed = optionalNumber(value)
  return parsed !== null && parsed <= 100 ? parsed : null
}

function invalidOptional(value: string, parser: (input: string) => number | null): boolean {
  return Boolean(value.trim()) && parser(value) === null
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysAgo(days: number): string {
  const value = new Date()
  value.setUTCDate(value.getUTCDate() - days)
  return value.toISOString().slice(0, 10)
}

export function ReleasePlanningPanel({
  project,
  workspace,
  onWorkspace,
  onNotice
}: {
  project: ProjectDetails
  workspace: FinishWorkspace
  onWorkspace(workspace: FinishWorkspace): void
  onNotice(message: string): void
}): JSX.Element {
  const latestProfile = workspace.releaseProfiles[0]
  const [profileName, setProfileName] = useState(
    latestProfile?.name ?? 'Primary channel release profile'
  )
  const [profileAudience, setProfileAudience] = useState(
    latestProfile?.audience ?? project.creativeDirection?.direction.targetAudience ?? ''
  )
  const [profileLanguage, setProfileLanguage] = useState(
    latestProfile?.language ?? project.manifest.language
  )
  const [profileRegion, setProfileRegion] = useState(latestProfile?.region ?? '')
  const [profileTimezone, setProfileTimezone] = useState(latestProfile?.timezone ?? 'Africa/Lagos')
  const [channelPromise, setChannelPromise] = useState(
    latestProfile?.channelPromise ?? project.creativeDirection?.direction.storyPromise ?? ''
  )
  const [packagingVoice, setPackagingVoice] = useState(
    latestProfile?.packagingVoice ??
      project.creativeDirection?.direction.toneKeywords.join(', ') ??
      ''
  )
  const [packagingVisual, setPackagingVisual] = useState(
    latestProfile?.visualDirection ?? project.creativeDirection?.direction.visualStyleNotes ?? ''
  )
  const [defaultCta, setDefaultCta] = useState(latestProfile?.defaultCta ?? '')
  const [defaultCredits, setDefaultCredits] = useState(latestProfile?.defaultCredits ?? '')
  const [blockedClaims, setBlockedClaims] = useState(latestProfile?.blockedClaims.join(', ') ?? '')
  const [blockedTopics, setBlockedTopics] = useState(latestProfile?.blockedTopics.join(', ') ?? '')
  const [profileCategory, setProfileCategory] = useState(
    latestProfile?.category ?? 'Film & Animation'
  )
  const [playlistConvention, setPlaylistConvention] = useState(
    latestProfile?.playlistConvention ?? ''
  )

  const [ideaTitle, setIdeaTitle] = useState('')
  const [ideaPremise, setIdeaPremise] = useState('')
  const [ideaSource, setIdeaSource] = useState<
    'creator' | 'llm-proposal' | 'audience-request' | 'trend-signal' | 'other'
  >('creator')
  const [ideaSourceLabel, setIdeaSourceLabel] = useState('Creator brainstorm')
  const [ideaRationale, setIdeaRationale] = useState('')
  const [ideaContinuity, setIdeaContinuity] = useState('')

  const [snapshotReleaseId, setSnapshotReleaseId] = useState('')
  const [videoId, setVideoId] = useState('')
  const [snapshotSource, setSnapshotSource] = useState<
    'official-report' | 'manual-official' | 'rehearsal'
  >('manual-official')
  const [windowStart, setWindowStart] = useState(daysAgo(7))
  const [windowEnd, setWindowEnd] = useState(today())
  const [views, setViews] = useState('0')
  const [impressions, setImpressions] = useState('')
  const [ctr, setCtr] = useState('')
  const [averageViewDuration, setAverageViewDuration] = useState('')
  const [watchTime, setWatchTime] = useState('')
  const [likes, setLikes] = useState('')
  const [comments, setComments] = useState('')
  const [shares, setShares] = useState('')
  const [subscribers, setSubscribers] = useState('')
  const [retention30, setRetention30] = useState('')
  const [evidenceNotes, setEvidenceNotes] = useState('')

  const [selectedSnapshots, setSelectedSnapshots] = useState<string[]>([])
  const [observation, setObservation] = useState('')
  const [inference, setInference] = useState('')
  const [recommendation, setRecommendation] = useState('')
  const [confidence, setConfidence] = useState<'low' | 'medium' | 'high'>('low')
  const [learningScope, setLearningScope] = useState<
    'next-release' | 'this-project' | 'future-profile-version'
  >('next-release')
  const [reviewReasons, setReviewReasons] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [issues, setIssues] = useState<string[]>([])

  const currentEvidence = useMemo(
    () =>
      selectedSnapshots
        .map((id) => workspace.performanceSnapshots.find((snapshot) => snapshot.snapshotId === id))
        .filter(Boolean)
        .map(
          (snapshot) =>
            `${snapshot!.youtubeVideoId} ${snapshot!.windowStart}–${snapshot!.windowEnd}: ${JSON.stringify(snapshot!.metrics)}`
        )
        .join('\n'),
    [selectedSnapshots, workspace.performanceSnapshots]
  )

  const acceptResult = (
    result: Awaited<ReturnType<typeof window.studio.finish.saveIdea>>
  ): void => {
    if (result.ok) onWorkspace(result.workspace)
    onNotice(
      result.ok ? 'Saved locally. Nothing was published or generated.' : result.error.message
    )
  }

  const saveProfile = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const nextIssues: string[] = []
    if (profileName.trim().length < 2) nextIssues.push('Enter a release-profile name.')
    if (profileAudience.trim().length < 2) nextIssues.push('Describe the release audience.')
    if (channelPromise.trim().length < 10)
      nextIssues.push('Explain the channel promise in at least 10 characters.')
    if (packagingVoice.trim().length < 2) nextIssues.push('Describe the packaging voice.')
    if (packagingVisual.trim().length < 2)
      nextIssues.push('Describe the packaging visual direction.')
    if (nextIssues.length) {
      setIssues(nextIssues)
      return
    }
    setBusy(true)
    try {
      acceptResult(
        await window.studio.finish.saveReleaseProfile({
          projectId: project.manifest.id,
          profileId: latestProfile?.profileId ?? null,
          expectedUpdatedAt: latestProfile?.updatedAt ?? null,
          name: profileName,
          audience: profileAudience,
          language: profileLanguage,
          region: profileRegion,
          timezone: profileTimezone,
          channelPromise,
          packagingVoice,
          visualDirection: packagingVisual,
          defaultCta,
          defaultCredits,
          blockedClaims: parseList(blockedClaims),
          blockedTopics: parseList(blockedTopics),
          category: profileCategory,
          playlistConvention
        })
      )
    } finally {
      setBusy(false)
    }
  }

  const saveIdea = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const nextIssues: string[] = []
    if (ideaTitle.trim().length < 2) nextIssues.push('Enter an idea title.')
    if (ideaPremise.trim().length < 10)
      nextIssues.push('Explain the idea premise in at least 10 characters.')
    if (ideaSourceLabel.trim().length < 2) nextIssues.push('Name the source of this idea.')
    if (ideaRationale.trim().length < 10) nextIssues.push('Explain why this idea may fit.')
    if (nextIssues.length) {
      setIssues(nextIssues)
      return
    }
    setBusy(true)
    try {
      const result = await window.studio.finish.saveIdea({
        projectId: project.manifest.id,
        ideaId: null,
        title: ideaTitle,
        premise: ideaPremise,
        sourceType: ideaSource,
        sourceLabel: ideaSourceLabel,
        rationale: ideaRationale,
        continuityNotes: ideaContinuity,
        status: 'backlog'
      })
      acceptResult(result)
      if (result.ok) {
        setIdeaTitle('')
        setIdeaPremise('')
        setIdeaRationale('')
        setIdeaContinuity('')
      }
    } finally {
      setBusy(false)
    }
  }

  const saveSnapshot = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const parsedViews = optionalNumber(views)
    const nextIssues: string[] = []
    if (!/^[A-Za-z0-9_-]{6,32}$/.test(videoId.trim()))
      nextIssues.push('Enter a valid YouTube video ID.')
    if (parsedViews === null || !Number.isInteger(parsedViews))
      nextIssues.push('Views must be a whole number of zero or more.')
    if (windowEnd < windowStart)
      nextIssues.push('The evidence end date cannot be before its start date.')
    for (const [name, value] of [
      ['Impressions', impressions],
      ['Likes', likes],
      ['Comments', comments],
      ['Shares', shares],
      ['Subscribers gained', subscribers]
    ] as const) {
      if (invalidOptional(value, optionalWholeNumber))
        nextIssues.push(`${name} must be a whole number of zero or more, or left blank.`)
    }
    for (const [name, value] of [
      ['Average view duration', averageViewDuration],
      ['Watch time', watchTime]
    ] as const) {
      if (invalidOptional(value, optionalNumber))
        nextIssues.push(`${name} must be zero or more, or left blank.`)
    }
    for (const [name, value] of [
      ['Impressions click-through rate', ctr],
      ['30-second retention', retention30]
    ] as const) {
      if (invalidOptional(value, optionalPercentage))
        nextIssues.push(`${name} must be between 0 and 100, or left blank.`)
    }
    if (evidenceNotes.trim().length < 10)
      nextIssues.push('Describe where these metrics came from in at least 10 characters.')
    if (nextIssues.length || parsedViews === null) {
      setIssues(nextIssues)
      return
    }
    setBusy(true)
    try {
      acceptResult(
        await window.studio.finish.savePerformanceSnapshot({
          projectId: project.manifest.id,
          releaseId: snapshotReleaseId || null,
          youtubeVideoId: videoId.trim(),
          source: snapshotSource,
          windowStart,
          windowEnd,
          collectedAt: new Date().toISOString(),
          metrics: {
            views: parsedViews,
            impressions: optionalWholeNumber(impressions),
            impressionsClickThroughRatePct: optionalPercentage(ctr),
            averageViewDurationSeconds: optionalNumber(averageViewDuration),
            estimatedWatchTimeHours: optionalNumber(watchTime),
            likes: optionalWholeNumber(likes),
            comments: optionalWholeNumber(comments),
            shares: optionalWholeNumber(shares),
            subscribersGained: optionalWholeNumber(subscribers),
            retentionAt30SecondsPct: optionalPercentage(retention30)
          },
          missingDataWarnings: [],
          evidenceNotes
        })
      )
    } finally {
      setBusy(false)
    }
  }

  const saveLearning = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const nextIssues: string[] = []
    if (!selectedSnapshots.length) nextIssues.push('Select at least one local evidence snapshot.')
    if (observation.trim().length < 10) nextIssues.push('Record an evidence-based observation.')
    if (inference.trim().length < 10) nextIssues.push('Record a cautious inference.')
    if (recommendation.trim().length < 10) nextIssues.push('Record a prospective recommendation.')
    if (nextIssues.length) {
      setIssues(nextIssues)
      return
    }
    setBusy(true)
    try {
      acceptResult(
        await window.studio.finish.saveLearning({
          projectId: project.manifest.id,
          snapshotIds: selectedSnapshots,
          observation,
          inference,
          recommendation,
          confidence,
          scope: learningScope
        })
      )
    } finally {
      setBusy(false)
    }
  }

  const reviewLearning = async (
    learning: ReleaseLearning,
    decision: 'approved' | 'rejected'
  ): Promise<void> => {
    const reason = reviewReasons[learning.learningId]?.trim() ?? ''
    if (reason.length < 10) {
      setIssues(['Explain the learning decision in at least 10 characters.'])
      return
    }
    setBusy(true)
    try {
      acceptResult(
        await window.studio.finish.reviewLearning({
          projectId: project.manifest.id,
          learningId: learning.learningId,
          decision,
          reason,
          confirmation: true
        })
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="release-planning-suite">
      <ValidationAlert
        title="The release-planning entry needs attention"
        messages={issues}
        onClose={() => setIssues([])}
      />
      <div className="section-heading">
        <div>
          <p className="eyebrow">Release identity, Idea Library, and evidence learning</p>
          <h2>Plan several series without mixing their audience or lessons</h2>
          <p>
            Every record below stays in this project. Evidence can propose a future lesson, but it
            cannot rewrite an episode, change live YouTube metadata, or trigger spending.
          </p>
        </div>
        <span className="status-chip local">Local and project-scoped</span>
      </div>

      <div className="release-planning-grid">
        <form
          className="finish-card release-profile-card"
          onSubmit={(event) => void saveProfile(event)}
        >
          <p className="eyebrow">A · Versioned release profile</p>
          <h3>Channel packaging compass</h3>
          <IdeaAssistant
            project={project}
            buttonLabel="Generate profile ideas"
            targets={[
              {
                id: 'profile-name',
                label: 'Release-profile name',
                taskKind: 'plan_youtube_release',
                instruction: 'Return one clear internal name for this project release profile.',
                currentValue: profileName,
                onUse: setProfileName
              },
              {
                id: 'profile-audience',
                label: 'Release audience',
                taskKind: 'design_creative_direction',
                instruction:
                  'Describe the intended audience for packaging and discovery without deciding made-for-kids status.',
                currentValue: profileAudience,
                onUse: setProfileAudience
              },
              {
                id: 'channel-promise',
                label: 'Channel or series promise',
                taskKind: 'plan_youtube_release',
                instruction: 'Write a truthful repeatable promise for viewers.',
                currentValue: channelPromise,
                onUse: setChannelPromise
              },
              {
                id: 'packaging-voice',
                label: 'Packaging voice',
                taskKind: 'plan_youtube_release',
                instruction:
                  'Define title, description, and call-to-action voice with useful do and do-not guidance.',
                currentValue: packagingVoice,
                onUse: setPackagingVoice
              },
              {
                id: 'packaging-visual',
                label: 'Packaging visual direction',
                taskKind: 'plan_thumbnail',
                instruction:
                  'Define thumbnail composition, palette, typography, truthful imagery, consistency, and small-card readability.',
                currentValue: packagingVisual,
                onUse: setPackagingVisual
              },
              {
                id: 'default-cta',
                label: 'Default call to action',
                taskKind: 'plan_youtube_release',
                instruction: 'Write a short honest reusable call to action.',
                currentValue: defaultCta,
                onUse: setDefaultCta
              },
              {
                id: 'blocked-claims',
                label: 'Blocked claims',
                taskKind: 'plan_youtube_release',
                instruction:
                  'Return a comma-separated list of unsupported, deceptive, or brand-inconsistent claims this project should never use.',
                currentValue: blockedClaims,
                onUse: setBlockedClaims
              },
              {
                id: 'playlist-convention',
                label: 'Playlist convention',
                taskKind: 'plan_youtube_release',
                instruction:
                  'Propose a repeatable truthful playlist naming and episode-order convention.',
                currentValue: playlistConvention,
                onUse: setPlaylistConvention
              }
            ]}
          />
          <label>
            Profile name <RequiredMark />
            <input value={profileName} onChange={(event) => setProfileName(event.target.value)} />
          </label>
          <label>
            Packaging audience <RequiredMark />
            <textarea
              value={profileAudience}
              onChange={(event) => setProfileAudience(event.target.value)}
            />
          </label>
          <div className="field-pair">
            <label>
              Language <RequiredMark />
              <input
                value={profileLanguage}
                onChange={(event) => setProfileLanguage(event.target.value)}
              />
            </label>
            <label>
              Region
              <input
                value={profileRegion}
                onChange={(event) => setProfileRegion(event.target.value)}
              />
            </label>
          </div>
          <label>
            Timezone <RequiredMark />
            <input
              value={profileTimezone}
              onChange={(event) => setProfileTimezone(event.target.value)}
            />
          </label>
          <label>
            Channel or series promise <RequiredMark />
            <textarea
              value={channelPromise}
              onChange={(event) => setChannelPromise(event.target.value)}
            />
          </label>
          <label>
            Packaging voice <RequiredMark />
            <textarea
              value={packagingVoice}
              onChange={(event) => setPackagingVoice(event.target.value)}
            />
          </label>
          <label>
            Packaging visual direction <RequiredMark />
            <textarea
              value={packagingVisual}
              onChange={(event) => setPackagingVisual(event.target.value)}
            />
          </label>
          <label>
            Default call to action
            <input value={defaultCta} onChange={(event) => setDefaultCta(event.target.value)} />
          </label>
          <label>
            Default credits block
            <textarea
              value={defaultCredits}
              onChange={(event) => setDefaultCredits(event.target.value)}
            />
          </label>
          <label>
            Blocked claims, comma separated
            <textarea
              value={blockedClaims}
              onChange={(event) => setBlockedClaims(event.target.value)}
            />
          </label>
          <label>
            Blocked topics, comma separated
            <textarea
              value={blockedTopics}
              onChange={(event) => setBlockedTopics(event.target.value)}
            />
          </label>
          <label>
            Default category <RequiredMark />
            <input
              value={profileCategory}
              onChange={(event) => setProfileCategory(event.target.value)}
            />
          </label>
          <label>
            Playlist convention
            <textarea
              value={playlistConvention}
              onChange={(event) => setPlaylistConvention(event.target.value)}
            />
          </label>
          <button className="button button-secondary" disabled={busy}>
            Save as new profile version
          </button>
          {latestProfile && (
            <small>
              Current version: {latestProfile.revision}. Saving never changes older release
              packages.
            </small>
          )}
        </form>

        <form className="finish-card" onSubmit={(event) => void saveIdea(event)}>
          <p className="eyebrow">B · Source-labelled Idea Library</p>
          <h3>Keep possible episodes and films without starting them</h3>
          <IdeaAssistant
            project={project}
            buttonLabel="Generate an episode or film idea"
            targets={[
              {
                id: 'idea-title',
                label: 'Idea title',
                taskKind: 'outline_episode',
                instruction: 'Return a short working title for an episode or one-off film idea.',
                currentValue: ideaTitle,
                onUse: setIdeaTitle
              },
              {
                id: 'idea-premise',
                label: 'Idea premise',
                taskKind: 'outline_episode',
                instruction:
                  'Write a concise premise with protagonist want, obstacle, escalation, emotional turn, and ending promise.',
                currentValue: ideaPremise,
                onUse: setIdeaPremise
              },
              {
                id: 'idea-rationale',
                label: 'Why this fits',
                taskKind: 'check_continuity',
                instruction:
                  'Explain how the idea fits the audience, themes, format, current canon, and production limits; flag conflicts and unknowns.',
                currentValue: ideaRationale,
                onUse: setIdeaRationale
              },
              {
                id: 'idea-continuity',
                label: 'Continuity risks',
                taskKind: 'check_continuity',
                instruction:
                  'List canon dependencies, possible conflicts, missing facts, and questions to resolve before selection.',
                currentValue: ideaContinuity,
                onUse: setIdeaContinuity
              }
            ]}
          />
          <label>
            Working title <RequiredMark />
            <input value={ideaTitle} onChange={(event) => setIdeaTitle(event.target.value)} />
          </label>
          <label>
            Premise <RequiredMark />
            <textarea
              rows={5}
              value={ideaPremise}
              onChange={(event) => setIdeaPremise(event.target.value)}
            />
          </label>
          <label>
            Idea source <RequiredMark />
            <select
              value={ideaSource}
              onChange={(event) => setIdeaSource(event.target.value as typeof ideaSource)}
            >
              <option value="creator">Creator</option>
              <option value="llm-proposal">LLM proposal</option>
              <option value="audience-request">Audience request</option>
              <option value="trend-signal">Trend signal</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            Exact source label <RequiredMark />
            <input
              value={ideaSourceLabel}
              onChange={(event) => setIdeaSourceLabel(event.target.value)}
            />
          </label>
          <label>
            Why it may fit <RequiredMark />
            <textarea
              value={ideaRationale}
              onChange={(event) => setIdeaRationale(event.target.value)}
            />
          </label>
          <label>
            Continuity questions
            <textarea
              value={ideaContinuity}
              onChange={(event) => setIdeaContinuity(event.target.value)}
            />
          </label>
          <button className="button button-secondary" disabled={busy}>
            Add to idea backlog
          </button>
          <div className="record-list compact">
            {workspace.ideas.map((idea) => (
              <article key={idea.ideaId}>
                <strong>{idea.title}</strong>
                <span>
                  {idea.status} · {idea.sourceLabel}
                </span>
                <p>{idea.premise}</p>
              </article>
            ))}
          </div>
        </form>

        <form className="finish-card" onSubmit={(event) => void saveSnapshot(event)}>
          <p className="eyebrow">C · Post-release evidence</p>
          <h3>Record one official time window</h3>
          <p className="field-help">
            Copy values from YouTube Analytics or an official exported report. Rehearsal data is
            stored but excluded from baselines.
          </p>
          <label>
            Related release package
            <select
              value={snapshotReleaseId}
              onChange={(event) => setSnapshotReleaseId(event.target.value)}
            >
              <option value="">Not linked to a local package</option>
              {workspace.releasePackages.map((release) => (
                <option key={release.releaseId} value={release.releaseId}>
                  {release.releaseId.slice(-8)}
                </option>
              ))}
            </select>
          </label>
          <label>
            YouTube video ID <RequiredMark />
            <input
              value={videoId}
              onChange={(event) => setVideoId(event.target.value)}
              placeholder="The ID after youtu.be/ or v="
            />
          </label>
          <label>
            Evidence source <RequiredMark />
            <select
              value={snapshotSource}
              onChange={(event) => setSnapshotSource(event.target.value as typeof snapshotSource)}
            >
              <option value="manual-official">Manually copied official metrics</option>
              <option value="official-report">Official report file</option>
              <option value="rehearsal">Rehearsal / simulated</option>
            </select>
          </label>
          <div className="field-pair">
            <label>
              Window start <RequiredMark />
              <input
                type="date"
                value={windowStart}
                onChange={(event) => setWindowStart(event.target.value)}
              />
            </label>
            <label>
              Window end <RequiredMark />
              <input
                type="date"
                value={windowEnd}
                onChange={(event) => setWindowEnd(event.target.value)}
              />
            </label>
          </div>
          <div className="metric-grid">
            <label>
              Views <RequiredMark />
              <input
                type="number"
                min="0"
                value={views}
                onChange={(event) => setViews(event.target.value)}
              />
            </label>
            <label>
              Impressions
              <input
                type="number"
                min="0"
                value={impressions}
                onChange={(event) => setImpressions(event.target.value)}
              />
            </label>
            <label>
              Impressions CTR %
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={ctr}
                onChange={(event) => setCtr(event.target.value)}
              />
            </label>
            <label>
              Average view seconds
              <input
                type="number"
                min="0"
                step="0.1"
                value={averageViewDuration}
                onChange={(event) => setAverageViewDuration(event.target.value)}
              />
            </label>
            <label>
              Watch time hours
              <input
                type="number"
                min="0"
                step="0.01"
                value={watchTime}
                onChange={(event) => setWatchTime(event.target.value)}
              />
            </label>
            <label>
              30-second retention %
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={retention30}
                onChange={(event) => setRetention30(event.target.value)}
              />
            </label>
            <label>
              Likes
              <input
                type="number"
                min="0"
                value={likes}
                onChange={(event) => setLikes(event.target.value)}
              />
            </label>
            <label>
              Comments
              <input
                type="number"
                min="0"
                value={comments}
                onChange={(event) => setComments(event.target.value)}
              />
            </label>
            <label>
              Shares
              <input
                type="number"
                min="0"
                value={shares}
                onChange={(event) => setShares(event.target.value)}
              />
            </label>
            <label>
              Subscribers gained
              <input
                type="number"
                min="0"
                value={subscribers}
                onChange={(event) => setSubscribers(event.target.value)}
              />
            </label>
          </div>
          <label>
            Evidence notes <RequiredMark />
            <textarea
              minLength={10}
              value={evidenceNotes}
              onChange={(event) => setEvidenceNotes(event.target.value)}
              placeholder="Example: copied from YouTube Analytics Advanced Mode on this date; impressions were unavailable."
            />
            <TextRequirement
              id="evidence-notes-rule"
              value={evidenceNotes}
              minimum={10}
              maximum={4000}
            />
          </label>
          <button className="button button-secondary" disabled={busy}>
            Save immutable evidence snapshot
          </button>
        </form>

        <form className="finish-card" onSubmit={(event) => void saveLearning(event)}>
          <p className="eyebrow">D · Human-approved learning</p>
          <h3>Turn evidence into a cautious future proposal</h3>
          <fieldset>
            <legend>
              Evidence snapshots <RequiredMark />
            </legend>
            {workspace.performanceSnapshots.map((snapshot) => (
              <label className="checkbox-row" key={snapshot.snapshotId}>
                <input
                  type="checkbox"
                  checked={selectedSnapshots.includes(snapshot.snapshotId)}
                  onChange={(event) =>
                    setSelectedSnapshots((current) =>
                      event.target.checked
                        ? [...current, snapshot.snapshotId]
                        : current.filter((id) => id !== snapshot.snapshotId)
                    )
                  }
                />
                <span>
                  {snapshot.youtubeVideoId} · {snapshot.windowStart}–{snapshot.windowEnd} ·{' '}
                  {snapshot.metrics.views} views
                  {!snapshot.baselineEligible ? ' · rehearsal only' : ''}
                </span>
              </label>
            ))}
          </fieldset>
          <IdeaAssistant
            project={project}
            buttonLabel="Analyze selected evidence"
            targets={[
              {
                id: 'observation',
                label: 'Evidence observation',
                taskKind: 'analyze_performance',
                instruction: `State only what the selected evidence directly shows. Evidence:\n${currentEvidence || 'No snapshot selected yet.'}`,
                currentValue: observation,
                onUse: setObservation
              },
              {
                id: 'inference',
                label: 'Cautious inference',
                taskKind: 'analyze_performance',
                instruction: `Infer possible explanations, clearly label uncertainty and alternatives, and flag low samples or missing metrics. Evidence:\n${currentEvidence || 'No snapshot selected yet.'}`,
                currentValue: inference,
                onUse: setInference
              },
              {
                id: 'recommendation',
                label: 'Prospective recommendation',
                taskKind: 'analyze_performance',
                instruction: `Recommend one reversible future experiment with a stated scope and success evidence. It cannot change live metadata, locked media, canon, or spend. Evidence:\n${currentEvidence || 'No snapshot selected yet.'}`,
                currentValue: recommendation,
                onUse: setRecommendation
              }
            ]}
          />
          <label>
            Observation <RequiredMark />
            <textarea
              value={observation}
              onChange={(event) => setObservation(event.target.value)}
            />
          </label>
          <label>
            Inference <RequiredMark />
            <textarea value={inference} onChange={(event) => setInference(event.target.value)} />
          </label>
          <label>
            Recommendation <RequiredMark />
            <textarea
              value={recommendation}
              onChange={(event) => setRecommendation(event.target.value)}
            />
          </label>
          <div className="field-pair">
            <label>
              Confidence
              <select
                value={confidence}
                onChange={(event) => setConfidence(event.target.value as typeof confidence)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label>
              Proposed scope
              <select
                value={learningScope}
                onChange={(event) => setLearningScope(event.target.value as typeof learningScope)}
              >
                <option value="next-release">Next release only</option>
                <option value="this-project">This project</option>
                <option value="future-profile-version">Future profile version</option>
              </select>
            </label>
          </div>
          <button className="button button-secondary" disabled={busy}>
            Save learning proposal — inactive
          </button>
          <div className="record-list">
            {workspace.learnings.map((learning) => (
              <article key={learning.learningId}>
                <span
                  className={`media-state ${learning.status === 'approved' ? 'approved' : 'candidate'}`}
                >
                  {learning.status}
                </span>
                <strong>{learning.recommendation}</strong>
                <small>
                  {learning.confidence} confidence · {learning.scope}
                </small>
                {learning.status === 'proposed' && (
                  <>
                    <textarea
                      aria-label={`Reason for ${learning.learningId}`}
                      value={reviewReasons[learning.learningId] ?? ''}
                      onChange={(event) =>
                        setReviewReasons((current) => ({
                          ...current,
                          [learning.learningId]: event.target.value
                        }))
                      }
                      placeholder="Explain why this should or should not guide future work."
                    />
                    <div className="review-actions">
                      <button
                        className="button button-secondary"
                        type="button"
                        disabled={busy}
                        onClick={() => void reviewLearning(learning, 'approved')}
                      >
                        Approve future learning
                      </button>
                      <button
                        className="button button-quiet"
                        type="button"
                        disabled={busy}
                        onClick={() => void reviewLearning(learning, 'rejected')}
                      >
                        Reject learning
                      </button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        </form>
      </div>
      <div className="direction-policy-note">
        <span>i</span>
        <p>
          Automatic public publishing remains intentionally unavailable. The app creates a verified
          manual-upload package; current OAuth work is limited to a future separately reviewed,
          least-privilege connector.
        </p>
      </div>
    </section>
  )
}
