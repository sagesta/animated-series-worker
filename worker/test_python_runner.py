import hashlib
import json
import tempfile
import unittest
import wave
from pathlib import Path

import python_runner


ADAPTATION_ASSET_IDS = [
    "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    "01ARZ3NDEKTSV4RRFFQ69G5FAW",
    "01ARZ3NDEKTSV4RRFFQ69G5FAX",
    "01ARZ3NDEKTSV4RRFFQ69G5FAY",
]


def cue_sheet(**overrides):
    value = {
        "schemaVersion": 1,
        "durationSeconds": 1.0,
        "cues": [
            {
                "cueId": "step-1",
                "kind": "foley",
                "description": "A single soft boot step",
                "generator": "footstep",
                "startSeconds": 0.2,
                "durationSeconds": 0.3,
                "gainDb": -9,
                "rightsBasis": "procedural-original",
            }
        ],
    }
    value.update(overrides)
    return json.dumps(value)


def adaptation_manifest(**overrides):
    value = {
        "schemaVersion": 1,
        "purpose": "Keep the approved main character visually consistent within this project.",
        "projectScopeOnly": True,
        "humanRightsReviewConfirmed": True,
        "trainingSteps": 100,
        "learningRate": 0.0001,
        "resolutionBuckets": ["576x576x1", "768x448x49"],
        "samples": [
            {
                "inputOrder": index + 2,
                "assetId": ADAPTATION_ASSET_IDS[index],
                "sha256": hashlib.sha256(
                    f"reviewed-sample-{index + 1}".encode()
                ).hexdigest(),
                "caption": f"project-style character reference sample number {index + 1}",
                "rightsBasis": "owned-original",
                "licenseReference": None,
                "consentConfirmed": True,
            }
            for index in range(4)
        ],
    }
    value.update(overrides)
    return value


class ProceduralFoleyTests(unittest.TestCase):
    def test_creates_deterministic_separate_audio_and_manifest(self):
        hashes = []
        for _ in range(2):
            with tempfile.TemporaryDirectory() as directory:
                output = Path(directory)
                python_runner.rights_aware_foley(
                    {
                        "parameters": {
                            "cueSheetJson": cue_sheet(),
                            "preserveDialogue": True,
                            "seed": 42,
                        },
                        "inputPaths": [],
                    },
                    output,
                )
                wav_path = output / "foley-layer.wav"
                with wave.open(str(wav_path), "rb") as source:
                    self.assertEqual(source.getframerate(), 48_000)
                    self.assertEqual(source.getnchannels(), 1)
                    self.assertEqual(source.getnframes(), 48_000)
                digest = hashlib.sha256(wav_path.read_bytes()).hexdigest()
                manifest = json.loads((output / "foley-manifest.json").read_text())
                self.assertEqual(manifest["outputSha256"], digest)
                self.assertTrue(manifest["dialoguePreservedSeparately"])
                self.assertFalse(manifest["sourceRecordingsUsed"])
                hashes.append(digest)
        self.assertEqual(hashes[0], hashes[1])

    def test_rejects_malformed_out_of_bounds_and_unlicensed_cues(self):
        with self.assertRaisesRegex(RuntimeError, "valid JSON"):
            python_runner.parse_foley_cue_sheet("{")
        with self.assertRaisesRegex(RuntimeError, "fit completely"):
            python_runner.parse_foley_cue_sheet(
                cue_sheet(
                    cues=[
                        {
                            "cueId": "late",
                            "kind": "effect",
                            "description": "Late impact",
                            "generator": "impact",
                            "startSeconds": 0.9,
                            "durationSeconds": 0.2,
                            "rightsBasis": "procedural-original",
                        }
                    ]
                )
            )
        with self.assertRaisesRegex(RuntimeError, "rightsBasis"):
            python_runner.parse_foley_cue_sheet(
                cue_sheet(
                    cues=[
                        {
                            "cueId": "unknown-source",
                            "kind": "ambience",
                            "description": "Unverified recording",
                            "generator": "room-tone",
                            "startSeconds": 0,
                            "durationSeconds": 1,
                            "rightsBasis": "unknown",
                        }
                    ]
                )
            )

    def test_refuses_dialogue_replacement_or_uploaded_audio(self):
        with tempfile.TemporaryDirectory() as directory:
            common = {
                "parameters": {
                    "cueSheetJson": cue_sheet(),
                    "preserveDialogue": False,
                    "seed": 1,
                },
                "inputPaths": [],
            }
            with self.assertRaisesRegex(RuntimeError, "preserve dialogue"):
                python_runner.rights_aware_foley(common, Path(directory))
            common["parameters"]["preserveDialogue"] = True
            common["inputPaths"] = ["dialogue.wav"]
            with self.assertRaisesRegex(RuntimeError, "does not accept or rewrite"):
                python_runner.rights_aware_foley(common, Path(directory))


class ProjectAdaptationTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        self.output = self.root / "runner-output"
        self.output.mkdir()

        self.trainer_root = self.root / "LTX-2"
        scripts = self.trainer_root / "packages" / "ltx-trainer" / "scripts"
        scripts.mkdir(parents=True)
        (scripts / "process_dataset.py").write_text("# pinned test fixture\n", encoding="utf-8")
        (scripts / "train.py").write_text("# pinned test fixture\n", encoding="utf-8")

        self.manifest_path = self.root / "adaptation.json"
        self.manifest_path.write_text(
            json.dumps(adaptation_manifest(), indent=2) + "\n", encoding="utf-8"
        )
        self.samples = []
        for index in range(4):
            sample = self.root / f"sample-{index + 1}.png"
            sample.write_bytes(f"reviewed-sample-{index + 1}".encode())
            self.samples.append(sample)

        self.models = {}
        for model_id in (
            "Lightricks/LTX-2.5/dev-transformer-bf16",
            "Lightricks/LTX-2.5/gemma4-text-encoder-bf16",
            "Lightricks/LTX-2.5/video-vae-bf16",
            "Lightricks/LTX-2.5/audio-vae-bf16",
        ):
            model = self.root / f"{model_id.rsplit('/', 1)[1]}.safetensors"
            model.write_bytes(b"verified-model-fixture")
            self.models[model_id] = str(model)

    def tearDown(self):
        self.temporary_directory.cleanup()

    def spec(self):
        input_paths = [str(self.manifest_path), *(str(sample) for sample in self.samples)]
        manifest_hash = hashlib.sha256(self.manifest_path.read_bytes()).hexdigest()
        return {
            "parameters": {
                "baseModel": "Lightricks/LTX-2.5",
                "referenceBenchmarkFailed": True,
                "rightsConfirmed": True,
                "triggerPhrase": "project-style",
                "datasetManifestJson": json.dumps(
                    {
                        "direction": "Train only this project's reviewed character look.",
                        "assets": [
                            {
                                "order": 1,
                                "assetId": "01ARZ3NDEKTSV4RRFFQ69G5FAT",
                                "kind": "adaptation-dataset",
                                "sha256": manifest_hash,
                            },
                            *[
                                {
                                    "order": index + 2,
                                    "assetId": ADAPTATION_ASSET_IDS[index],
                                    "kind": "reference-image",
                                    "sha256": hashlib.sha256(sample.read_bytes()).hexdigest(),
                                }
                                for index, sample in enumerate(self.samples)
                            ],
                        ],
                    }
                ),
                "seed": 42,
            },
            "inputPaths": input_paths,
            "modelPaths": self.models,
        }

    def test_runs_pinned_preprocessing_and_training_and_emits_reviewed_artifacts(self):
        calls = []

        def fake_run(arguments, *, cwd, env, check):
            calls.append(arguments)
            self.assertTrue(check)
            self.assertEqual(env["HF_HUB_OFFLINE"], "1")
            if Path(arguments[1]).name == "process_dataset.py":
                precomputed = Path(arguments[arguments.index("--output-dir") + 1])
                (precomputed / "latents").mkdir(parents=True)
                (precomputed / "conditions").mkdir()
            else:
                config = json.loads(Path(arguments[2]).read_text(encoding="utf-8"))
                training_output = Path(config["output_dir"])
                training_output.mkdir(parents=True)
                (training_output / "project_weights_step_00100.safetensors").write_bytes(
                    b"review-required-lora"
                )

        python_runner.ltx_project_adaptation(
            self.spec(),
            self.output,
            trainer_root_override=self.trainer_root,
            run_process=fake_run,
        )

        self.assertEqual(len(calls), 2)
        self.assertIn("--skip-audio", calls[0])
        self.assertIn("--vae-tiling", calls[0])
        lora = self.output / "project-lora.safetensors"
        self.assertTrue(lora.is_file())
        self.assertTrue((self.output / "adaptation-training-config.json").is_file())
        result = json.loads((self.output / "adaptation-manifest.json").read_text())
        self.assertEqual(result["trainerCommit"], python_runner.LTX_TRAINER_COMMIT)
        self.assertEqual(result["sampleCount"], 4)
        self.assertEqual(result["promotionState"], "candidate-review-required")
        self.assertEqual(result["loraSha256"], hashlib.sha256(lora.read_bytes()).hexdigest())

    def test_rejects_missing_sample_consent_before_starting_training(self):
        invalid = adaptation_manifest()
        invalid["samples"][2]["consentConfirmed"] = False
        self.manifest_path.write_text(json.dumps(invalid), encoding="utf-8")
        called = False

        def must_not_run(*_arguments, **_kwargs):
            nonlocal called
            called = True

        with self.assertRaisesRegex(RuntimeError, "human consent decision"):
            python_runner.ltx_project_adaptation(
                self.spec(),
                self.output,
                trainer_root_override=self.trainer_root,
                run_process=must_not_run,
            )
        self.assertFalse(called)

    def test_rejects_a_sample_changed_after_rights_review(self):
        self.samples[1].write_bytes(b"tampered-after-review")
        called = False

        def must_not_run(*_arguments, **_kwargs):
            nonlocal called
            called = True

        with self.assertRaisesRegex(RuntimeError, "changed after the rights review"):
            python_runner.ltx_project_adaptation(
                self.spec(),
                self.output,
                trainer_root_override=self.trainer_root,
                run_process=must_not_run,
            )
        self.assertFalse(called)


if __name__ == "__main__":
    unittest.main()
