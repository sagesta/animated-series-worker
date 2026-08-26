import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const workflowPath = fileURLToPath(
  new URL('../.github/workflows/sign-worker-image.yml', import.meta.url),
)
const workflow = readFileSync(workflowPath, 'utf8')

describe('GPU worker signing workflow', () => {
  it('is manual-only, main-only, and bound to the protected signing environment', () => {
    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).not.toMatch(/^\s{2}(push|pull_request|schedule):/m)
    expect(workflow).toContain("if: github.ref == 'refs/heads/main'")
    expect(workflow).toContain('environment: worker-signing')
    expect(workflow).toContain('permissions: {}')
  })

  it('has only the permissions needed for GHCR keyless signing', () => {
    expect(workflow).toContain('contents: read')
    expect(workflow).toContain('id-token: write')
    expect(workflow).toContain('packages: write')
  })

  it('pins the package, actions, Cosign release, and canonical OIDC identity', () => {
    expect(workflow).toContain('IMAGE_NAME: ghcr.io/sagesta/animated-series-worker')
    expect(workflow).toContain(
      'sigstore/cosign-installer@6f9f17788090df1f26f669e9d70d6ae9567deba6',
    )
    expect(workflow).toContain(
      'docker/login-action@dbcb813823bdd20940b903addbd779551569679f',
    )
    expect(workflow).toContain('cosign-release: v3.1.3')
    expect(workflow).toContain(
      'SIGNING_IDENTITY: https://github.com/sagesta/animated-series-worker/.github/workflows/sign-worker-image.yml@refs/heads/main',
    )
    expect(workflow).toContain('SIGNING_ISSUER: https://token.actions.githubusercontent.com')
  })

  it('validates both immutable digests and verifies the signature after signing', () => {
    expect(workflow).toContain('^sha256:[0-9a-f]{64}$')
    expect(workflow).toContain("jq -r '.config.digest'")
    expect(workflow).toContain('cosign sign --yes "${IMAGE_NAME}@${IMAGE_DIGEST}"')
    expect(workflow).toContain('--certificate-identity "${SIGNING_IDENTITY}"')
    expect(workflow).toContain('--certificate-oidc-issuer "${SIGNING_ISSUER}"')
  })
})
