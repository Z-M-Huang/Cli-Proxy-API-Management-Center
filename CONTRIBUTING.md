# Contributing to Z-M-Huang/Cli-Proxy-API-Management-Center

This is a soft fork of [router-for-me/Cli-Proxy-API-Management-Center](https://github.com/router-for-me/Cli-Proxy-API-Management-Center) — the React/TypeScript management UI paired with the [Z-M-Huang/CLIProxyAPI](https://github.com/Z-M-Huang/CLIProxyAPI) backend fork. The fork carries its own UI features on top of upstream while continuing to absorb upstream improvements over time.

If you're a human collaborator or an AI coding assistant, **read this before opening a branch or PR**. The same workflow is referenced by [`AGENTS.md`](./AGENTS.md) and [`CLAUDE.md`](./CLAUDE.md).

## Goals

1. **Ship our own UI features** for the fork's backend (currently: **Prompt Rules** management page; revived logging UI planned for v0.2.0).
2. **Track upstream's improvements** so we benefit from their UI/UX work without duplicating it. We do this by selectively merging or cherry-picking from `upstream/dev` into our `dev`.
3. **Stay non-disruptive to upstream.** We don't open PRs against `router-for-me/*` — upstream merge is no longer the goal.

## Branch model

```
main  ←─[fast-forward]──  dev  ←─[merge]──  feat/<your-feature>
                          ▲
                          └─ periodic merge / cherry-pick from upstream/dev
```

- **`main`** is the default browse-branch. Always equals (or trails by a tag) `dev`. Don't commit to `main` directly; fast-forward from `dev` when releasing.
- **`dev`** is the integration branch. All feature work and upstream sync land here.
- **`feat/<short-name>`** is where you do your work. Cut from `dev`, PR back into `dev`.
- **`feat/logging`** is reserved for the deferred v0.2.0 logging UI effort. Don't reuse the name.

## Workflow: starting a new feature

```bash
git fetch origin
git checkout -b feat/your-thing origin/dev
# ... commit ...
git push -u origin feat/your-thing
gh pr create --repo Z-M-Huang/Cli-Proxy-API-Management-Center --base dev --head feat/your-thing
```

Open the PR against **`dev`**, never `main`. After merge, the feature branch can be deleted.

## Workflow: absorbing upstream changes

We track `router-for-me/Cli-Proxy-API-Management-Center` as the `upstream` remote. We do **not** blindly merge `upstream/dev` — we look at what's new and pick what fits.

```bash
git fetch upstream
# What's new since the last sync?
git log --oneline origin/dev..upstream/dev

# Either: cherry-pick selected commits onto a sync branch
git checkout -b sync/upstream-YYYY-MM-DD origin/dev
git cherry-pick <sha1> <sha2> <sha3>

# Or: full merge if it's mostly low-conflict
git checkout -b sync/upstream-YYYY-MM-DD origin/dev
git merge --no-ff upstream/dev
# Resolve conflicts ONLY in the customization surface below.

git push -u origin sync/upstream-YYYY-MM-DD
gh pr create --repo Z-M-Huang/Cli-Proxy-API-Management-Center --base dev --head sync/upstream-YYYY-MM-DD \
  --title "sync: pull upstream/dev YYYY-MM-DD"
```

Conflicts during a sync are expected only in the customization surface below. **If you hit a conflict outside that list, treat it as a refactor signal — investigate before resolving.**

## Customization surface

These are the files where the fork diverges from upstream. When syncing upstream, conflicts here are normal — keep our version. Everywhere else, take upstream's.

- `.github/workflows/release.yml` — tag trigger is `zmh-v*` (not `v*`); `runs-on: self-hosted`.
- `src/components/config/VisualConfigEditor.tsx` — `panel-github-repository` placeholder points at our fork.
- `src/pages/SystemPage.tsx` — quick-link cards point at our fork (the docs link still goes to `help.router-for.me` and is intentionally labeled as upstream).
- `src/i18n/locales/{en,zh-CN,zh-TW,ru}.json` — `link_docs` / `link_docs_desc` labeled as upstream-hosted; `prompt_rules.*` keys for the fork-only feature.
- `src/pages/PromptRulesPage.{tsx,module.scss}` — fork-only feature page.
- `src/services/api/promptRules.ts` — fork-only API client.
- `src/router/MainRoutes.tsx`, `src/components/layout/MainLayout.tsx`, `src/services/api/index.ts` — minor fork-feature wiring.
- `README.md`, `README_CN.md` — fork notice block at the top.

If you intentionally add a new customization, also add the file here so future syncs know to expect a conflict there.

## Releasing

The release tag is `zmh-vX.Y.Z` (the `zmh-` prefix avoids colliding with upstream's `vX.Y.Z` tag namespace).

1. Make sure `main` is fast-forwarded from `dev`.
2. Tag and push:
   ```bash
   git checkout main && git pull --ff-only origin main
   git tag zmh-v0.X.Y
   git push origin zmh-v0.X.Y
   ```
3. The `zmh-v*` tag triggers `.github/workflows/release.yml` on the fork's self-hosted runner. The workflow runs `npm ci && npm run build` and publishes `dist/management.html` as a GitHub Release asset.
4. The matching backend release in [Z-M-Huang/CLIProxyAPI](https://github.com/Z-M-Huang/CLIProxyAPI) at the same `zmh-vX.Y.Z` tag will fetch this `management.html` automatically via the auto-updater.

## Things this fork deliberately does NOT do

- We don't open PRs against `router-for-me/Cli-Proxy-API-Management-Center` or `router-for-me/CLIProxyAPI`.
- We don't use the bare `vX.Y.Z` tag namespace — always `zmh-vX.Y.Z`.
- We don't carry upstream's affiliate/sponsor links in the rebrand commits.
- We don't run `release.yml` on GitHub-hosted runners; it's pinned to `self-hosted`.

## Fork boundary guard

`FORK_BOUNDARY.md` is the source of truth for fork-only files, patched upstream files, and the `/* FORK[topic]: reason */` marker convention.

## Pointers

- Plan / decision history: `/home/ubuntu/.claude/plans/we-are-in-a-nested-emerson.md` (local-only).
- Upstream: <https://github.com/router-for-me/Cli-Proxy-API-Management-Center>.
- Backend fork: <https://github.com/Z-M-Huang/CLIProxyAPI>.
