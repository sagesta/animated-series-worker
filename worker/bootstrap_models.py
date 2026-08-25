#!/usr/bin/env python3
"""Install only the revision-pinned model files declared by the studio manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
from pathlib import Path, PurePosixPath, PureWindowsPath


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
    if not isinstance(relative_value, str) or not relative_value.strip():
        fail("A model destination is unsafe.")
    posix = PurePosixPath(relative_value)
    windows = PureWindowsPath(relative_value)
    if (
        posix.is_absolute()
        or windows.is_absolute()
        or ".." in posix.parts
        or ".." in windows.parts
    ):
        fail("A model destination is unsafe.")
    relative = Path(relative_value)
    destination = (root / relative).resolve()
    if destination == root or root not in destination.parents:
        fail("A model destination escaped persistent storage.")
    return destination


def install_file(entry: dict, destination: Path, token: str | None) -> None:
    from huggingface_hub import hf_hub_download

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
    from huggingface_hub import snapshot_download

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
    from huggingface_hub import snapshot_download

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


def validate_manifest(manifest: object, root: Path) -> list[dict]:
    if not isinstance(manifest, dict) or manifest.get("schemaVersion") != 1:
        fail("The model installation manifest is invalid.")
    models = manifest.get("models")
    if not isinstance(models, list) or not models:
        fail("The model installation manifest is invalid.")
    seen_ids: set[str] = set()
    for entry in models:
        if not isinstance(entry, dict):
            fail("A model manifest entry is invalid.")
        model_id = entry.get("modelId")
        repository = entry.get("repository")
        revision = entry.get("revision")
        mode = entry.get("mode")
        if not isinstance(model_id, str) or not model_id or model_id in seen_ids:
            fail("Model identities must be non-empty and unique.")
        if not isinstance(repository, str) or not re_fullmatch_repository(repository):
            fail(f"The repository is not allowlisted for {model_id}.")
        if not isinstance(revision, str) or not is_sha1(revision):
            fail(f"The model revision is not immutable for {model_id}.")
        if mode not in {"file", "snapshot", "cache-snapshot"}:
            fail(f"The model installation mode is not allowlisted for {model_id}.")
        safe_destination(root, entry.get("destination"))
        if mode == "file":
            safe_source_path(entry.get("sourcePath"))
        for pattern in entry.get("allowPatterns") or []:
            safe_source_path(pattern, allow_glob=True)
        seen_ids.add(model_id)
    return models


def re_fullmatch_repository(value: str) -> bool:
    import re

    return re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,99}/[A-Za-z0-9][A-Za-z0-9._-]{0,199}", value) is not None


def is_sha1(value: str) -> bool:
    import re

    return re.fullmatch(r"[a-f0-9]{40}", value) is not None


def safe_source_path(value: object, allow_glob: bool = False) -> None:
    if not isinstance(value, str) or not value:
        fail("A model source path is unsafe.")
    posix = PurePosixPath(value)
    windows = PureWindowsPath(value)
    if posix.is_absolute() or windows.is_absolute() or ".." in posix.parts or ".." in windows.parts:
        fail("A model source path is unsafe.")
    if not allow_glob and any(character in value for character in "*?[]"):
        fail("A model source file cannot contain a glob.")


def select_entries(models: list[dict], required: set[str]) -> list[dict]:
    known_ids = {entry["modelId"] for entry in models}
    unknown_required = required - known_ids
    if unknown_required:
        fail("A required model or repository is not in the locked installation manifest.")
    return [entry for entry in models if not required or entry["modelId"] in required]


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
    models = validate_manifest(manifest, root)
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
    selected = select_entries(models, required)
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
