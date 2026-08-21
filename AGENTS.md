# Project working rules

These rules apply to every human or coding agent working inside this repository.

## Product truth

- Read `docs/README.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, and `docs/CHANGE_CONTROL.md` before making architectural or product changes.
- Never describe a planned capability as implemented. Update `README.md` and `docs/STATUS.md` when capability status changes.
- Requirement IDs in `docs/PRD.md` are authoritative. New behavior needs a requirement or an explicit non-requirement decision.
- Existing creative assets and user projects are never silently migrated, overwritten, regenerated, or deleted.

## Isolation from upstream

- Never edit files inside `vendor/shuohao-skills`.
- The submodule commit in Git and `config/upstream.lock.json` must agree.
- Update upstream only through `scripts/update-upstream.ps1` or an equivalent reviewed process.
- An upstream update is incomplete until upstream self-tests, studio adapter contract tests, documentation checks, and a rollback test pass.
- Production projects pin the upstream adapter and schema versions used to create them.

## Documentation definition of done

Every code or configuration change must update, in the same change:

1. The affected behavior document under `docs/`.
2. `docs/TRACEABILITY.md` if a requirement, component, or acceptance test changed.
3. `docs/DECISIONS.md` if an architectural decision changed.
4. `docs/SOURCES.md` if a model, license, provider, price, or external API assumption changed.
5. `CHANGELOG.md` with user-visible impact, migration impact, and rollback notes.
6. Tests that prove the documented behavior.

“Documentation not needed” is allowed only for formatting-only changes, and the change description must say why behavior is unaffected.

Run `node scripts/check-docs.mjs` before handoff. Broken internal links, missing required documents, untraced requirements, or a mismatched upstream lock are blockers.

## Architecture guardrails

- Keep the local project workspace authoritative. Remote GPU storage is a cache and temporary execution area.
- Keep creative source-of-truth data engine-neutral. LTX-specific prompts and workflow parameters are generated artifacts, not canonical story data.
- Keep provider logic behind the GPU provider contract and model logic behind media-engine contracts.
- Bind ComfyUI to the remote worker's loopback interface. Expose only the authenticated worker gateway.
- Store cloud credentials in the operating-system credential vault, never in project JSON, logs, Git, or exported production packs.
- Every paid job needs an estimate, a budget decision, an idempotency key, a manifest, a cost record, and a recoverable terminal state.
- Human approval gates are required before character lock, voice lock, storyboard lock, bulk paid generation, and final export.
- A change to a locked upstream asset marks dependants stale; it does not silently mutate or regenerate them.

## Implementation conventions

- Keep the vendored skills self-contained and invoke their public command-line contracts through an adapter.
- Planned application code uses TypeScript; planned GPU worker code uses Python 3.12. Contracts are JSON Schema and are language-neutral.
- Version workflows, schemas, prompts, model identifiers, and migrations. Record exact versions and hashes in each production manifest.
- Prefer deterministic validation and resumable jobs over hidden automation.
- Use safe, non-destructive migrations with backup, preview, apply, verify, and rollback stages.
