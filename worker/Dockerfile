# syntax=docker/dockerfile:1.7
ARG BASE_IMAGE=runpod/pytorch:1.0.3-cu1281-torch280-ubuntu2404
FROM ${BASE_IMAGE}

ARG COMFY_UI_COMMIT=783545f689a0af730065994b46b382ae24844c99
ARG COMFY_LTX_COMMIT=15d09abb5a187a8dcaea2fc31fe51ee96e6c9d0d
ARG QWEN_TTS_COMMIT=022e286b98fbec7e1e916cb940cdf532cd9f488e
ARG LATENTSYNC_COMMIT=a229c3948406bc2cf6eaf4873e662e70c6a04746
ARG WORKER_RELEASE=0.9.0-candidate.1
ARG WORKFLOW_PACK_FILE=workflow-pack.candidate.json
ARG MODEL_MANIFEST_FILE=model-install-manifest.candidate.json

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates ffmpeg git nodejs python3-venv \
  && rm -rf /var/lib/apt/lists/*

RUN git clone --filter=blob:none https://github.com/Comfy-Org/ComfyUI.git /opt/ComfyUI \
  && git -C /opt/ComfyUI checkout --detach "${COMFY_UI_COMMIT}" \
  && pip install --no-cache-dir -r /opt/ComfyUI/requirements.txt

RUN mkdir -p /opt/ComfyUI/custom_nodes \
  && git clone --filter=blob:none https://github.com/Lightricks/ComfyUI-LTXVideo.git /opt/ComfyUI/custom_nodes/ComfyUI-LTXVideo \
  && git -C /opt/ComfyUI/custom_nodes/ComfyUI-LTXVideo checkout --detach "${COMFY_LTX_COMMIT}" \
  && if [ -f /opt/ComfyUI/custom_nodes/ComfyUI-LTXVideo/requirements.txt ]; then pip install --no-cache-dir -r /opt/ComfyUI/custom_nodes/ComfyUI-LTXVideo/requirements.txt; fi

RUN git clone --filter=blob:none https://github.com/QwenLM/Qwen3-TTS.git /opt/Qwen3-TTS \
  && git -C /opt/Qwen3-TTS checkout --detach "${QWEN_TTS_COMMIT}" \
  && pip install --no-cache-dir /opt/Qwen3-TTS

RUN git clone --filter=blob:none https://github.com/bytedance/LatentSync.git /opt/LatentSync \
  && git -C /opt/LatentSync checkout --detach "${LATENTSYNC_COMMIT}" \
  && python3 -m venv /opt/latentsync-venv \
  && /opt/latentsync-venv/bin/pip install --no-cache-dir -r /opt/LatentSync/requirements.txt

COPY worker/gateway.mjs worker/preflight.mjs worker/watchdog.mjs worker/python_runner.py worker/bootstrap_models.py worker/entrypoint.sh /opt/studio/
COPY config/${WORKFLOW_PACK_FILE} /opt/studio/workflow-pack.runtime.json
COPY config/${MODEL_MANIFEST_FILE} /opt/studio/model-install-manifest.runtime.json
COPY config/workflows /opt/studio/workflows

ENV STUDIO_GATEWAY_PORT=8000 \
  STUDIO_COMFY_URL=http://127.0.0.1:8188 \
  STUDIO_COMFY_INPUT_ROOT=/opt/ComfyUI/input \
  STUDIO_COMFY_OUTPUT_ROOT=/opt/ComfyUI/output \
  STUDIO_JOB_ROOT=/workspace/studio-jobs \
  STUDIO_MODEL_ROOT=/workspace \
  STUDIO_MODEL_MANIFEST=/opt/studio/model-install-manifest.runtime.json \
  STUDIO_LATENTSYNC_ROOT=/opt/LatentSync \
  STUDIO_LATENTSYNC_PYTHON=/opt/latentsync-venv/bin/python \
  HF_HOME=/workspace/models/huggingface-cache \
  HF_HUB_OFFLINE=1 \
  TRANSFORMERS_OFFLINE=1 \
  STUDIO_WORKFLOW_PACK=/opt/studio/workflow-pack.runtime.json \
  STUDIO_CAPABILITY_REPORT=/workspace/studio-capability.json \
  STUDIO_WORKER_RELEASE=${WORKER_RELEASE}

EXPOSE 8000
ENTRYPOINT ["/opt/studio/entrypoint.sh"]
