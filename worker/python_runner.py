#!/usr/bin/env python3
"""Allowlisted non-Comfy worker jobs. This file never accepts commands or URLs."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path


def fail(message: str) -> None:
    raise RuntimeError(message)


def load_spec(path_value: str) -> tuple[dict, Path]:
    path = Path(path_value).resolve(strict=True)
    if path.name != "runner-input.json":
        fail("Invalid runner input name.")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        fail("Runner input must be an object.")
    output = Path(payload.get("outputDirectory", "")).resolve()
    output.mkdir(parents=True, exist_ok=True)
    if output.parent != path.parent:
        fail("Runner output must stay inside the job directory.")
    return payload, output


def safe_name(value: object, fallback: str) -> str:
    candidate = re.sub(r"[^a-zA-Z0-9_-]+", "-", str(value)).strip("-")[:80]
    return candidate or fallback


def load_tts(model_path: str):
    import torch
    from qwen_tts import Qwen3TTSModel

    path = Path(model_path).resolve(strict=True)
    if not path.is_dir():
        fail("The verified TTS model directory is missing.")
    return Qwen3TTSModel.from_pretrained(
        str(path),
        device_map="cuda:0",
        dtype=torch.bfloat16,
        attn_implementation="sdpa",
    )


def voice_design(spec: dict, output: Path) -> None:
    import soundfile as sf
    import torch

    parameters = spec["parameters"]
    torch.manual_seed(int(parameters["seed"]))
    model = load_tts(spec["modelPaths"]["Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"])
    waves, sample_rate = model.generate_voice_design(
        text=parameters["text"],
        language=parameters["language"],
        instruct=parameters["voiceDescription"],
    )
    sf.write(str(output / "voice-design-reference.wav"), waves[0], sample_rate)
    (output / "voice-design-reference.json").write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "referenceText": parameters["text"],
                "language": parameters["language"],
                "voiceDescription": parameters["voiceDescription"],
                "seed": parameters["seed"],
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )


def parse_line_book(value: str) -> list[dict]:
    lines = json.loads(value)
    if not isinstance(lines, list) or not 1 <= len(lines) <= 50:
        fail("The line book must contain between 1 and 50 lines.")
    result: list[dict] = []
    for index, line in enumerate(lines):
        if not isinstance(line, dict) or set(line) - {"id", "text"}:
            fail("Each line book entry may contain only id and text.")
        text = line.get("text")
        if not isinstance(text, str) or not 1 <= len(text.strip()) <= 1200:
            fail("Each dialogue line must contain 1 to 1200 characters.")
        result.append({"id": safe_name(line.get("id"), f"line-{index + 1}"), "text": text})
    return result


def line_book(spec: dict, output: Path) -> None:
    import soundfile as sf
    import torch

    parameters = spec["parameters"]
    inputs = spec.get("inputPaths", [])
    if len(inputs) != 1:
        fail("Consistent dialogue generation requires exactly one approved voice reference.")
    reference = Path(inputs[0]).resolve(strict=True)
    if reference.suffix.lower() not in {".wav", ".flac", ".mp3", ".m4a", ".ogg", ".webm"}:
        fail("The voice reference must be a supported audio file.")
    torch.manual_seed(int(parameters["seed"]))
    lines = parse_line_book(parameters["lineBookJson"])
    model = load_tts(spec["modelPaths"]["Qwen/Qwen3-TTS-12Hz-1.7B-Base"])
    voice_prompt = model.create_voice_clone_prompt(
        ref_audio=str(reference),
        ref_text=parameters["referenceText"],
        x_vector_only_mode=False,
    )
    waves, sample_rate = model.generate_voice_clone(
        text=[line["text"] for line in lines],
        language=[parameters["language"] for _ in lines],
        voice_clone_prompt=voice_prompt,
    )
    for index, (line, wave) in enumerate(zip(lines, waves, strict=True), start=1):
        sf.write(str(output / f"{index:03d}-{line['id']}.wav"), wave, sample_rate)
    (output / "line-book.json").write_text(
        json.dumps({"schemaVersion": 1, "language": parameters["language"], "lines": lines}, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def technical_qc(spec: dict, output: Path) -> None:
    inputs = spec.get("inputPaths", [])
    if len(inputs) != 1:
        fail("Technical review requires exactly one approved media input.")
    source = Path(inputs[0]).resolve(strict=True)
    probe = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_format",
            "-show_streams",
            "-of",
            "json",
            str(source),
        ],
        check=True,
        capture_output=True,
        text=True,
        timeout=60,
    )
    report = {
        "schemaVersion": 1,
        "requestedChecks": spec["parameters"]["checks"],
        "expectedDialogue": spec["parameters"].get("expectedDialogue", ""),
        "technicalProbe": json.loads(probe.stdout),
        "humanReviewRequired": True,
        "limitations": [
            "This technical probe does not approve character identity, acting quality, cultural accuracy, or lip accuracy.",
            "A person must watch the complete candidate before approval.",
        ],
    }
    (output / "assistive-qc-report.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def latentsync_lip_repair(spec: dict, output: Path) -> None:
    parameters = spec["parameters"]
    if parameters.get("preserveApprovedAudio") is not True:
        fail("Lip repair must preserve the approved dialogue audio.")
    inputs = spec.get("inputPaths", [])
    if len(inputs) != 2:
        fail("Lip repair requires exactly two approved inputs: video first, dialogue audio second.")
    video = Path(inputs[0]).resolve(strict=True)
    audio = Path(inputs[1]).resolve(strict=True)
    if video.suffix.lower() not in {".mp4", ".mov", ".mkv", ".webm"}:
        fail("The first lip repair input must be a supported video.")
    if audio.suffix.lower() not in {".wav", ".flac", ".mp3", ".m4a", ".ogg", ".webm"}:
        fail("The second lip repair input must be supported dialogue audio.")

    model_root = Path(spec["modelPaths"]["ByteDance/LatentSync-1.6"]).resolve(strict=True)
    checkpoint = (model_root / "latentsync_unet.pt").resolve(strict=True)
    whisper = (model_root / "whisper" / "tiny.pt").resolve(strict=True)
    Path(spec["modelPaths"]["stabilityai/sd-vae-ft-mse"]).resolve(strict=True)
    latent_root = Path(os.environ.get("STUDIO_LATENTSYNC_ROOT", "/opt/LatentSync")).resolve(strict=True)
    python = Path(os.environ.get("STUDIO_LATENTSYNC_PYTHON", "/opt/latentsync-venv/bin/python")).resolve(strict=True)
    execution = output.parent / "latentsync-runtime"
    execution.mkdir()
    (execution / "configs").symlink_to(latent_root / "configs", target_is_directory=True)
    checkpoints = execution / "checkpoints"
    (checkpoints / "whisper").mkdir(parents=True)
    (checkpoints / "whisper" / "tiny.pt").symlink_to(whisper)
    result = output / "lip-repaired.mp4"
    environment = {
        **os.environ,
        "HF_HUB_OFFLINE": "1",
        "TRANSFORMERS_OFFLINE": "1",
        "PYTHONPATH": str(latent_root),
    }
    subprocess.run(
        [
            str(python),
            "-m",
            "scripts.inference",
            "--unet_config_path",
            str(latent_root / "configs" / "unet" / "stage2_512.yaml"),
            "--inference_ckpt_path",
            str(checkpoint),
            "--inference_steps",
            str(parameters["inferenceSteps"]),
            "--guidance_scale",
            str(parameters["guidanceScale"]),
            "--seed",
            str(parameters["seed"]),
            "--enable_deepcache",
            "--video_path",
            str(video),
            "--audio_path",
            str(audio),
            "--video_out_path",
            str(result),
        ],
        cwd=execution,
        env=environment,
        check=True,
    )
    if not result.is_file() or result.stat().st_size < 1:
        fail("LatentSync did not create a verified output file.")


def main() -> None:
    if len(sys.argv) != 2:
        fail("One runner input file is required.")
    spec, output = load_spec(sys.argv[1])
    workflow_id = spec.get("workflowId")
    if workflow_id == "qwen3-tts-voice-design":
        voice_design(spec, output)
    elif workflow_id == "qwen3-tts-line-book":
        line_book(spec, output)
    elif workflow_id == "assistive-creative-qc":
        technical_qc(spec, output)
    elif workflow_id == "latentsync-lip-repair":
        latentsync_lip_repair(spec, output)
    else:
        fail("This worker-Python workflow is not allowlisted.")


if __name__ == "__main__":
    main()
