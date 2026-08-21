# Maintenance scripts

## Documentation checks

```powershell
node scripts/check-docs.mjs
```

Checks required documents, relative links, requirement traceability, decision IDs, and the pinned upstream commit.

## Upstream update preview

```powershell
./scripts/update-upstream.ps1
```

Fetches and reports the candidate `origin/main` commit without changing the pin.

To evaluate a specific commit/tag/remote ref:

```powershell
./scripts/update-upstream.ps1 -Ref <commit-or-ref>
```

To check out and test the candidate after the studio repository is clean:

```powershell
./scripts/update-upstream.ps1 -Apply
```

The apply path restores the previous commit/lock on failure. A passing script still requires review, compatibility/media benchmarks where relevant, documentation, and a commit.
