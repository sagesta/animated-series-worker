import { randomUUID } from 'node:crypto'
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { z } from 'zod'

const WriterLockRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    pid: z.number().int().positive(),
    token: z.string().uuid(),
    workspaceRoot: z.string().min(1),
    createdAt: z.string().datetime({ offset: true })
  })
  .strict()

type WriterLockRecord = z.infer<typeof WriterLockRecordSchema>

const INCOMPLETE_LOCK_GRACE_MS = 30_000

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

function readLock(lockPath: string): WriterLockRecord | null {
  try {
    return WriterLockRecordSchema.parse(JSON.parse(readFileSync(lockPath, 'utf8')))
  } catch {
    return null
  }
}

function staleLockPath(lockPath: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `${lockPath}.stale-${timestamp}-${randomUUID()}.json`
}

export class WorkspaceWriterLock {
  readonly lockPath: string
  private readonly record: WriterLockRecord
  private released = false

  private constructor(lockPath: string, record: WriterLockRecord) {
    this.lockPath = lockPath
    this.record = record
  }

  static acquire(lockPath: string, workspaceRoot: string): WorkspaceWriterLock {
    const resolvedLockPath = resolve(lockPath)
    const resolvedWorkspaceRoot = resolve(workspaceRoot)
    mkdirSync(dirname(resolvedLockPath), { recursive: true })

    const record = WriterLockRecordSchema.parse({
      schemaVersion: 1,
      pid: process.pid,
      token: randomUUID(),
      workspaceRoot: resolvedWorkspaceRoot,
      createdAt: new Date().toISOString()
    })

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const descriptor = openSync(resolvedLockPath, 'wx')
        try {
          writeFileSync(descriptor, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
          fsyncSync(descriptor)
        } finally {
          closeSync(descriptor)
        }

        return new WorkspaceWriterLock(resolvedLockPath, record)
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        if (code !== 'EEXIST') {
          throw error
        }

        const existing = readLock(resolvedLockPath)
        if (existing && processIsAlive(existing.pid)) {
          throw new Error(
            'This project library is already open in another studio window. Close that window before continuing.'
          )
        }

        if (!existing) {
          try {
            const lockAgeMs = Date.now() - statSync(resolvedLockPath).mtimeMs
            if (lockAgeMs < INCOMPLETE_LOCK_GRACE_MS) {
              throw new Error(
                'This project library is already being opened by another studio window. Please wait a moment.'
              )
            }
          } catch (statError) {
            if (statError instanceof Error && statError.message.includes('already being opened')) {
              throw statError
            }
            if ((statError as NodeJS.ErrnoException).code !== 'ENOENT') {
              throw new Error(
                'The studio could not safely inspect the existing project-library lock.'
              )
            }
          }
        }

        try {
          renameSync(resolvedLockPath, staleLockPath(resolvedLockPath))
        } catch (renameError) {
          const renameCode = (renameError as NodeJS.ErrnoException).code
          if (renameCode !== 'ENOENT' || attempt === 2) {
            throw new Error(
              'The studio could not safely take ownership of this project library. No project was changed.'
            )
          }
        }
      }
    }

    throw new Error(
      'The studio could not safely take ownership of this project library. No project was changed.'
    )
  }

  release(): void {
    if (this.released) {
      return
    }

    this.released = true
    if (!existsSync(this.lockPath)) {
      return
    }

    const current = readLock(this.lockPath)
    if (current?.token === this.record.token) {
      unlinkSync(this.lockPath)
    }
  }
}
