import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page
} from '@playwright/test'

// Playwright is required here because Vitest cannot exercise the real Electron main/preload/
// renderer boundary, native keyboard focus, or packaged-window sizing used by these checks.
const ONE_FRAME_MP4_BASE64 =
  'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAMQbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAAMgAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAjp0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAAMgAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAKAAAABaAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAADIAAAAAAABAAAAAAGybWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAoAAAACABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABXW1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAR1zdGJsAAAAuXN0c2QAAAAAAAAAAQAAAKlhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAKAAWgBIAAAASAAAAAAAAAABFUxhdmM2Mi4yOC4xMDIgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAAL2F2Y0MBQsAK/+EAGGdCwAraCjfkwEQAAAMABAAAAwAoPEiagAEABGjOD8gAAAAQcGFzcAAAAAEAAAABAAAAFGJ0cnQAAAAAAABoOAAAAAAAAAAYc3R0cwAAAAAAAAABAAAAAQAACAAAAAAcc3RzYwAAAAAAAAABAAAAAQAAAAEAAAABAAAAFHN0c3oAAAAAAAACmwAAAAEAAAAUc3RjbwAAAAAAAAABAAADQAAAAGJ1ZHRhAAAAWm1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALWlsc3QAAAAlqXRvbwAAAB1kYXRhAAAAAQAAAABMYXZmNjIuMTIuMTAyAAAACGZyZWUAAAKjbWRhdAAAAlMGBf//T9xF6b3m2Ui3lizYINkj7u94MjY0IC0gY29yZSAxNjUgcjMyMjMgMDQ4MGNiMCAtIEguMjY0L01QRUctNCBBVkMgY29kZWMgLSBDb3B5bGVmdCAyMDAzLTIwMjUgLSBodHRwOi8vd3d3LnZpZGVvbGFuLm9yZy94MjY0Lmh0bWwgLSBvcHRpb25zOiBjYWJhYz0wIHJlZj0xIGRlYmxvY2s9MDowOjAgYW5hbHlzZT0wOjAgbWU9ZGlhIHN1Ym1lPTAgcHN5PTEgcHN5X3JkPTEuMDA6MC4wMiBtaXhlZF9yZWY9MCBtZV9yYW5nZT0xNiBjaHJvbWFfbWU9MSB0cmVsbGlzPTAgOHg4ZGN0PTAgY3FtPTAgZGVhZHpvbmU9MjEsMTEgZmFzdF9wc2tpcD0xIGNocm9tYV9xcF9vZmZzZXQ9MCB0aHJlYWRzPTMgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0wIHdlaWdodHA9MCBrZXlpbnQ9MjUwIGtleWludF9taW49NSBzY2VuZWN1dD0wIGludHJhX3JlZnJlc2g9MCByYz1jcmYgbWJ0cmVlPTAgY3JmPTIzLjAgcWNvbXA9MC42MCBxcG1pbj0wIHFwbWF4PTY5IHFwc3RlcD00IGlwX3JhdGlvPTEuNDAgYXE9MACAAAAAQGWIhDoRigACOLHAAEGiOAAVk5OTk5OTk5OTrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrw='

async function launchStudio(existingUserData?: string): Promise<{
  app: ElectronApplication
  page: Page
  userData: string
}> {
  const userData = existingUserData ?? mkdtempSync(resolve(tmpdir(), 'animated-series-studio-e2e-'))
  const app = await electron.launch({
    args: [resolve(process.cwd(), 'out', 'main', 'index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'test' }
  })
  const page = await app.firstWindow()
  await page.setViewportSize({ width: 1280, height: 720 })
  await expect(
    page.getByRole('heading', { name: 'Your production library is ready.' })
  ).toBeVisible()
  return { app, page, userData }
}

async function closeStudio(
  app: ElectronApplication,
  userData: string,
  removeData = true
): Promise<void> {
  await app.close()
  if (!removeData) return
  const temporaryRoot = resolve(tmpdir())
  const resolved = resolve(userData)
  if (
    !resolved.startsWith(`${temporaryRoot}\\`) ||
    !resolved.includes('animated-series-studio-e2e-')
  ) {
    throw new Error('Refused to remove an unexpected E2E data directory.')
  }
  rmSync(resolved, { recursive: true, force: true })
}

async function setOpenFileDialog(app: ElectronApplication, filePath: string): Promise<void> {
  await app.evaluate(({ dialog }, selectedPath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selectedPath] })
  }, filePath)
}

async function openAdvancedMediaRoom(page: Page): Promise<void> {
  if ((await page.getByRole('button', { name: 'World & Cast controls' }).count()) === 0) {
    await page.getByRole('button', { name: 'Advanced Studio' }).click()
  }
  await page.getByRole('button', { name: 'World & Cast controls' }).click()
  await expect(
    page.getByRole('heading', { name: 'One approved source for every recurring detail.' })
  ).toBeVisible()
}

async function importMedia(
  app: ElectronApplication,
  page: Page,
  filePath: string,
  kind: string,
  label: string
): Promise<void> {
  await setOpenFileDialog(app, filePath)
  await page.getByLabel(/What is it/).selectOption(kind)
  await page.getByLabel(/Media name/).fill(label)
  await page.getByRole('button', { name: 'Choose file to import' }).click()
  await expect(page.getByText(/verified copy was stored/i)).toBeVisible()
}

async function approveMedia(page: Page, labels: string[]): Promise<void> {
  await page.getByRole('button', { name: 'Review' }).click()
  for (const label of labels) {
    const card = page.locator('.review-card').filter({ hasText: label })
    await card.getByLabel(/Review note/).fill('Reviewed in the automated local acceptance path.')
    await card.getByRole('button', { name: /Approve/ }).click()
    await expect(page.getByText(new RegExp(`${label} was approved`, 'i'))).toBeVisible()
  }
}

async function openProject(page: Page, title: string): Promise<void> {
  await page.getByRole('button', { name: /current production|production library/i }).click()
  await expect(
    page.getByRole('heading', { name: /Your production library is ready|Welcome back/ })
  ).toBeVisible()
  await page.getByRole('button', { name: new RegExp(title, 'i') }).click()
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible()
}

async function createProject(page: Page, title = 'The Last Kite'): Promise<void> {
  await page
    .getByRole('button', { name: /start a production|new production/i })
    .last()
    .click()
  await expect(page.getByRole('heading', { name: 'What do you want to make?' })).toBeVisible()
  await page.getByRole('button', { name: /^one-off film/i }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel(/Production title/).fill(title)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page
    .getByLabel(/Describe your story/)
    .fill('A lonely child repairs a storm-broken kite so it can carry one final message home.')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: /hand-painted 2d/i }).click()
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Continue from the next unfinished production step.' })
  ).toBeVisible()
}

test('new project exposes one resumable production run and creates an isolated local production', async ({
  browserName
}, testInfo) => {
  const { app, page, userData } = await launchStudio()
  try {
    await createProject(page)
    await expect(page.getByText('View the complete production run')).toBeVisible()
    await page.getByText('View the complete production run').click()
    const run = page.getByLabel('Complete production run')
    await expect(run.getByText('Story package', { exact: true })).toBeVisible()
    await expect(run.getByText('Character & location references', { exact: true })).toBeVisible()
    await expect(run.getByText('Storyboard frames', { exact: true })).toBeVisible()
    await expect(run.getByText('Voices & dialogue', { exact: true })).toBeVisible()
    await expect(run.getByText('Video shots', { exact: true })).toBeVisible()
    await expect(run.getByText('Edit, sound & captions', { exact: true })).toBeVisible()
    await expect(run.getByText('Verified master', { exact: true })).toBeVisible()
    await expect(run.getByText('Worker cleanup', { exact: true })).toBeVisible()
    await expect(page.getByText(/resumes from the first incomplete checkpoint/i)).toBeVisible()
    await page.screenshot({
      path: testInfo.outputPath(`${browserName}-resumable-production-run.png`),
      fullPage: true
    })
    await page.getByText('View the complete production run').click()
    await expect(page.getByText('GPU is off')).toBeVisible()
    await expect(page.getByText('Connect a writing service once')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Advanced Studio' })).toBeVisible()
    const primaryAction = await page.getByRole('button', { name: 'Open connections' }).boundingBox()
    expect(primaryAction).not.toBeNull()
    expect((primaryAction?.y ?? 720) + (primaryAction?.height ?? 1)).toBeLessThanOrEqual(720)
    await page.screenshot({
      path: testInfo.outputPath(`${browserName}-recommended-next-step.png`)
    })
    await page.getByText('Create or repair one production asset').click()
    await expect(page.getByRole('group', { name: 'One-off asset type' })).toBeVisible()
    await expect(page.getByText('Not ready yet')).toBeVisible()
    await expect(page.getByText(/Approve the cast, world, and animation look first/i)).toBeVisible()
    await page.getByLabel('One-off asset type choice').scrollIntoViewIfNeeded()
    await page.screenshot({
      path: testInfo.outputPath(`${browserName}-one-off-asset-tool-locked.png`)
    })
    const jobsBefore = await page.evaluate(async () => {
      const project = (await window.studio.projects.list()).find(
        (item) => item.title === 'The Last Kite'
      )!
      return (await window.studio.production.getWorkspace(project.id)).jobs.length
    })
    await page.getByRole('button', { name: 'Prepare one image →' }).click()
    const assetGate = page.getByRole('alertdialog')
    await expect(assetGate).toContainText('This one-off tool is not ready yet')
    await expect(assetGate).toContainText('Nothing was submitted, changed, or charged')
    await assetGate.getByRole('button', { name: 'Close' }).click()
    const jobsAfter = await page.evaluate(async () => {
      const project = (await window.studio.projects.list()).find(
        (item) => item.title === 'The Last Kite'
      )!
      return (await window.studio.production.getWorkspace(project.id)).jobs.length
    })
    expect(jobsAfter).toBe(jobsBefore)
    await page.getByRole('button', { name: /current production.*the last kite/i }).click()
    await expect(page.getByText('Queued work')).toBeVisible()
    await expect(page.getByText('Current cloud spend')).toBeVisible()
    await expect(page.getByText('Approvals needed')).toBeVisible()
    await expect(page.getByText('Draft', { exact: true })).toBeVisible()
  } finally {
    await closeStudio(app, userData)
  }
})

test('creator workbench stays within two disclosure levels at 1280 by 720', async () => {
  const { app, page, userData } = await launchStudio()
  try {
    await createProject(page, 'Two Level Studio')
    await expect(page.getByRole('button', { name: 'Story controls' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Advanced Studio' }).click()
    await expect(page.getByRole('button', { name: 'Story controls' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Generation controls' })).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    )
    expect(overflow).toBe(false)
  } finally {
    await closeStudio(app, userData)
  }
})

test('keyboard-only wizard exposes text status and an accessible correction summary', async () => {
  const { app, page, userData } = await launchStudio()
  try {
    const start = page.getByRole('button', { name: /start a production/i })
    await start.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('progressbar', { name: 'Project setup progress' })).toHaveAttribute(
      'aria-valuenow',
      '1'
    )
    await page.getByRole('button', { name: 'Continue' }).focus()
    await page.keyboard.press('Enter')
    const alert = page.getByRole('alertdialog')
    await expect(alert).toContainText('Choose whether you are making a series or a film.')
    await expect(alert).toContainText('Nothing was submitted or charged.')
    await expect(alert.getByRole('button', { name: 'Go back and fix' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(alert).toHaveCount(0)
  } finally {
    await closeStudio(app, userData)
  }
})

test('critical path 4: verified backup restores the identical manifest and approved media lineage', async () => {
  let studio = await launchStudio()
  let page = studio.page
  const { userData } = studio
  try {
    await createProject(page, 'Backup Recovery Pilot')
    await openAdvancedMediaRoom(page)
    await importMedia(
      studio.app,
      page,
      resolve(process.cwd(), 'vendor', 'shuohao-skills', 'assets', 'wechat.png'),
      'reference-image',
      'Recovery identity reference'
    )
    await approveMedia(page, ['Recovery identity reference'])
    const before = await page.evaluate(async () => {
      const project = (await window.studio.projects.list()).find(
        (item) => item.title === 'Backup Recovery Pilot'
      )!
      return {
        details: await window.studio.projects.open(project.id),
        production: await window.studio.production.getWorkspace(project.id)
      }
    })

    await openProject(page, 'Backup Recovery Pilot')
    await page.getByRole('button', { name: 'Productions' }).click()
    await page.getByRole('button', { name: 'Create verified backup' }).click()
    await expect(
      page.getByText('Verified backup complete. It is safe to use for recovery.')
    ).toBeVisible()

    await closeStudio(studio.app, userData, false)
    const projectsRoot = resolve(userData, 'projects')
    const projectFolder = resolve(projectsRoot, before.details.manifest.folderName)
    if (!projectFolder.startsWith(`${projectsRoot}${sep}`)) {
      throw new Error('Refused to remove an unexpected E2E project folder.')
    }
    rmSync(projectFolder, { recursive: true, force: true })

    studio = await launchStudio(userData)
    page = studio.page
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('button', { name: 'Restore project' }).click()
    await expect(
      page.locator('.project-switcher').filter({ hasText: 'Backup Recovery Pilot' })
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Restoring…' })).toHaveCount(0)
    const after = await page.evaluate(async () => {
      const project = (await window.studio.projects.list()).find(
        (item) => item.title === 'Backup Recovery Pilot'
      )!
      return {
        details: await window.studio.projects.open(project.id),
        production: await window.studio.production.getWorkspace(project.id)
      }
    })
    expect(after.details.manifest).toEqual(before.details.manifest)
    expect(after.production.media).toEqual(before.production.media)
    expect(after.production.media[0]).toMatchObject({
      state: 'approved',
      sha256: before.production.media[0]?.sha256
    })
  } finally {
    await closeStudio(studio.app, userData)
  }
})

test('critical path 5: cross-project reference is blocked until an explicit reviewed copy', async () => {
  const { app, page, userData } = await launchStudio()
  try {
    await createProject(page, 'Isolation Source')
    await page.getByRole('button', { name: /current production/i }).click()
    await createProject(page, 'Isolation Target')
    await openProject(page, 'Isolation Source')
    await openAdvancedMediaRoom(page)
    await importMedia(
      app,
      page,
      resolve(process.cwd(), 'vendor', 'shuohao-skills', 'assets', 'wechat.png'),
      'reference-image',
      'Approved source-only identity'
    )
    await approveMedia(page, ['Approved source-only identity'])

    const blocked = await page.evaluate(async () => {
      const projects = await window.studio.projects.list()
      const source = projects.find((item) => item.title === 'Isolation Source')!
      const target = projects.find((item) => item.title === 'Isolation Target')!
      const sourceAsset = (await window.studio.production.getWorkspace(source.id)).media[0]!
      const action = await window.studio.production.reviewMedia({
        projectId: target.id,
        assetId: sourceAsset.assetId,
        expectedSha256: sourceAsset.sha256,
        decision: 'approved',
        reason: 'Attempted direct cross-project reference.',
        confirmation: true
      })
      return {
        action,
        targetMedia: (await window.studio.production.getWorkspace(target.id)).media
      }
    })
    expect(blocked.action.ok).toBe(false)
    expect(blocked.targetMedia).toHaveLength(0)

    page.once('dialog', (dialog) => void dialog.accept())
    await page.getByRole('button', { name: 'Copy for fresh review' }).click()
    await expect(page.getByText(/verified copy was added to Isolation Target/i)).toBeVisible()
    await openProject(page, 'Isolation Target')
    await page.getByRole('button', { name: 'Review' }).click()
    await expect(page.getByRole('heading', { name: /copied for review/i }).first()).toBeVisible()
    await page.getByText('Show details', { exact: true }).first().click()
    await expect(
      page.getByText('Explicitly copied from another production and awaiting a fresh decision')
    ).toBeVisible()
  } finally {
    await closeStudio(app, userData)
  }
})

test('critical path 6: approved media produces an immutable hash-inventoried release package', async () => {
  const { app, page, userData } = await launchStudio()
  try {
    const fixtureRoot = resolve(userData, 'acceptance-fixtures')
    mkdirSync(fixtureRoot, { recursive: true })
    const masterPath = join(fixtureRoot, 'pilot-master.mp4')
    const captionPath = join(fixtureRoot, 'pilot-captions.srt')
    writeFileSync(masterPath, Buffer.from(ONE_FRAME_MP4_BASE64, 'base64'))
    writeFileSync(captionPath, '1\n00:00:00,000 --> 00:00:00,200\nOpening frame\n', 'utf8')

    await createProject(page, 'Release Package Pilot')
    await openAdvancedMediaRoom(page)
    await importMedia(app, page, masterPath, 'master-video', 'Pilot master')
    await importMedia(
      app,
      page,
      resolve(process.cwd(), 'vendor', 'shuohao-skills', 'assets', 'wechat.png'),
      'thumbnail',
      'Truthful pilot thumbnail'
    )
    await importMedia(app, page, captionPath, 'caption', 'Pilot captions')
    await approveMedia(page, ['Pilot master', 'Truthful pilot thumbnail', 'Pilot captions'])

    await page.getByRole('button', { name: 'Edit & Export' }).click()
    await expect(
      page.getByRole('heading', { name: 'Build the final package only from approved local work.' })
    ).toBeVisible()
    const timeline = page.locator('form').filter({
      has: page.getByRole('heading', { name: 'Order approved visuals and sound' })
    })
    await timeline.getByLabel(/Pilot master/).check()
    await timeline.getByRole('button', { name: 'Save timeline draft' }).click()
    await expect(
      page.getByText('Timeline draft saved. Locking is a separate human decision.')
    ).toBeVisible()
    page.once('dialog', (dialog) => void dialog.accept())
    await timeline.getByRole('button', { name: 'Lock reviewed timeline' }).click()
    await expect(page.getByText('Timeline revision locked.')).toBeVisible()

    const details = page.locator('form').filter({
      has: page.getByRole('heading', { name: 'Factual YouTube packaging' })
    })
    await details.getByLabel(/^Title/).fill('Release Package Pilot — Opening')
    await details.getByLabel('Description').fill('A locally reviewed pilot release package.')
    await details.getByRole('button', { name: 'Save release details' }).click()
    await expect(page.getByText(/Release details saved locally/)).toBeVisible()

    const attestations = page.locator('form').filter({
      has: page.getByRole('heading', { name: 'No policy answer is guessed' })
    })
    await attestations.getByLabel(/Made for kids/).selectOption('no')
    await attestations.getByLabel(/Altered or synthetic content disclosure/).selectOption('yes')
    await attestations.getByLabel(/truthfully represent/).check()
    await attestations.getByLabel(/Originality and reused-content risk/).check()
    await attestations.getByLabel(/Rights, likeness consent/).check()
    await attestations.getByLabel(/watched the complete master/).check()
    await attestations
      .getByLabel(/Review notes/)
      .fill('The complete local fixture and all release decisions were reviewed.')
    await attestations.getByRole('button', { name: 'Record new human attestation' }).click()
    await expect(page.getByText(/Human release decisions recorded/)).toBeVisible()

    const packager = page.locator('section.finish-card').filter({
      has: page.getByRole('heading', { name: 'Select the exact approved files' })
    })
    await packager.getByLabel(/Master video/).selectOption({ label: 'Pilot master' })
    await packager.getByLabel(/Thumbnail/).selectOption({ label: 'Truthful pilot thumbnail' })
    await packager.getByLabel('Pilot captions').check()
    page.once('dialog', (dialog) => void dialog.accept())
    await packager.getByRole('button', { name: 'Create verified manual-upload package' }).click()
    await expect(packager.getByText(/hash-checked files/)).toBeVisible()

    const evidence = await page.evaluate(async () => {
      const project = (await window.studio.projects.list()).find(
        (item) => item.title === 'Release Package Pilot'
      )!
      const details = await window.studio.projects.open(project.id)
      const finish = await window.studio.finish.getWorkspace(project.id)
      return { folderName: details.manifest.folderName, release: finish.releasePackages[0]! }
    })
    expect(evidence.release.state).toBe('locked')
    const packageRoot = resolve(
      userData,
      'projects',
      evidence.folderName,
      ...evidence.release.relativePath.split('/')
    )
    for (const file of evidence.release.files) {
      const filePath = resolve(packageRoot, file.fileName)
      expect(filePath.startsWith(`${packageRoot}${sep}`)).toBe(true)
      expect(statSync(filePath).size).toBe(file.byteSize)
      expect(createHash('sha256').update(readFileSync(filePath)).digest('hex')).toBe(file.sha256)
    }
  } finally {
    await closeStudio(app, userData)
  }
})
