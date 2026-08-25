#!/usr/bin/env python3
"""Allowlisted non-Comfy worker jobs. This file never accepts commands or URLs."""

from __future__ import annotations

import json
import hashlib
import math
import os
import random
import re
import shutil
import struct
import subprocess
import sys
import wave
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


FOLEY_GENERATORS = {
    "room-tone",
    "wind",
    "rain",
    "footstep",
    "impact",
    "whoosh",
    "tone",
}


def parse_foley_cue_sheet(value: str) -> dict:
    """Validate the intentionally small, rights-auditable procedural sound contract."""
    try:
        sheet = json.loads(value)
    except (TypeError, json.JSONDecodeError) as error:
        fail(f"The foley cue sheet must be valid JSON: {error.msg if hasattr(error, 'msg') else error}.")
    if not isinstance(sheet, dict) or set(sheet) - {"schemaVersion", "durationSeconds", "cues"}:
        fail("The foley cue sheet may contain only schemaVersion, durationSeconds, and cues.")
    if sheet.get("schemaVersion") != 1:
        fail("The foley cue sheet schemaVersion must be 1.")
    duration = sheet.get("durationSeconds")
    if isinstance(duration, bool) or not isinstance(duration, (int, float)) or not 0.1 <= duration <= 120:
        fail("The foley layer duration must be between 0.1 and 120 seconds.")
    cues = sheet.get("cues")
    if not isinstance(cues, list) or not 1 <= len(cues) <= 100:
        fail("The foley cue sheet must contain between 1 and 100 cues.")

    seen: set[str] = set()
    validated: list[dict] = []
    for index, cue in enumerate(cues):
        allowed = {
            "cueId",
            "kind",
            "description",
            "generator",
            "startSeconds",
            "durationSeconds",
            "gainDb",
            "rightsBasis",
        }
        if not isinstance(cue, dict) or set(cue) - allowed:
            fail(f"Foley cue {index + 1} contains an unsupported field.")
        cue_id = safe_name(cue.get("cueId"), "")
        if not cue_id or cue_id in seen:
            fail("Every foley cue needs a unique cueId.")
        seen.add(cue_id)
        if cue.get("kind") not in {"ambience", "effect", "foley"}:
            fail(f"Foley cue {cue_id} needs an ambience, effect, or foley kind.")
        description = cue.get("description")
        if not isinstance(description, str) or not 1 <= len(description.strip()) <= 240:
            fail(f"Foley cue {cue_id} needs a description of 1 to 240 characters.")
        generator = cue.get("generator")
        if generator not in FOLEY_GENERATORS:
            fail(f"Foley cue {cue_id} uses an unsupported procedural generator.")
        start = cue.get("startSeconds")
        cue_duration = cue.get("durationSeconds")
        gain_db = cue.get("gainDb", -12)
        numeric = (int, float)
        if (
            isinstance(start, bool)
            or not isinstance(start, numeric)
            or start < 0
            or isinstance(cue_duration, bool)
            or not isinstance(cue_duration, numeric)
            or not 0.02 <= cue_duration <= 30
            or start + cue_duration > duration + 1e-9
        ):
            fail(f"Foley cue {cue_id} must fit completely inside the layer duration.")
        if isinstance(gain_db, bool) or not isinstance(gain_db, numeric) or not -60 <= gain_db <= 0:
            fail(f"Foley cue {cue_id} gain must be between -60 dB and 0 dB.")
        if cue.get("rightsBasis") != "procedural-original":
            fail(
                f"Foley cue {cue_id} must record rightsBasis as procedural-original; imported recordings use the media-import path."
            )
        validated.append(
            {
                "cueId": cue_id,
                "kind": cue["kind"],
                "description": description.strip(),
                "generator": generator,
                "startSeconds": float(start),
                "durationSeconds": float(cue_duration),
                "gainDb": float(gain_db),
                "rightsBasis": "procedural-original",
            }
        )
    return {"schemaVersion": 1, "durationSeconds": float(duration), "cues": validated}


def procedural_sample(generator: str, progress: float, sample_index: int, rng: random.Random) -> float:
    envelope = max(0.0, math.sin(math.pi * min(1.0, max(0.0, progress))))
    noise = rng.uniform(-1.0, 1.0)
    if generator == "room-tone":
        return noise * 0.12
    if generator == "wind":
        return (noise * 0.2 + math.sin(sample_index * 0.0009) * 0.15) * envelope
    if generator == "rain":
        drop = rng.uniform(-1.0, 1.0) if rng.random() < 0.018 else 0.0
        return noise * 0.08 + drop * 0.7
    if generator == "footstep":
        return (math.sin(sample_index * 0.045) * 0.7 + noise * 0.25) * math.exp(-7 * progress)
    if generator == "impact":
        return (math.sin(sample_index * 0.025) * 0.8 + noise * 0.35) * math.exp(-9 * progress)
    if generator == "whoosh":
        return noise * envelope * (0.2 + 0.8 * progress)
    return math.sin(sample_index * 2 * math.pi * 440 / 48_000) * envelope * 0.4


def rights_aware_foley(spec: dict, output: Path) -> None:
    parameters = spec["parameters"]
    if parameters.get("preserveDialogue") is not True:
        fail("Foley generation must preserve dialogue as a separate immutable layer.")
    if spec.get("inputPaths"):
        fail("Procedural foley does not accept or rewrite dialogue, music, or imported recordings.")
    cue_sheet = parse_foley_cue_sheet(parameters["cueSheetJson"])
    sample_rate = 48_000
    total_samples = math.ceil(cue_sheet["durationSeconds"] * sample_rate)
    mixed = [0.0] * total_samples
    base_seed = int(parameters["seed"])
    for cue_index, cue in enumerate(cue_sheet["cues"]):
        cue_seed = int.from_bytes(
            hashlib.sha256(f"{base_seed}:{cue['cueId']}:{cue_index}".encode()).digest()[:8],
            "big",
        )
        rng = random.Random(cue_seed)
        start = round(cue["startSeconds"] * sample_rate)
        count = max(1, round(cue["durationSeconds"] * sample_rate))
        gain = 10 ** (cue["gainDb"] / 20)
        for offset in range(count):
            destination = start + offset
            if destination >= total_samples:
                break
            progress = offset / max(1, count - 1)
            mixed[destination] += procedural_sample(
                cue["generator"], progress, offset, rng
            ) * gain

    wav_path = output / "foley-layer.wav"
    with wave.open(str(wav_path), "wb") as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(sample_rate)
        frames = bytearray()
        for sample in mixed:
            frames.extend(struct.pack("<h", round(max(-1.0, min(1.0, sample)) * 32767)))
        target.writeframes(frames)

    wav_hash = hashlib.sha256(wav_path.read_bytes()).hexdigest()
    manifest = {
        "schemaVersion": 1,
        "generator": "studio-procedural-foley-v1",
        "seed": base_seed,
        "sampleRate": sample_rate,
        "channels": 1,
        "dialoguePreservedSeparately": True,
        "sourceRecordingsUsed": False,
        "outputSha256": wav_hash,
        "cueSheet": cue_sheet,
        "humanReviewRequired": True,
        "limitations": [
            "This procedural layer is a starting point and must be auditioned in context.",
            "It never replaces dialogue or music and it cannot approve its own rights or quality.",
        ],
    }
    (output / "foley-manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
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


ADAPTATION_RIGHTS_BASES = {"owned-original", "licensed-for-model-training"}
ADAPTATION_MEDIA_SUFFIXES = {".mp4", ".mov", ".mkv", ".webm", ".png", ".jpg", ".jpeg", ".webp"}
ADAPTATION_BUCKETS = {"576x576x1", "576x576x49", "768x448x1", "768x448x49"}
LTX_TRAINER_COMMIT = "400fd31054597515f47125691032c04b1c3ee24e"


def parse_adaptation_manifest(path: Path, input_paths: list[Path]) -> dict:
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        fail(f"The adaptation manifest is unreadable: {error}.")
    allowed = {
        "schemaVersion",
        "purpose",
        "projectScopeOnly",
        "humanRightsReviewConfirmed",
        "trainingSteps",
        "learningRate",
        "resolutionBuckets",
        "samples",
    }
    if not isinstance(manifest, dict) or set(manifest) - allowed:
        fail("The adaptation manifest contains an unsupported field.")
    if manifest.get("schemaVersion") != 1:
        fail("The adaptation manifest schemaVersion must be 1.")
    purpose = manifest.get("purpose")
    if not isinstance(purpose, str) or not 10 <= len(purpose.strip()) <= 500:
        fail("The adaptation purpose must contain 10 to 500 characters.")
    if manifest.get("projectScopeOnly") is not True:
        fail("An adaptation must remain scoped to this project.")
    if manifest.get("humanRightsReviewConfirmed") is not True:
        fail("A person must confirm the dataset rights review.")
    steps = manifest.get("trainingSteps")
    if isinstance(steps, bool) or not isinstance(steps, int) or not 100 <= steps <= 2_000:
        fail("Adaptation trainingSteps must be between 100 and 2000.")
    learning_rate = manifest.get("learningRate")
    if (
        isinstance(learning_rate, bool)
        or not isinstance(learning_rate, (int, float))
        or not 0.000001 <= learning_rate <= 0.001
    ):
        fail("The adaptation learningRate is outside the reviewed range.")
    buckets = manifest.get("resolutionBuckets")
    if (
        not isinstance(buckets, list)
        or not 1 <= len(buckets) <= 4
        or any(bucket not in ADAPTATION_BUCKETS for bucket in buckets)
        or len(set(buckets)) != len(buckets)
    ):
        fail("The adaptation resolution buckets are unsupported.")
    samples = manifest.get("samples")
    if not isinstance(samples, list) or not 4 <= len(samples) <= 100:
        fail("An adaptation dataset must contain between 4 and 100 reviewed samples.")

    rows: list[dict] = []
    sample_records: list[dict] = []
    used_orders: set[int] = set()
    for index, sample in enumerate(samples):
        sample_allowed = {
            "inputOrder",
            "assetId",
            "sha256",
            "caption",
            "rightsBasis",
            "licenseReference",
            "consentConfirmed",
        }
        if not isinstance(sample, dict) or set(sample) - sample_allowed:
            fail(f"Adaptation sample {index + 1} contains an unsupported field.")
        order = sample.get("inputOrder")
        if (
            isinstance(order, bool)
            or not isinstance(order, int)
            or not 2 <= order <= len(input_paths)
            or order in used_orders
        ):
            fail(f"Adaptation sample {index + 1} has an invalid or repeated inputOrder.")
        used_orders.add(order)
        asset_id = sample.get("assetId")
        if not isinstance(asset_id, str) or not re.fullmatch(
            r"[0-9A-HJKMNP-TV-Z]{26}", asset_id
        ):
            fail(f"Adaptation sample {index + 1} has an invalid asset identity.")
        expected_sha256 = sample.get("sha256")
        if not isinstance(expected_sha256, str) or not re.fullmatch(
            r"[a-f0-9]{64}", expected_sha256
        ):
            fail(f"Adaptation sample {index + 1} has an invalid file hash.")
        caption = sample.get("caption")
        if not isinstance(caption, str) or not 10 <= len(caption.strip()) <= 1_500:
            fail(f"Adaptation sample {index + 1} needs a reviewed caption.")
        rights_basis = sample.get("rightsBasis")
        if rights_basis not in ADAPTATION_RIGHTS_BASES:
            fail(f"Adaptation sample {index + 1} has an unsupported rights basis.")
        license_reference = sample.get("licenseReference")
        if rights_basis == "licensed-for-model-training":
            if not isinstance(license_reference, str) or not 3 <= len(license_reference.strip()) <= 300:
                fail(f"Adaptation sample {index + 1} needs its training license reference.")
        elif license_reference is not None:
            fail(f"Adaptation sample {index + 1} must not invent a license reference.")
        if sample.get("consentConfirmed") is not True:
            fail(f"Adaptation sample {index + 1} needs a human consent decision.")
        media = input_paths[order - 1].resolve(strict=True)
        if not media.is_file() or media.suffix.lower() not in ADAPTATION_MEDIA_SUFFIXES:
            fail(f"Adaptation sample {index + 1} is not a supported image or video input.")
        actual_sha256 = hashlib.sha256(media.read_bytes()).hexdigest()
        if actual_sha256 != expected_sha256:
            fail(f"Adaptation sample {index + 1} changed after the rights review.")
        rows.append({"video": str(media), "caption": caption.strip()})
        sample_records.append(
            {
                "assetId": asset_id,
                "sha256": actual_sha256,
                "inputOrder": order,
            }
        )

    expected_orders = set(range(2, len(input_paths) + 1))
    if used_orders != expected_orders:
        fail("Every uploaded adaptation sample must appear exactly once in the reviewed manifest.")
    return {
        "purpose": purpose.strip(),
        "projectScopeOnly": True,
        "trainingSteps": steps,
        "learningRate": float(learning_rate),
        "resolutionBuckets": buckets,
        "rows": rows,
        "sampleRecords": sample_records,
        "rightsBases": sorted({sample["rightsBasis"] for sample in samples}),
    }


def ltx_project_adaptation(
    spec: dict,
    output: Path,
    *,
    trainer_root_override: Path | None = None,
    run_process=subprocess.run,
) -> None:
    parameters = spec["parameters"]
    if parameters.get("baseModel") != "Lightricks/LTX-2.5":
        fail("Project adaptation is locked to the reviewed LTX 2.5 base model family.")
    if parameters.get("referenceBenchmarkFailed") is not True:
        fail("Project adaptation requires a recorded failed reference-only benchmark.")
    if parameters.get("rightsConfirmed") is not True:
        fail("Project adaptation requires an explicit dataset rights confirmation.")
    trigger = parameters.get("triggerPhrase")
    if not isinstance(trigger, str) or not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_-]{2,59}", trigger):
        fail("The project adaptation trigger phrase is invalid.")
    inputs = [Path(value).resolve(strict=True) for value in spec.get("inputPaths", [])]
    if len(inputs) < 5 or inputs[0].suffix.lower() != ".json":
        fail("Project adaptation requires one manifest followed by at least four reviewed samples.")
    manifest = parse_adaptation_manifest(inputs[0], inputs)

    declaration = json.loads(parameters["datasetManifestJson"])
    if (
        not isinstance(declaration, dict)
        or set(declaration) != {"direction", "assets"}
        or not isinstance(declaration["assets"], list)
        or len(declaration["assets"]) != len(inputs)
    ):
        fail("The adaptation input declaration does not match the uploaded dataset.")
    declared_assets = declaration["assets"]
    for index, declared in enumerate(declared_assets):
        if (
            not isinstance(declared, dict)
            or declared.get("order") != index + 1
            or not isinstance(declared.get("assetId"), str)
            or not isinstance(declared.get("sha256"), str)
        ):
            fail("The adaptation input declaration contains an invalid ordered asset.")
    manifest_sha256 = hashlib.sha256(inputs[0].read_bytes()).hexdigest()
    if declared_assets[0].get("sha256") != manifest_sha256:
        fail("The adaptation rights manifest changed after job approval.")
    for row in manifest["sampleRecords"]:
        declared = declared_assets[row["inputOrder"] - 1]
        if declared.get("assetId") != row["assetId"] or declared.get("sha256") != row["sha256"]:
            fail("The reviewed adaptation samples do not match the approved job inputs.")

    required_models = {
        "Lightricks/LTX-2.5/dev-transformer-bf16",
        "Lightricks/LTX-2.5/gemma4-text-encoder-bf16",
        "Lightricks/LTX-2.5/video-vae-bf16",
        "Lightricks/LTX-2.5/audio-vae-bf16",
    }
    if set(spec.get("modelPaths", {})) != required_models:
        fail("The exact reviewed LTX adaptation model set is unavailable.")
    models = {key: Path(value).resolve(strict=True) for key, value in spec["modelPaths"].items()}
    if any(not path.is_file() for path in models.values()):
        fail("An LTX adaptation model component is missing.")

    if trainer_root_override is None:
        trainer_setting = os.environ.get("STUDIO_LTX_TRAINER_ROOT", "/opt/LTX-2")
        if trainer_setting != "/opt/LTX-2":
            fail("The LTX trainer source path is fixed by the worker image.")
        trainer_root = Path(trainer_setting).resolve(strict=True)
    else:
        trainer_root = trainer_root_override.resolve(strict=True)
    trainer_package = trainer_root / "packages" / "ltx-trainer"
    process_script = trainer_package / "scripts" / "process_dataset.py"
    train_script = trainer_package / "scripts" / "train.py"
    if not process_script.is_file() or not train_script.is_file():
        fail("The pinned LTX trainer runtime is incomplete.")

    runtime = output.parent / "adaptation-runtime"
    runtime.mkdir()
    dataset_path = runtime / "dataset.json"
    dataset_path.write_text(
        json.dumps(manifest["rows"], indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    precomputed = runtime / "precomputed"
    model_path = models["Lightricks/LTX-2.5/dev-transformer-bf16"]
    text_encoder_path = models["Lightricks/LTX-2.5/gemma4-text-encoder-bf16"]
    video_vae_path = models["Lightricks/LTX-2.5/video-vae-bf16"]
    audio_vae_path = models["Lightricks/LTX-2.5/audio-vae-bf16"]
    environment = {
        **os.environ,
        "HF_HUB_OFFLINE": "1",
        "TRANSFORMERS_OFFLINE": "1",
        "WANDB_MODE": "disabled",
    }
    run_process(
        [
            sys.executable,
            str(process_script),
            str(dataset_path),
            "--resolution-buckets",
            ";".join(manifest["resolutionBuckets"]),
            "--model-path",
            str(model_path),
            "--text-encoder-path",
            str(text_encoder_path),
            "--video-vae-path",
            str(video_vae_path),
            "--audio-vae-path",
            str(audio_vae_path),
            "--output-dir",
            str(precomputed),
            "--lora-trigger",
            trigger,
            "--skip-audio",
            "--vae-tiling",
        ],
        cwd=trainer_package,
        env=environment,
        check=True,
    )
    training_output = runtime / "training-output"
    training_config = {
        "model": {
            "model_path": str(model_path),
            "text_encoder_path": str(text_encoder_path),
            "video_vae_path": str(video_vae_path),
            "audio_vae_path": str(audio_vae_path),
            "training_mode": "lora",
            "load_checkpoint": None,
        },
        "lora": {
            "rank": 32,
            "alpha": 32,
            "dropout": 0.0,
            "target_modules": ["to_k", "to_q", "to_v", "to_out.0"],
        },
        "training_strategy": {
            "name": "flexible",
            "video": {"is_generated": True, "latents_dir": "latents"},
            "audio": None,
        },
        "optimization": {
            "learning_rate": manifest["learningRate"],
            "steps": manifest["trainingSteps"],
            "batch_size": 1,
            "gradient_accumulation_steps": 1,
            "max_grad_norm": 1.0,
            "optimizer_type": "adamw",
            "scheduler_type": "linear",
            "scheduler_params": {},
            "enable_gradient_checkpointing": True,
        },
        "acceleration": {
            "mixed_precision_mode": "bf16",
            "quantization": None,
            "load_text_encoder_in_8bit": False,
            "offload_optimizer_during_validation": False,
        },
        "data": {"preprocessed_data_root": str(precomputed), "num_dataloader_workers": 2},
        "validation": {"samples": [], "interval": None},
        "checkpoints": {
            "interval": min(250, manifest["trainingSteps"]),
            "keep_last_n": 2,
            "precision": "bfloat16",
            "no_resume": True,
            "save_training_state": "off",
        },
        "hub": {"push_to_hub": False, "hub_model_id": None},
        "wandb": {"enabled": False, "log_validation_videos": False},
        "seed": int(parameters["seed"]),
        "output_dir": str(training_output),
    }
    config_path = runtime / "training-config.json"
    config_path.write_text(json.dumps(training_config, indent=2) + "\n", encoding="utf-8")
    run_process(
        [sys.executable, str(train_script), str(config_path), "--disable-progress-bars"],
        cwd=trainer_package,
        env=environment,
        check=True,
    )
    checkpoints = sorted(training_output.rglob("*_weights_step_*.safetensors"))
    if not checkpoints or checkpoints[-1].stat().st_size < 1:
        fail("The pinned LTX trainer did not create a LoRA checkpoint.")
    lora_path = output / "project-lora.safetensors"
    shutil.copyfile(checkpoints[-1], lora_path)
    lora_hash = hashlib.sha256(lora_path.read_bytes()).hexdigest()
    (output / "adaptation-training-config.json").write_text(
        json.dumps(training_config, indent=2) + "\n", encoding="utf-8"
    )
    (output / "adaptation-manifest.json").write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "trainerRepository": "https://github.com/Lightricks/LTX-2.git",
                "trainerCommit": LTX_TRAINER_COMMIT,
                "baseModel": parameters["baseModel"],
                "projectScopeOnly": True,
                "purpose": manifest["purpose"],
                "sampleCount": len(manifest["rows"]),
                "rightsBases": manifest["rightsBases"],
                "triggerPhrase": trigger,
                "trainingSteps": manifest["trainingSteps"],
                "learningRate": manifest["learningRate"],
                "seed": int(parameters["seed"]),
                "loraSha256": lora_hash,
                "promotionState": "candidate-review-required",
                "humanReviewRequired": True,
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )


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
    elif workflow_id == "rights-aware-foley-generation":
        rights_aware_foley(spec, output)
    elif workflow_id == "ltx25-project-lora-adaptation":
        ltx_project_adaptation(spec, output)
    else:
        fail("This worker-Python workflow is not allowlisted.")


if __name__ == "__main__":
    main()
