# Plain-language glossary

| Term | Meaning in this project |
| --- | --- |
| Asset | Any reusable creative item: character image, voice, location, prop, audio line, clip, music cue, or export. |
| Audience & Creative Direction | A project-local, versioned compass for intended viewers, niche, genre, tone, themes, promise, setting, boundaries, format, style, positioning, and differentiation. It guides work but is not canon or a YouTube policy answer. |
| Adaptation | An optional project-scoped LoRA or similar small trained add-on used only when approved references alone cannot meet the consistency benchmark. |
| Animatic | A timed preview made from storyboard frames, dialogue, captions, and simple motion to check pacing before expensive final animation. |
| Bible | The approved reference pack that defines how a character, voice, visual style, location, or prop should remain consistent. |
| Canonical | The authoritative version used to make decisions. Model-specific prompts are derived from canonical story facts. |
| Checkpoint | A saved model file or a safe production state from which work can resume. |
| ComfyUI | The remote workflow engine that connects model steps. The normal user does not need to see its node graph. |
| Conditioning | Giving the model a reference image, audio file, keyframe, or other fixed input to guide the result. |
| Control pack | Versioned start/end frames, pose, depth, edge, masks, movement paths, or reference clips that guide a shot without exposing ComfyUI nodes. |
| Creative-assist QC | Automated warnings that point a reviewer to possible visual, motion, lip-sync, or dialogue defects; they never approve a take. |
| Continuity | Keeping identities, clothing, scale, location state, props, voices, and story facts consistent. |
| Distilled model | A faster version used for drafts and experimentation. It may trade some quality for speed. |
| Engine adapter | A translator between the studio's neutral job description and a particular model or provider. |
| Generation | One paid or local attempt to create an image, audio file, or video. |
| GPU-hour | One GPU running for one hour. Three GPUs for one hour normally equal three GPU-hours. |
| Held frame | An approved still image kept on screen, optionally with camera movement or layered motion. |
| Idempotent job | A job that can be safely retried with the same identity without accidentally creating duplicate charges or state. |
| Lip-dub | Rebuilding or correcting mouth movement so an existing video matches approved audio. |
| LoRA | A relatively small model adaptation layered on a compatible base model. It must be trained, versioned, licensed, benchmarked, and reversible. |
| Lock | Approval that freezes a version for downstream work. A later change creates a new version. |
| Manifest | The receipt for an output: exact inputs, model, workflow, versions, settings, hardware, runtime, and lineage. |
| Model sheet | A reference board showing a character consistently from several views and with important details. |
| Network volume | Paid cloud storage that persists while the rented GPU machine is gone. It caches large models; it is not the only copy of project work. |
| Niche | The clear subject-and-experience space a production occupies, such as “African folklore family fantasy.” It is one part of creative direction, not a complete production plan. |
| Pod | A temporary rented cloud computer. The studio creates and terminates it automatically. |
| Production method | How a shot is made: hold, pan, loop, LTX animation, audio-driven dialogue, retake, lip-dub, or external work. |
| Prompt | Instructions sent to a generative model. Prompts do not replace approved references and continuity data. |
| Retake | A new attempt for a shot or a selected time region while retaining the previous attempts. |
| Seed | A number that influences a generation's random choices. Saving it helps investigation but does not alone guarantee identical output across changed software or hardware. |
| Shot | The smallest reviewed piece of the edited episode. A shot may have several generated takes. |
| Stale | Still preserved, but no longer proven to match a newer upstream decision. The user must review the impact. |
| Story promise | The reliable emotional or narrative experience viewers should expect from an episode or film. |
| Storyboard | The visual and timing plan. It specifies intent, but production still needs exact approved assets, audio, workflows, and takes. |
| Foley | Sound effects synchronized to visible actions, kept separate from dialogue and music. |
| Submodule | A separate Git repository pinned inside this project at an exact commit. Updates are deliberate and reversible. |
| Take | One generated or edited candidate for a shot. Only an approved take enters the final timeline. |
| TTS | Text-to-speech: generating spoken dialogue from the approved script. |
| Upscale | Increasing resolution after the motion and content have been approved. |
| VRAM | Memory on a GPU. A workflow cannot run safely if its model and processing do not fit. |
| Watchdog | An independent safety timer that terminates a cloud worker if it runs too long or becomes abandoned. |
