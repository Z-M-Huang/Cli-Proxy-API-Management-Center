# CLAUDE.md

Project-level guidance for Claude Code (and other AI coding assistants) working in this repository.

## This repo is a fork

[Z-M-Huang/Cli-Proxy-API-Management-Center](https://github.com/Z-M-Huang/Cli-Proxy-API-Management-Center) is a soft fork of [router-for-me/Cli-Proxy-API-Management-Center](https://github.com/router-for-me/Cli-Proxy-API-Management-Center). It pairs with the [Z-M-Huang/CLIProxyAPI](https://github.com/Z-M-Huang/CLIProxyAPI) backend fork. **Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) before making changes** — it covers branch model, upstream-sync workflow, customization surface, and release process.

## Hot rules (don't get these wrong)

1. **Branches**: cut from `dev`. Open PRs against `dev`, not `main`. `main` is fast-forwarded from `dev` at release time.
2. **Tags**: `zmh-vX.Y.Z`. Never push a bare `vX.Y.Z` tag — that namespace belongs to upstream.
3. **Upstream**: `router-for-me/Cli-Proxy-API-Management-Center` is the `upstream` remote. We selectively merge / cherry-pick from `upstream/dev`. We do **not** open PRs against `router-for-me/*`.
4. **Customization conflicts**: when merging from `upstream/dev`, conflicts in the files listed in `CONTRIBUTING.md` are expected — keep our version. Conflicts elsewhere are a refactor signal — investigate, don't paper over.
5. **`release.yml`**: triggers on `zmh-v*` tags and runs on `self-hosted`. Don't change either without a deliberate reason — Phase 4 / Phase 5 of the fork bootstrap depended on those choices.
6. **i18n**: new strings go into **all four** locales (`en`, `zh-CN`, `zh-TW`, `ru`). Missing keys fall back to the literal key, which is ugly UX.
7. **API client pattern**: typed request/response in `src/services/api/<feature>.ts`, re-exported from `src/services/api/index.ts`. The new endpoint must already exist on the backend fork.
8. **React keys**: never index-as-key on dynamic lists where rows can be removed. Maintain a parallel UID array (see `PromptRulesPage.tsx`).

## Build / test commands

See `AGENTS.md` for the canonical command list (`npm ci`, `npm run lint`, `npm run type-check`, `npm run build`) and architectural notes that apply equally to all assistants. `lint && type-check && build` must pass before any PR.

## Pointers

- `CONTRIBUTING.md` — fork workflow (the source of truth for the rules above).
- `AGENTS.md` — architecture, tech-stack notes, code conventions, build commands.
- Plan / decision history: `/home/ubuntu/.claude/plans/we-are-in-a-nested-emerson.md` (local-only).
