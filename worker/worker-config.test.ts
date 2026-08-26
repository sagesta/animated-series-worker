import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '..')
const dockerfile = readFileSync(resolve(projectRoot, 'worker', 'Dockerfile'), 'utf8')
const buildScript = readFileSync(resolve(projectRoot, 'scripts', 'Build-GpuWorker.ps1'), 'utf8')
const qualificationBundleScript = readFileSync(
  resolve(projectRoot, 'scripts', 'New-GpuQualificationBundle.ps1'),
  'utf8'
)
const dockerIgnore = readFileSync(resolve(projectRoot, '.dockerignore'), 'utf8')
const preflight = readFileSync(resolve(projectRoot, 'worker', 'preflight.mjs'), 'utf8')
const entrypoint = readFileSync(resolve(projectRoot, 'worker', 'entrypoint.sh'), 'utf8')
const gateway = readFileSync(resolve(projectRoot, 'worker', 'gateway.mjs'), 'utf8')
const promotionScript = readFileSync(
  resolve(projectRoot, 'scripts', 'Promote-GpuWorker.mjs'),
  'utf8'
)
const liveQualificationController = readFileSync(
  resolve(projectRoot, 'scripts', 'Run-LiveGpuQualification.cjs'),
  'utf8'
)
const qualificationTemplate = JSON.parse(
  readFileSync(resolve(projectRoot, 'config', 'gpu-qualification-evidence.template.json'), 'utf8')
)
const runtimePins = JSON.parse(
  readFileSync(resolve(projectRoot, 'config', 'runtime-pins.candidate.json'), 'utf8')
)

describe('GPU worker release configuration', () => {
  it('pins every source revision and the required Kornia compatibility version', () => {
    const pins = ['COMFY_UI_COMMIT', 'COMFY_LTX_COMMIT', 'QWEN_TTS_COMMIT', 'LATENTSYNC_COMMIT']

    for (const pin of pins) {
      expect(dockerfile).toMatch(new RegExp(`ARG ${pin}=[a-f0-9]{40}(?:\\r?\\n|$)`))
      expect(dockerfile).toContain(`checkout --detach \"\${${pin}}\"`)
    }
    expect(dockerfile).toContain('kornia==0.8.2')
    expect(dockerfile).toContain('ARG COMFY_TRANSFORMERS_VERSION=5.14.1')
    expect(dockerfile).toContain('ARG LATENTSYNC_PYTHON_VERSION=3.10')
    expect(dockerfile).toContain('transformers==${COMFY_TRANSFORMERS_VERSION}')
    expect(dockerfile).toContain(
      'from kornia.geometry.transform.pyramid import build_laplacian_pyramid, build_pyramid, pad'
    )
    expect(dockerfile).toContain('from qwen_tts import Qwen3TTSModel')
    expect(dockerfile).toContain('sox libsox-fmt-all')
    expect(dockerfile).toContain('sox --version')
    expect(dockerfile).toContain('/opt/tts-venv')
    expect(dockerfile).toContain('/opt/latentsync-venv')
    expect(dockerfile).toContain('"python${LATENTSYNC_PYTHON_VERSION}" -m venv')
    expect(dockerfile).not.toContain('LTX_TRAINER_COMMIT')
    expect(dockerfile).not.toContain('/opt/ltx-trainer-venv')
    expect(runtimePins.deferredComponents.ltxTrainer).toMatchObject({
      cudaRuntime: '13.2',
      minimumNvidiaDriverMajor: 595
    })
  })

  it('supports the existing WSL2 Docker engine and keeps the build context narrow', () => {
    expect(buildScript).toContain("$dockerMode = 'wsl'")
    expect(buildScript).toContain('$wslProjectRoot = "/mnt/$wslDrive/$wslPathTail"')
    expect(buildScript).toContain('docker build --pull')
    expect(buildScript).toContain('--build-arg "STUDIO_RELEASE=$workerRelease"')
    expect(qualificationBundleScript).toContain('STUDIO_WORKER_RELEASE = $pack.packVersion')
    expect(dockerIgnore).toContain('**')
    expect(dockerIgnore).toContain('!worker/**')
    expect(dockerIgnore).toContain('!config/**')
    expect(dockerIgnore).not.toContain('!node_modules')
  })

  it('limits paid qualification downloads to accepted core models through a RunPod secret', () => {
    expect(qualificationBundleScript).toContain(
      "STUDIO_REQUIRED_MODEL_IDS = ($coreModelIds -join ',')"
    )
    expect(qualificationBundleScript).toContain(
      "STUDIO_ACCEPTED_MODEL_LICENSES = ($acceptedCoreModelIds -join ',')"
    )
    expect(qualificationBundleScript).toContain(
      "HF_TOKEN = '{{ RUNPOD_SECRET_huggingface_token }}'"
    )
    expect(qualificationBundleScript).toContain("HF_HUB_OFFLINE = '0'")
    expect(qualificationBundleScript).toContain("TRANSFORMERS_OFFLINE = '0'")
    expect(qualificationBundleScript).toContain(
      'Core qualification is blocked until these model licenses are accepted'
    )
  })

  it('embeds a decodable RGBA PNG for the real ComfyUI preflight prompt', () => {
    const encoded = /const SMOKE_PNG_BASE64 =\s*\n\s*'([^']+)'/.exec(preflight)?.[1]
    expect(encoded).toBeTruthy()
    const png = Buffer.from(encoded!, 'base64')
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    const compressed: Buffer[] = []
    let offset = 8
    while (offset < png.length) {
      const length = png.readUInt32BE(offset)
      const type = png.subarray(offset + 4, offset + 8).toString('ascii')
      if (type === 'IDAT') compressed.push(png.subarray(offset + 8, offset + 8 + length))
      offset += 12 + length
    }
    expect(inflateSync(Buffer.concat(compressed))).toHaveLength(18)
  })

  it('reports the ComfyUI CUDA runtime separately from the NVIDIA driver', () => {
    expect(preflight).toContain(
      "const cudaVersion = command('python', ['-c', 'import torch; print(torch.version.cuda)'])"
    )
    expect(preflight).toContain('cudaVersion,')
    expect(preflight).toContain('nvidiaDriverVersion,')
    expect(preflight).not.toContain('cudaVersion: nvidiaDriverVersion')
    expect(preflight).toContain('gpuClassVramGb:')
  })

  it('maps workspace models into ComfyUI and supports proxy-safe ranged downloads', () => {
    for (const category of ['diffusion_models', 'text_encoders', 'vae', 'latent_upscale_models']) {
      expect(entrypoint).toContain(category)
    }
    expect(entrypoint).toContain('ln -s "/workspace/models/${model_category}"')
    expect(gateway).toContain("request.headers.range ?? request.headers['x-studio-range']")
    expect(gateway).toContain('job.qualificationDiagnostic')
    expect(gateway).toContain('fetch(`${comfyBaseUrl}/free`')
    expect(gateway).toContain('unload_models: true, free_memory: true')
    expect(gateway).toContain("stdio: ['ignore', 'ignore', 'pipe']")
    expect(liveQualificationController).toContain(
      "if (state.controllerStatus === 'terminated') return state"
    )
  })

  it('locks the procedural foley contract to the candidate pack and worker runner', () => {
    const pack = JSON.parse(
      readFileSync(resolve(projectRoot, 'config', 'workflow-pack.candidate.json'), 'utf8')
    )
    const workflow = pack.workflows.find(
      (candidate: { workflowId: string }) =>
        candidate.workflowId === 'rights-aware-foley-generation'
    )
    const contract = readFileSync(resolve(projectRoot, 'config', workflow.templatePath))
    expect(createHash('sha256').update(contract).digest('hex')).toBe(workflow.templateSha256)
    expect(workflow.requiredModels).toEqual([])
    expect(workflow.minimumVramGb).toBe(0)
    expect(readFileSync(resolve(projectRoot, 'worker', 'python_runner.py'), 'utf8')).toContain(
      'elif workflow_id == "rights-aware-foley-generation"'
    )
  })

  it('keeps project adaptation locked while excluding its trainer from the core image', () => {
    const pack = JSON.parse(
      readFileSync(resolve(projectRoot, 'config', 'workflow-pack.candidate.json'), 'utf8')
    )
    const workflow = pack.workflows.find(
      (candidate: { workflowId: string }) =>
        candidate.workflowId === 'ltx25-project-lora-adaptation'
    )
    expect(workflow.minimumVramGb).toBe(80)
    expect(workflow.requiredModels.map((model: { modelId: string }) => model.modelId)).toEqual([
      'Lightricks/LTX-2.5/dev-transformer-bf16',
      'Lightricks/LTX-2.5/gemma4-text-encoder-bf16',
      'Lightricks/LTX-2.5/video-vae-bf16',
      'Lightricks/LTX-2.5/audio-vae-bf16'
    ])
    const contract = readFileSync(resolve(projectRoot, 'config', workflow.templatePath))
    expect(createHash('sha256').update(contract).digest('hex')).toBe(workflow.templateSha256)
    const runner = readFileSync(resolve(projectRoot, 'worker', 'python_runner.py'), 'utf8')
    const gateway = readFileSync(resolve(projectRoot, 'worker', 'gateway.mjs'), 'utf8')
    expect(runner).toContain('elif workflow_id == "ltx25-project-lora-adaptation"')
    expect(runner).toContain('LTX_TRAINER_COMMIT = "400fd31054597515f47125691032c04b1c3ee24e"')
    expect(gateway).toContain("'/opt/ltx-trainer-venv/bin/python'")
    expect(gateway).toContain('The pinned LTX trainer runtime is unavailable.')
    expect(dockerfile).not.toContain('/opt/ltx-trainer-venv')
  })

  it('promotes the core independently while advanced profiles remain locked', () => {
    const required = [
      'BENCH-CREATIVE-QC',
      'SECURITY-NODE-ALLOWLIST',
      'RECOVERY-DOWNLOAD-RESUME',
      'LOCAL-FINISHING-SUITE'
    ]
    const templateIds = qualificationTemplate.tests.map((item: { testId: string }) => item.testId)
    for (const testId of required) {
      expect(promotionScript).toContain(`'${testId}'`)
      expect(templateIds).toContain(testId)
    }
    for (const deferred of [
      'BENCH-LTX-NATIVE-AUDIO',
      'BENCH-QWEN-CONTROL',
      'BENCH-LTX-CONTROL',
      'BENCH-FOLEY',
      'BENCH-ADAPTATION',
      'COMPAT-TRAINER-CUDA-DRIVER'
    ]) {
      expect(promotionScript).not.toContain(`'${deferred}'`)
      expect(templateIds).not.toContain(deferred)
    }
    expect(promotionScript).toContain('const productionWorkflows = coreWorkflows.map')
  })
})
