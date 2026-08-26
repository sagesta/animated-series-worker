import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { z } from 'zod'
import { WorkflowPackSchema } from '@studio/workflow-registry'

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)

export const ProductionReadinessReceiptSchema = z
  .object({
    schemaVersion: z.literal(1),
    qualificationId: z.string().min(1).max(191),
    provider: z.literal('runpod'),
    workflowPackSha256: Sha256Schema,
    workerImageDigest: Sha256Schema,
    modelStorage: z
      .object({
        verified: z.literal(true),
        method: z.enum(['network-volume', 'worker-image']),
        modelHashesVerified: z.number().int().positive()
      })
      .strict(),
    workerImage: z
      .object({
        pulledByDigest: z.literal(true),
        preflightPassed: z.literal(true),
        smokeWorkflowPassed: z.literal(true)
      })
      .strict(),
    promotionPolicy: z
      .object({
        version: z.string().min(1).max(64),
        excludedCandidateWorkflows: z.array(z.string().min(1).max(191)).max(50)
      })
      .strict(),
    automaticShutdown: z
      .object({
        idleExitPassed: z.literal(true),
        hardDeadlineExitPassed: z.literal(true),
        providerTerminationPassed: z.literal(true)
      })
      .strict(),
    testedAt: z.string().datetime({ offset: true }),
    notes: z.array(z.string().min(1).max(500)).max(20)
  })
  .strict()
export type ProductionReadinessReceipt = z.infer<typeof ProductionReadinessReceiptSchema>

export interface VerifiedProductionReadiness {
  modelStorageReady: boolean
  workerImageReady: boolean
  automaticShutdownTested: boolean
  receipt: ProductionReadinessReceipt | null
  blockers: string[]
}

const LOCKED_READINESS: VerifiedProductionReadiness = Object.freeze({
  modelStorageReady: false,
  workerImageReady: false,
  automaticShutdownTested: false,
  receipt: null,
  blockers: ['A controlled GPU qualification receipt is not installed.']
})

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

export function verifyProductionReadiness(
  workflowPackPath: string,
  receiptPath: string
): VerifiedProductionReadiness {
  try {
    const workflowPackBytes = readFileSync(workflowPackPath)
    const workflowPack = WorkflowPackSchema.parse(JSON.parse(workflowPackBytes.toString('utf8')))
    const receipt = ProductionReadinessReceiptSchema.parse(
      JSON.parse(readFileSync(receiptPath, 'utf8'))
    )
    const blockers: string[] = []
    if (workflowPack.workflows.some((workflow) => workflow.qualificationState !== 'qualified')) {
      blockers.push('The installed workflow pack still contains unqualified workflows.')
    }
    if (!workflowPack.workerImageDigest) {
      blockers.push('The installed workflow pack has no immutable worker-image digest.')
    }
    if (receipt.workflowPackSha256 !== sha256(workflowPackBytes)) {
      blockers.push('The workflow pack changed after the qualification test.')
    }
    if (workflowPack.workerImageDigest !== receipt.workerImageDigest) {
      blockers.push('The qualified worker image does not match the installed workflow pack.')
    }
    if (blockers.length > 0) {
      return {
        modelStorageReady: false,
        workerImageReady: false,
        automaticShutdownTested: false,
        receipt,
        blockers
      }
    }

    return {
      modelStorageReady: true,
      workerImageReady: true,
      automaticShutdownTested: true,
      receipt,
      blockers: []
    }
  } catch {
    return { ...LOCKED_READINESS, blockers: [...LOCKED_READINESS.blockers] }
  }
}
