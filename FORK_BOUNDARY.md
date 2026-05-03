# Fork Boundary

This repo currently carries two distinct surfaces:

- `refactor/upstream-bound`: shared-file work that may be proposed upstream later.
- `refactor/fork-only`: fork-permanent routes, usage UI, release wiring, and governance.

This file governs the `refactor/fork-only` side.

## Marker convention

Use `/* FORK[topic]: reason */` when an edit inside an upstream-owned shared file is expected to remain local to the fork.

## Fork-owned files

- `FORK_BOUNDARY.md`
- `src/pages/PromptRulesPage.tsx`
- `src/pages/PromptRulesPage.module.scss`
- `src/pages/UsagePage.tsx`
- `src/pages/UsagePage.module.scss`
- `src/services/api/promptRules.ts`
- `src/services/api/usage.ts`
- `src/components/usage/**`
- `src/stores/useUsageStatsStore.ts`
- `src/pages/hooks/useTraceResolver.ts`
- `src/utils/usage.ts`
- `src/utils/usage/**`
- `src/utils/usageIndex.ts`
- `src/utils/recentRequests.ts`
- `README.md`, `README_CN.md`
- `CONTRIBUTING.md`

## Patched upstream files

Keep fork-only deltas in these shared files small and obvious:

- `src/components/layout/MainLayout.tsx`
- `src/components/ui/icons.tsx`
- `src/components/providers/ProviderStatusBar.tsx`
- `src/router/MainRoutes.tsx`
- `src/pages/SystemPage.tsx`
- `src/services/api/index.ts`
- `src/utils/quota/parsers.ts`
- `package.json`

Rule: prefer extracting a new fork-owned helper over growing any one shared-file patch beyond roughly 50 changed lines per topic.

## Hard-fork triggers

Stop and rethink the shape if:

- A fork-only feature needs wide edits across shared provider sections.
- A usage-only change leaks into app boot, routing, and layout in the same patch.
- A fork-only UI behavior needs more than one upstream-owned shared component.
- A future upstream PR would need fork branding, fork routes, or release-tag behavior.

## Merge protocol

1. Land shared-file work on `refactor/upstream-bound`.
2. Merge `refactor/upstream-bound` into `refactor/fork-only`.
3. Add fork-only commits after that merge point.
4. Before merging back to `dev`, review the `dev..refactor/fork-only` diff and confirm only the files above carry fork-permanent deltas.

## Current fork topics

- `prompt-rules`: route, page, API client, and layout wiring.
- `usage`: charts, request-event analysis, source-resolution helpers, and import/export UI.
- `branding`: release tags, repo links, and sidebar/system-page affordances.
