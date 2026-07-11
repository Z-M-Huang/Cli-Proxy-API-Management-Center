# AI Assistant Guidance

React 19 + TypeScript single-file Web UI for managing the CLI Proxy API through its `/v0/management` API. Built with Vite and `vite-plugin-singlefile`, then served by the backend container at `/management.html`.

## Read First

This is the [Z-M-Huang/Cli-Proxy-API-Management-Center](https://github.com/Z-M-Huang/Cli-Proxy-API-Management-Center) soft fork of [router-for-me/Cli-Proxy-API-Management-Center](https://github.com/router-for-me/Cli-Proxy-API-Management-Center). It pairs with the [Z-M-Huang/CLIProxyAPI](https://github.com/Z-M-Huang/CLIProxyAPI) backend fork. Before opening any branch or PR, read [`CONTRIBUTING.md`](../CONTRIBUTING.md) for the fork-specific workflow.

This fork no longer tries to upstream its improvements. Treat upstream as an input stream only: selectively merge or cherry-pick useful changes from `upstream/dev` into our `dev`, then keep this fork's changes on top. Do not open PRs against `router-for-me/*` unless the maintainer explicitly reverses this policy.

Hot rules:

1. Cut new branches from `dev`, never `main`. Open PRs against this fork's `dev`.
2. Do not open PRs against `router-for-me/*`; upstream merge is no longer the goal.
3. Release tags are `zmh-vX.Y.Z`, never bare `vX.Y.Z` because upstream owns that namespace.
4. `release.yml` is pinned to `self-hosted` and triggered by `zmh-v*` tags.
5. Customization conflicts during upstream sync are expected only in the files listed in `CONTRIBUTING.md`; keep our version there and take upstream elsewhere.
6. New i18n strings go into all four locales: `en`, `zh-CN`, `zh-TW`, and `ru`.
7. Typed API clients live in `src/services/api/<feature>.ts`, are re-exported from `src/services/api/index.ts`, and should target endpoints that exist on the backend fork.
8. Do not use array indices as React keys in dynamic lists where rows can be removed.

## Repositories

- Frontend fork: <https://github.com/Z-M-Huang/Cli-Proxy-API-Management-Center>
- Frontend upstream: <https://github.com/router-for-me/Cli-Proxy-API-Management-Center>
- Paired backend fork: <https://github.com/Z-M-Huang/CLIProxyAPI>
- Local backend checkout: `../CLIProxyAPI`

## Commands

```bash
bun install --frozen-lockfile # Install dependencies from bun.lock
bun run dev # Vite dev server at http://localhost:5173
bun run build # TypeScript plus Vite build to dist/index.html
bun run preview # Serve dist locally
bun run test # Bun test suite
bun run lint # ESLint, warnings fail
bun run verify # Test, lint, and build
bun run type-check # tsc --noEmit
bun run format # Prettier
```

`bun run verify` and `bun run type-check` should pass before any PR is opened.

## Architecture

- `src/pages/`: top-level pages, one per nav route. New pages need a route in `src/router/MainRoutes.tsx` and a nav entry in `src/components/layout/MainLayout.tsx`.
- `src/components/`: reusable components by domain, such as config, providers, and UI.
- `src/features/<feature>/`: colocated feature modules with their own components, hooks, and constants.
- `src/services/api/`: typed axios clients per backend resource, re-exported from `src/services/api/index.ts`.
- `src/stores/`: Zustand stores such as `useAuthStore`, `useNotificationStore`, and `useConfigStore`.
- `src/i18n/locales/{en,zh-CN,zh-TW,ru}.json`: i18n string tables. Missing keys fall back to the literal key.
- `src/styles/`: global SCSS plus shared mixins and variables.
- `src/utils/`: pure utility functions with no React.
- Usage follows a split read model: dashboard analytics consume `/usage/overview` rollups, while `src/components/usage/hooks/useUsageEvents.ts` pages request rows from `/usage/events`.

## Tech Stack Notes

- React 19, TypeScript 6, Vite 8, Bun 1.3.14, Zustand, Axios, react-router-dom v7 with `HashRouter`, Motion, CodeMirror 6, SCSS Modules, and i18next.
- Single-file build via `vite-plugin-singlefile` inlines assets into `dist/index.html`. Do not rely on multiple network requests after the initial HTML load.

## Code Conventions

- Lint passes with no warnings; `--report-unused-disable-directives` is enabled.
- TypeScript is strict. Prefer `unknown` over `any` and narrow at the boundary.
- New API clients should use typed request and response shapes with explicit error types; see `src/services/api/promptRules.ts` for the pattern.
- New pages should pair `Page.tsx` with `Page.module.scss`.
- Use SCSS Modules. Avoid global selectors except through `:global()`.
- Include all closure dependencies in `useCallback` and `useEffect` dependency arrays. ESLint `react-hooks/exhaustive-deps` is enabled.
- Do not introduce array indices as `key` in dynamic lists where rows can be removed; use a stable UID.

## Backend API Contract

All requests go to the backend fork's management API at `/v0/management/...`. The auth header is `Authorization: Bearer <management-key>`.

When adding a fork-only management endpoint:

1. Add the typed client in `src/services/api/<feature>.ts`.
2. Re-export it from `src/services/api/index.ts`.
3. Add the page or UI affordance.
4. Add i18n keys in all four locale files.
5. Document the customization in `CONTRIBUTING.md`.

## Fork Boundary Guard

Use `/* FORK[topic]: reason */` when an edit inside an upstream-owned shared file is expected to remain local to the fork.

Fork-owned files:

- `AGENTS.md`
- `CLAUDE.md`
- `CONTRIBUTING.md`
- `docs/ai-assistant-guidance.md`
- `README.md`, `README_CN.md`
- `src/pages/PromptRulesPage.tsx`
- `src/pages/PromptRulesPage.module.scss`
- `src/pages/UsagePage.tsx`
- `src/pages/UsagePage.module.scss`
- `src/router/forkMainRoutes.tsx`
- `src/services/api/promptRules.ts`
- `src/services/api/usage.ts`
- `src/components/usage/**`
- `src/stores/useUsageStatsStore.ts`
- `src/pages/hooks/useTraceResolver.ts`
- `src/utils/usage/**`
- `src/utils/usageIndex.ts`
- `src/utils/recentRequests.ts`
- `tests/forkRoutes.test.tsx`
- `tests/usage-snapshots/**`
- `tests/usageRollups.test.ts`

Patched upstream files:

- `src/i18n/locales/en.json`
- `src/i18n/locales/ru.json`
- `src/i18n/locales/zh-CN.json`
- `src/i18n/locales/zh-TW.json`
- `src/components/layout/MainLayout.tsx`
- `src/components/config/VisualConfigEditor.tsx`
- `src/components/config/configSearchIndex.ts`
- `src/components/ui/icons.tsx`
- `src/components/providers/ProviderStatusBar.tsx`
- `src/router/MainRoutes.tsx`
- `src/pages/SystemPage.tsx`
- `src/services/api/index.ts`
- `src/services/api/logs.ts`
- `src/stores/index.ts`
- `src/hooks/useVisualConfig.ts`
- `src/types/visualConfig.ts`
- `src/utils/quota/parsers.ts`

Hard-fork triggers:

- A fork-only feature needs wide edits across shared provider sections.
- A usage-only change leaks into app boot, routing, and layout in the same patch.
- A fork-only UI behavior needs more than one upstream-owned shared component.
- A future upstream PR would need fork branding, fork routes, or release-tag behavior.

## Upstream Sync Policy

Use upstream as a source of selected fixes and maintenance, not as a contribution target.

1. Fetch `origin` and `upstream`.
2. Inspect what changed with `git log --oneline origin/dev..upstream/dev`.
3. Create a sync branch from `origin/dev`.
4. Cherry-pick selected commits, or merge `upstream/dev` only when it is low conflict.
5. Resolve expected conflicts in the customization surface by keeping our fork version.
6. Investigate conflicts outside the customization surface before resolving them.
7. Open the sync PR against `Z-M-Huang/Cli-Proxy-API-Management-Center` `dev`.
8. Layer fork-only changes on top of our `dev` after sync work lands, or in a separate feature branch from `dev`.

Current fork topics:

- `prompt-rules`: route, page, API client, and layout wiring.
- `usage`: rollup-backed charts and credential metrics, server-paged request events, source-resolution helpers, and import/export UI.
- `branding`: release tags, repo links, and sidebar/system-page affordances.
- `provider-headers`: Gemini API, OpenAI-compatible, Kimi, and Antigravity User-Agent defaults with legacy Gemini CLI config migration.

## Upstream Conflict Playbook

When merging `upstream/dev`, resolve conflicts by intent rather than mechanically choosing one side:

1. Keep fork identity, release wiring, repository URLs, assistant guidance, README fork notices, `zmh-v*` tag behavior, and self-hosted release workflow behavior from this fork.
2. Take upstream's generic UI fixes, dependency updates, tests, accessibility improvements, and refactors unless they directly remove or break a fork feature.
3. When upstream changes code that a fork feature touches, adapt the fork feature to the upstream shape instead of reverting the upstream change. Preserve both behaviors when they are distinct compatibility surfaces.
4. For overlapping routes or navigation, keep fork pages stable and add upstream routes alongside them when they serve different users.
5. For API client conflicts, keep the backend contract stable for fork-only endpoints, but reuse upstream client helpers or response normalization when upstream improves the shared pattern.
6. For i18n conflicts, keep fork-specific wording and add any new upstream keys to all four locale files: `en`, `zh-CN`, `zh-TW`, and `ru`.
7. For package manifests, resolve `package.json` first, then regenerate `bun.lock` with Bun 1.3.14. Do not hand-edit lockfile internals.
8. For conflicts outside the customization surface, stop and understand why the overlap exists before resolving it. Treat repeated conflicts in the same area as a signal to extract a fork-owned component, hook, or helper.
9. Run `bun run verify` and `bun run type-check`.
10. In the sync PR, document each non-trivial conflict as `kept fork`, `took upstream`, or `adapted both`, with a one-line rationale.

## Pointers

- `CONTRIBUTING.md`: fork workflow, branch model, release process, and customization surface.
- Backend fork checkout: `../CLIProxyAPI`.
- Local plan history, when present: `/home/ubuntu/.claude/plans/we-are-in-a-nested-emerson.md`.
