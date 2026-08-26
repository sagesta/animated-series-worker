# syntax=docker/dockerfile:1.7
ARG BASE_IMAGE=runpod/pytorch:1.0.3-cu1281-torch280-ubuntu2404
FROM ${BASE_IMAGE}

ARG COMFY_UI_COMMIT=783545f689a0af730065994b46b382ae24844c99
ARG COMFY_LTX_COMMIT=15d09abb5a187a8dcaea2fc31fe51ee96e6c9d0d
ARG QWEN_TTS_COMMIT=022e286b98fbec7e1e916cb940cdf532cd9f488e
ARG LATENTSYNC_COMMIT=a229c3948406bc2cf6eaf4873e662e70c6a04746
ARG COMFY_TRANSFORMERS_VERSION=5.14.1
ARG LATENTSYNC_PYTHON_VERSION=3.10
# Retain the original build-cache anchor; the reported release is injected only
# after dependency layers through STUDIO_RELEASE so a tag change cannot rebuild runtimes.
ARG WORKER_RELEASE=0.10.1-candidate.1
ARG WORKFLOW_PACK_FILE=workflow-pack.candidate.json
ARG MODEL_MANIFEST_FILE=model-install-manifest.candidate.json

# The pinned LatentSync setup declares Python 3.10.13 and libgl1; its mediapipe
# pin has no Python 3.12 wheel. Use the maintained 3.10 line from the base image's
# configured Python repository. ComfyUI and Qwen continue using the base runtime.
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates ffmpeg git libgl1 nodejs python3-venv \
    "python${LATENTSYNC_PYTHON_VERSION}" "python${LATENTSYNC_PYTHON_VERSION}-venv" \
  && rm -rf /var/lib/apt/lists/*

RUN git clone --filter=blob:none https://github.com/Comfy-Org/ComfyUI.git /opt/ComfyUI \
  && git -C /opt/ComfyUI checkout --detach "${COMFY_UI_COMMIT}" \
  && pip install --no-cache-dir -r /opt/ComfyUI/requirements.txt

# LTX-2 currently excludes Transformers 5.15 because its Gemma support regressed; the
# ComfyUI requirement is open-ended, so pin the latest reviewed 5.14 patch explicitly.
# ComfyUI-LTXVideo also imports the older pyramid API removed by Kornia 0.8.3.
RUN mkdir -p /opt/ComfyUI/custom_nodes \
  && git clone --filter=blob:none https://github.com/Lightricks/ComfyUI-LTXVideo.git /opt/ComfyUI/custom_nodes/ComfyUI-LTXVideo \
  && git -C /opt/ComfyUI/custom_nodes/ComfyUI-LTXVideo checkout --detach "${COMFY_LTX_COMMIT}" \
  && if [ -f /opt/ComfyUI/custom_nodes/ComfyUI-LTXVideo/requirements.txt ]; then pip install --no-cache-dir -r /opt/ComfyUI/custom_nodes/ComfyUI-LTXVideo/requirements.txt; fi \
  && pip install --no-cache-dir "transformers==${COMFY_TRANSFORMERS_VERSION}" \
  && pip install --no-cache-dir "kornia==0.8.2" \
  && python -c "import transformers; assert transformers.__version__ == '${COMFY_TRANSFORMERS_VERSION}'; from kornia.geometry.transform.pyramid import build_laplacian_pyramid, build_pyramid, pad"

RUN git clone --filter=blob:none https://github.com/QwenLM/Qwen3-TTS.git /opt/Qwen3-TTS \
  && git -C /opt/Qwen3-TTS checkout --detach "${QWEN_TTS_COMMIT}" \
  && python3 -m venv --system-site-packages /opt/tts-venv \
  && /opt/tts-venv/bin/pip install --no-cache-dir /opt/Qwen3-TTS \
  && /opt/tts-venv/bin/python -c "from qwen_tts import Qwen3TTSModel"

RUN git clone --filter=blob:none https://github.com/bytedance/LatentSync.git /opt/LatentSync \
  && git -C /opt/LatentSync checkout --detach "${LATENTSYNC_COMMIT}" \
  && "python${LATENTSYNC_PYTHON_VERSION}" -m venv /opt/latentsync-venv \
  && /opt/latentsync-venv/bin/pip install --no-cache-dir -r /opt/LatentSync/requirements.txt

# Qwen3-TTS uses the Python sox wrapper for audio transforms; install and verify
# the matching system executable and common codecs as an explicit runtime dependency.
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends sox libsox-fmt-all \
  && command -v sox \
  && sox --version \
  && /opt/tts-venv/bin/python -c "from qwen_tts import Qwen3TTSModel" \
  && rm -rf /var/lib/apt/lists/*

COPY worker/gateway.mjs worker/preflight.mjs worker/watchdog.mjs worker/python_runner.py worker/bootstrap_models.py worker/entrypoint.sh /opt/studio/
COPY config/${WORKFLOW_PACK_FILE} /opt/studio/workflow-pack.runtime.json
COPY config/${MODEL_MANIFEST_FILE} /opt/studio/model-install-manifest.runtime.json
COPY config/workflows /opt/studio/workflows

ARG STUDIO_RELEASE=0.10.1-candidate.3
ENV STUDIO_GATEWAY_PORT=8000 \
  STUDIO_COMFY_URL=http://127.0.0.1:8188 \
  STUDIO_COMFY_INPUT_ROOT=/opt/ComfyUI/input \
  STUDIO_COMFY_OUTPUT_ROOT=/opt/ComfyUI/output \
  STUDIO_JOB_ROOT=/workspace/studio-jobs \
  STUDIO_MODEL_ROOT=/workspace \
  STUDIO_MODEL_MANIFEST=/opt/studio/model-install-manifest.runtime.json \
  STUDIO_TTS_PYTHON=/opt/tts-venv/bin/python \
  STUDIO_LATENTSYNC_ROOT=/opt/LatentSync \
  STUDIO_LATENTSYNC_PYTHON=/opt/latentsync-venv/bin/python \
  HF_HOME=/workspace/models/huggingface-cache \
  HF_HUB_OFFLINE=1 \
  TRANSFORMERS_OFFLINE=1 \
  STUDIO_WORKFLOW_PACK=/opt/studio/workflow-pack.runtime.json \
  STUDIO_CAPABILITY_REPORT=/workspace/studio-capability.json \
  STUDIO_WORKER_RELEASE=${STUDIO_RELEASE}

EXPOSE 8000
ENTRYPOINT ["/opt/studio/entrypoint.sh"]
