#!/usr/bin/env python3
"""Install only the revision-pinned model files declared by the studio manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
from pathlib import Path

from huggingface_hub import hf_hub_download, snapshot_download


def fail(message: str) -> None:
    raise RuntimeError(message)


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def path_hash(path: Path) -> str:
    if path.is_file():
        return file_hash(path)
    if not path.is_dir():
        fail("A downloaded model path is unavailable.")
    digest = hashlib.sha256()
    for child in sorted(path.rglob("*"), key=lambda item: item.relative_to(path).as_posix()):
        relative = child.relative_to(path).as_posix()
        if child.is_dir():
            digest.update(f"directory\0{relative}\0".encode())
        elif child.is_file():
            digest.update(f"file\0{relative}\0{file_hash(child)}\0".encode())
        else:
            fail("A model snapshot contains an unsupported filesystem entry.")
    return digest.hexdigest()


def safe_destination(root: Path, relative_value: str) -> Path:
    relative = Path(relative_value)
    if relative.is_absolute() or ".." in relative.parts:
        fail("A model destination is unsafe.")
    destination = (root / relative).resolve()
    if destination == root or root not in destination.parents:
        fail("A model destination escaped persistent storage.")
    return destination


def install_file(entry: dict, destination: Path, token: str | None) -> None:
    source = hf_hub_download(
        repo_id=entry["repository"],
        filename=entry["sourcePath"],
        revision=entry["revision"],
        token=token,
    )
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(f"{destination.name}.partial")
    temporary.unlink(missing_ok=True)
    shutil.copyfile(source, temporary)
    temporary.replace(destination)


def install_snapshot(entry: dict, destination: Path, token: str | None) -> None:
    temporary = destination.with_name(f"{destination.name}.partial")
    if temporary.exists():
        shutil.rmtree(temporary)
    temporary.parent.mkdir(parents=True, exist_ok=True)
    snapshot_download(
        repo_id=entry["repository"],
        revision=entry["revision"],
        local_dir=temporary,
        allow_patterns=entry.get("allowPatterns") or None,
        token=token,
    )
    metadata = temporary / ".cache"
    if metadata.exists():
        shutil.rmtree(metadata)
    temporary.replace(destination)


def install_cache_snapshot(entry: dict, destination: Path, token: str | None) -> None:
    cache_root = destination.parent
    snapshot_download(
        repo_id=entry["repository"],
        revision=entry["revision"],
        cache_dir=cache_root,
        allow_patterns=entry.get("allowPatterns") or None,
        token=token,
    )
    if not destination.is_dir():
        fail("The pinned Hugging Face cache snapshot was not created at the declared path.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--qualification", action="store_true")
    args = parser.parse_args()
    root = Path(os.environ.get("STUDIO_MODEL_ROOT", "/workspace")).resolve()
    manifest_path = Path(
        os.environ.get(
            "STUDIO_MODEL_MANIFEST", "/opt/studio/model-install-manifest.runtime.json"
        )
    ).resolve(strict=True)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("schemaVersion") != 1 or not isinstance(manifest.get("models"), list):
        fail("The model installation manifest is invalid.")
    accepted = {
        value.strip()
        for value in os.environ.get("STUDIO_ACCEPTED_MODEL_LICENSES", "").split(",")
        if value.strip()
    }
    required = {
        value.strip()
        for value in os.environ.get("STUDIO_REQUIRED_MODEL_IDS", "").split(",")
        if value.strip()
    }
    token = os.environ.get("HF_TOKEN") or None
    receipt = []
    known_ids = {entry.get("modelId") for entry in manifest["models"]}
    unknown_required = required - known_ids
    if unknown_required:
        fail("A required model is not in the locked installation manifest.")
    selected = [
        entry for entry in manifest["models"]
        if not required or entry.get("modelId") in required
    ]
    for entry in selected:
        model_id = entry.get("modelId")
        expected = entry.get("sha256")
        if args.qualification and model_id not in accepted:
            fail(f"License review has not been confirmed for {model_id}.")
        if not args.qualification and (
            not isinstance(expected, str)
            or len(expected) != 64
            or entry.get("licenseReview") != "accepted"
        ):
            fail(f"Production installation is locked for unqualified model {model_id}.")
        destination = safe_destination(root, entry["destination"])
        if not destination.exists():
            mode = entry.get("mode")
            if mode == "file":
                install_file(entry, destination, token)
            elif mode == "snapshot":
                install_snapshot(entry, destination, token)
            elif mode == "cache-snapshot":
                install_cache_snapshot(entry, destination, token)
            else:
                fail("The model installation mode is not allowlisted.")
        actual = path_hash(destination)
        if expected and actual != expected:
            fail(f"Hash verification failed for {model_id}.")
        receipt.append(
            {
                "modelId": model_id,
                "repository": entry["repository"],
                "revision": entry["revision"],
                "destination": entry["destination"],
                "sha256": actual,
                "licenseUrl": entry["licenseUrl"],
            }
        )
    output = root / "studio-model-qualification.json"
    output.write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "manifest": manifest_path.name,
                "qualificationMode": args.qualification,
                "models": receipt,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Verified {len(receipt)} locked model entries. Receipt: {output}")


if __name__ == "__main__":
    main()
