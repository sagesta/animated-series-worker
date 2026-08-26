#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ! "${STUDIO_GATEWAY_TOKEN_HASH:-}" =~ ^[a-f0-9]{64}$ ]]; then
  echo "Worker token hash is missing." >&2
  exit 64
fi

if [[ ! "${STUDIO_LEASE_ID:-}" =~ ^[0-9A-HJKMNP-TV-Z]{26}$ ]]; then
  echo "Worker lease identity is missing." >&2
  exit 64
fi

if [[ -z "${STUDIO_HARD_DEADLINE:-}" ]]; then
  echo "Worker hard deadline is missing." >&2
  exit 64
fi

cleanup() {
  trap - EXIT INT TERM
  jobs -pr | xargs -r kill 2>/dev/null || true
  wait || true
}
trap cleanup EXIT INT TERM

mkdir -p /workspace/models /workspace/studio-jobs /opt/ComfyUI/input /opt/ComfyUI/output

# ComfyUI's built-in model registry scans /opt/ComfyUI/models. The immutable
# worker keeps large model bytes on the mounted workspace, so expose only the
# allowlisted model categories through fixed links before ComfyUI starts.
for model_category in diffusion_models text_encoders vae latent_upscale_models; do
  mkdir -p "/workspace/models/${model_category}"
  rm -rf "/opt/ComfyUI/models/${model_category}"
  ln -s "/workspace/models/${model_category}" "/opt/ComfyUI/models/${model_category}"
done

case "${STUDIO_MODEL_BOOTSTRAP_MODE:-off}" in
  off) ;;
  qualification) python /opt/studio/bootstrap_models.py --qualification ;;
  production) python /opt/studio/bootstrap_models.py ;;
  *)
    echo "Model bootstrap mode must be off, qualification, or production." >&2
    exit 64
    ;;
esac

python /opt/ComfyUI/main.py \
  --listen 127.0.0.1 \
  --port 8188 \
  --disable-auto-launch \
  --output-directory /opt/ComfyUI/output \
  --input-directory /opt/ComfyUI/input &

node /opt/studio/watchdog.mjs &
node /opt/studio/preflight.mjs
node /opt/studio/gateway.mjs &

wait -n
exit 70
