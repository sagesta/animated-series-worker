import { createHash } from 'node:crypto'
import { basename, extname } from 'node:path'
import {
  PerformanceMetricsSchema,
  YouTubePerformanceReportPreviewSchema,
  type PerformanceMetrics,
  type YouTubePerformanceReportPreview
} from '@studio/contracts'

const MAX_REPORT_BYTES = 5 * 1024 * 1024
const MAX_REPORT_ROWS = 500

const HEADER_ALIASES = {
  youtubeVideoId: ['video', 'video id', 'videoid', 'youtube video id'],
  videoTitle: ['video title', 'title'],
  views: ['views'],
  impressions: ['impressions'],
  impressionsClickThroughRatePct: [
    'impressions click through rate',
    'impressions click-through rate',
    'impressions click through rate pct',
    'impressions click-through rate pct',
    'impressions ctr'
  ],
  averageViewDurationSeconds: [
    'average view duration',
    'average view duration seconds',
    'avg view duration'
  ],
  estimatedWatchTimeHours: ['watch time hours', 'estimated watch time hours', 'watch time'],
  likes: ['likes'],
  comments: ['comments'],
  shares: ['shares'],
  subscribersGained: ['subscribers gained', 'subscribers'],
  retentionAt30SecondsPct: [
    'audience retention at 30 seconds',
    'retention at 30 seconds',
    '30 second retention'
  ]
} as const

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[%_]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let value = ''
  let quoted = false

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        value += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        value += character
      }
      continue
    }
    if (character === '"') {
      quoted = true
    } else if (character === ',') {
      row.push(value)
      value = ''
    } else if (character === '\n') {
      row.push(value.replace(/\r$/, ''))
      rows.push(row)
      row = []
      value = ''
    } else {
      value += character
    }
  }

  if (quoted) throw new Error('The report contains an unfinished quoted value.')
  if (value.length > 0 || row.length > 0) {
    row.push(value.replace(/\r$/, ''))
    rows.push(row)
  }
  return rows.filter((candidate) => candidate.some((cell) => cell.trim().length > 0))
}

function findColumn(headers: string[], aliases: readonly string[]): number {
  const normalizedAliases = new Set(aliases.map(normalizeHeader))
  return headers.findIndex((header) => normalizedAliases.has(header))
}

function readCell(row: string[], column: number): string {
  return column < 0 ? '' : (row[column] ?? '').trim()
}

function parseNumber(value: string, label: string, whole: boolean): number | null {
  if (!value.trim()) return null
  const normalized = value.replace(/[,%\s]/g, '')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0 || (whole && !Number.isInteger(parsed))) {
    throw new Error(`${label} must be a non-negative${whole ? ' whole' : ''} number.`)
  }
  return parsed
}

function parseDurationSeconds(value: string): number | null {
  if (!value.trim()) return null
  if (!value.includes(':')) return parseNumber(value, 'Average view duration', false)
  const parts = value.split(':')
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) {
    throw new Error('Average view duration must use seconds, MM:SS, or HH:MM:SS.')
  }
  const numbers = parts.map(Number)
  const seconds =
    numbers.length === 3
      ? numbers[0]! * 3600 + numbers[1]! * 60 + numbers[2]!
      : numbers[0]! * 60 + numbers[1]!
  return seconds
}

function parsePercentage(value: string, label: string): number | null {
  const parsed = parseNumber(value, label, false)
  if (parsed !== null && parsed > 100) throw new Error(`${label} cannot exceed 100%.`)
  return parsed
}

function parseMetrics(
  row: string[],
  columns: Record<keyof PerformanceMetrics | 'youtubeVideoId' | 'videoTitle', number>,
  rowNumber: number
): { metrics: PerformanceMetrics; missingDataWarnings: string[] } {
  try {
    const views = parseNumber(readCell(row, columns.views), 'Views', true)
    if (views === null) throw new Error('Views is required.')
    const metrics = PerformanceMetricsSchema.parse({
      views,
      impressions: parseNumber(readCell(row, columns.impressions), 'Impressions', true),
      impressionsClickThroughRatePct: parsePercentage(
        readCell(row, columns.impressionsClickThroughRatePct),
        'Impressions click-through rate'
      ),
      averageViewDurationSeconds: parseDurationSeconds(
        readCell(row, columns.averageViewDurationSeconds)
      ),
      estimatedWatchTimeHours: parseNumber(
        readCell(row, columns.estimatedWatchTimeHours),
        'Watch time',
        false
      ),
      likes: parseNumber(readCell(row, columns.likes), 'Likes', true),
      comments: parseNumber(readCell(row, columns.comments), 'Comments', true),
      shares: parseNumber(readCell(row, columns.shares), 'Shares', true),
      subscribersGained: parseNumber(
        readCell(row, columns.subscribersGained),
        'Subscribers gained',
        true
      ),
      retentionAt30SecondsPct: parsePercentage(
        readCell(row, columns.retentionAt30SecondsPct),
        '30-second retention'
      )
    })
    const missingDataWarnings = Object.entries(metrics)
      .filter(([key, metric]) => key !== 'views' && metric === null)
      .map(([key]) => `The report did not include ${key}.`)
    return { metrics, missingDataWarnings }
  } catch (error) {
    throw new Error(
      `Report row ${rowNumber} is invalid: ${error instanceof Error ? error.message : 'check its metrics.'}`
    )
  }
}

export function parseYouTubePerformanceReport(input: {
  fileName: string
  bytes: Buffer
  importedAt: string
}): YouTubePerformanceReportPreview {
  const safeName = basename(input.fileName)
  if (safeName !== input.fileName || extname(safeName).toLowerCase() !== '.csv') {
    throw new Error('Choose a YouTube Analytics CSV report file.')
  }
  if (input.bytes.length === 0 || input.bytes.length > MAX_REPORT_BYTES) {
    throw new Error('The report must be between 1 byte and 5 MiB.')
  }

  const rows = parseCsv(input.bytes.toString('utf8'))
  if (rows.length < 2)
    throw new Error('The report must contain a header and at least one video row.')
  if (rows.length - 1 > MAX_REPORT_ROWS) {
    throw new Error(`The report contains more than ${MAX_REPORT_ROWS} rows.`)
  }

  const headers = rows[0]!.map(normalizeHeader)
  const columns = Object.fromEntries(
    Object.entries(HEADER_ALIASES).map(([field, aliases]) => [field, findColumn(headers, aliases)])
  ) as Record<keyof typeof HEADER_ALIASES, number>
  if (columns.youtubeVideoId < 0 || columns.views < 0) {
    throw new Error('The report must include Video or Video ID, and Views columns.')
  }

  const seenVideoIds = new Set<string>()
  const parsedRows = rows.slice(1).flatMap((row, index) => {
    const rowNumber = index + 2
    const youtubeVideoId = readCell(row, columns.youtubeVideoId)
    if (/^total$/i.test(youtubeVideoId)) return []
    if (!/^[A-Za-z0-9_-]{6,32}$/.test(youtubeVideoId)) {
      throw new Error(`Report row ${rowNumber} does not contain a valid YouTube video ID.`)
    }
    if (seenVideoIds.has(youtubeVideoId)) {
      throw new Error(`The report contains the video ID ${youtubeVideoId} more than once.`)
    }
    seenVideoIds.add(youtubeVideoId)
    const { metrics, missingDataWarnings } = parseMetrics(row, columns, rowNumber)
    return [
      {
        rowNumber,
        youtubeVideoId,
        videoTitle: readCell(row, columns.videoTitle) || null,
        metrics,
        missingDataWarnings
      }
    ]
  })
  if (parsedRows.length === 0) throw new Error('The report does not contain a video row.')

  return YouTubePerformanceReportPreviewSchema.parse({
    fileName: safeName,
    fileSha256: createHash('sha256').update(input.bytes).digest('hex'),
    importedAt: input.importedAt,
    rows: parsedRows
  })
}
