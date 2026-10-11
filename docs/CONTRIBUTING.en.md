# Contributing

English · [中文](../CONTRIBUTING.md)

For development, testing, and end-to-end verification see [DEVELOPMENT](./DEVELOPMENT.en.md).

## Core rules

**`main` accepts merges only, never direct commits.** GitHub branch protection blocks direct pushes, force pushes, and deletion, admins included. The local `.githooks/` are a second gate; enable them once per fresh clone:

```bash
git config core.hooksPath .githooks
```

Hooks can be bypassed with `--no-verify`; the real constraint lives on the server.

## Workflow

1. Branch off the latest `main`: `git switch -c feat/xxx`
2. Commit and push: `git push -u origin feat/xxx`
3. Open a PR into `main` and merge with **squash merge**

`main` stays linear, one commit per feature.

When a change touches behavior, data structures, or module responsibilities, update [ARCHITECTURE](./ARCHITECTURE.en.md) in the same PR; when commands or usage change, update [DEVELOPMENT](./DEVELOPMENT.en.md) and [README](./README.en.md).

## Commit messages

Keep the subject under 72 characters, shaped as `type(scope): intent`, written in English.

- `type`: `feat`, `fix`, `refact`, `docs`, `test`, `chore`
- `scope`: where the change lands, e.g. `match`, `dom`, `ui`, `jev`
- Body as needed, using `- ` bullet points, one per concrete change

```text
refact(match): fill only exact matches locally, defer the rest to Jev

- replace similarity scoring with matchExact plus literal-evidence tiers
- cap per-field Jev candidates at 6
```

## Release

After a PR merges into `main`, `.github/workflows/release.yml` reads the version number; if no matching release exists it builds and publishes `vX.Y.Z` with `dist/resume-writer.user.js` as the artifact. It skips automatically when the version is unchanged.

A release needs just one PR: update the `version` in both `vite.config.ts` and `package.json` (they must match; the workflow verifies this) and merge.

The userscript metadata (`name` / `namespace` / `description` / `match` / `connect`, etc.) is maintained in `vite.config.ts` under `monkey({ userscript })`.
