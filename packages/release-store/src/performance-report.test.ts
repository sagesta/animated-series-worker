import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { parseYouTubePerformanceReport } from './performance-report'

const importedAt = '2026-08-25T08:00:00.000Z'

function report(csv: string, fileName = 'YouTube Analytics.csv') {
  return parseYouTubePerformanceReport({ fileName, bytes: Buffer.from(csv), importedAt })
}

describe('YouTube performance report import', () => {
  it('parses a bounded official CSV with quoted titles, durations, percentages, and totals', () => {
    const csv =
      '\uFEFFVideo,Video title,Views,Impressions,Impressions click-through rate (%),Average view duration,Watch time (hours),Likes,Comments,Shares,Subscribers gained,Audience retention at 30 seconds (%)\n' +
      'abc123DEF_0,"Pilot, Part One","1,250","10,000",7.5%,01:02,21.53,110,22,8,16,64.2%\n' +
      'Total,,1250,10000,7.5%,01:02,21.53,110,22,8,16,64.2%\n'
    const preview = report(csv)

    expect(preview.fileName).toBe('YouTube Analytics.csv')
    expect(preview.fileSha256).toBe(createHash('sha256').update(csv).digest('hex'))
    expect(preview.rows).toHaveLength(1)
    expect(preview.rows[0]).toMatchObject({
      rowNumber: 2,
      youtubeVideoId: 'abc123DEF_0',
      videoTitle: 'Pilot, Part One',
      metrics: {
        views: 1250,
        impressions: 10000,
        impressionsClickThroughRatePct: 7.5,
        averageViewDurationSeconds: 62,
        estimatedWatchTimeHours: 21.53,
        likes: 110,
        comments: 22,
        shares: 8,
        subscribersGained: 16,
        retentionAt30SecondsPct: 64.2
      },
      missingDataWarnings: []
    })
  })

  it('retains explicit missing-data warnings without inventing absent metrics', () => {
    const preview = report('Video,Views\nabc123DEF_0,125\n')
    expect(preview.rows[0]?.metrics.impressions).toBeNull()
    expect(preview.rows[0]?.missingDataWarnings).toContain(
      'The report did not include impressions.'
    )
  })

  it.each([
    ['unsafe path', '../report.csv', 'Video,Views\nabc123DEF_0,100\n'],
    ['wrong extension', 'report.json', 'Video,Views\nabc123DEF_0,100\n'],
    ['missing identifier column', 'report.csv', 'Title,Views\nPilot,100\n'],
    ['missing views column', 'report.csv', 'Video,Likes\nabc123DEF_0,10\n'],
    ['invalid metric', 'report.csv', 'Video,Views\nabc123DEF_0,not-a-number\n'],
    ['duplicate video ID', 'report.csv', 'Video,Views\nabc123DEF_0,100\nabc123DEF_0,120\n'],
    ['unfinished quote', 'report.csv', 'Video,Views\n"abc123DEF_0,100\n']
  ])('rejects %s', (_label, fileName, csv) => {
    expect(() => report(csv, fileName)).toThrow()
  })
})
