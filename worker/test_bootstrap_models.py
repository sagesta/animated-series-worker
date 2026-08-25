from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from bootstrap_models import safe_destination, select_entries, validate_manifest


def valid_manifest() -> dict:
    return {
        "schemaVersion": 1,
        "models": [
            {
                "modelId": "Fixture/model",
                "mode": "file",
                "repository": "Fixture/model",
                "revision": "a" * 40,
                "sourcePath": "weights/model.safetensors",
                "destination": "models/model.safetensors",
            }
        ],
    }


class ModelInstallerSafetyTests(unittest.TestCase):
    def test_rejects_posix_windows_and_parent_traversal_destinations(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            for destination in (
                "../outside",
                "models/../../outside",
                "/absolute/model",
                r"C:\absolute\model",
                r"models\..\outside",
            ):
                with self.subTest(destination=destination):
                    with self.assertRaisesRegex(RuntimeError, "destination is unsafe"):
                        safe_destination(root, destination)

    def test_rejects_undeclared_model_or_repository_requests(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            models = validate_manifest(valid_manifest(), Path(directory).resolve())
            with self.assertRaisesRegex(RuntimeError, "not in the locked installation manifest"):
                select_entries(models, {"Attacker/undeclared-model"})

    def test_accepts_only_immutable_safe_manifest_entries(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            models = validate_manifest(valid_manifest(), root)
            self.assertEqual(select_entries(models, {"Fixture/model"}), models)

            unsafe = valid_manifest()
            unsafe["models"][0]["revision"] = "main"
            with self.assertRaisesRegex(RuntimeError, "revision is not immutable"):
                validate_manifest(unsafe, root)


if __name__ == "__main__":
    unittest.main()
