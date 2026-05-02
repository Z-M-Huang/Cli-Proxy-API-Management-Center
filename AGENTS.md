# AGENTS.md

React 19 + TypeScript single-file Web UI for managing the **CLI Proxy API** via its `/v0/management` API. Built with Vite (single-file output via `vite-plugin-singlefile`), served from the backend container at `/management.html`.

## Fork notice — read first

This is the [Z-M-Huang/Cli-Proxy-API-Management-Center](https://github.com/Z-M-Huang/Cli-Proxy-API-Management-Center) soft fork of upstream. **Before opening any branch or PR, read [`CONTRIBUTING.md`](./CONTRIBUTING.md)** for the fork-specific workflow. Quick rules for AI assistants:

- Cut new branches from `dev`, never `main`. PR into `dev`.
- Don't open PRs against `router-for-me/*` — upstream merge is no longer the goal.
- Release tags are `zmh-vX.Y.Z`, never bare `vX.Y.Z` (upstream owns that namespace).
- `release.yml` is pinned to `self-hosted` and triggered on `zmh-v*` tags.
- Customization surface is enumerated in CONTRIBUTING.md — keep our version in those files; take upstream everywhere else.

## Repository
- Fork (this repo): https://github.com/Z-M-Huang/Cli-Proxy-API-Management-Center
- Upstream: https://github.com/router-for-me/Cli-Proxy-API-Management-Center
- Paired backend: https://github.com/Z-M-Huang/CLIProxyAPI

## Commands

```bash
npm ci             # Install (lockfile-strict)
npm run dev        # Vite dev server at http://localhost:5173
npm run build      # tsc + Vite build → dist/index.html (single-file bundle)
npm run preview    # Serve dist locally
npm run lint       # ESLint (warnings fail)
npm run type-check # tsc --noEmit
npm run format     # Prettier
```

`npm run lint && npm run type-check && npm run build` should pass before any PR is opened.

## Architecture

- `src/pages/` — top-level pages, one per nav route. New page = new file plus a route in `src/router/MainRoutes.tsx` and a nav entry in `src/components/layout/MainLayout.tsx`.
- `src/components/` — reusable components by domain (config, providers, ui, etc.).
- `src/features/<feature>/` — colocated feature modules with their own `components/`, `hooks/`, `constants.ts`, etc. (e.g., `src/features/authFiles/`).
- `src/services/api/` — typed axios clients per backend resource. Re-exported from `src/services/api/index.ts`.
- `src/stores/` — Zustand stores (`useAuthStore`, `useNotificationStore`, `useConfigStore`).
- `src/i18n/locales/{en,zh-CN,zh-TW,ru}.json` — i18n string tables. Add keys to **all four** locales when introducing new strings; missing keys fall back to the literal key.
- `src/styles/` — global SCSS plus shared mixins/variables.
- `src/utils/` — pure utility functions (no React).

## Tech stack notes

- React 19, TypeScript 5.9, Vite 7, Zustand, Axios, react-router-dom v7 (HashRouter), Chart.js, CodeMirror 6, SCSS Modules, i18next.
- Single-file build via `vite-plugin-singlefile`: assets get inlined into `dist/index.html`. Don't rely on multiple network requests after the initial HTML load.

## Code conventions

- Lint passes with no warnings (`--report-unused-disable-directives` enabled).
- TypeScript strict; prefer `unknown` over `any` and narrow at the boundary.
- New API clients: typed request/response with explicit error type — see `src/services/api/promptRules.ts` for the pattern.
- New pages: pair `Page.tsx` with `Page.module.scss`, use SCSS Modules (no global selectors except via `:global()`).
- React Hooks: include all closure dependencies in `useCallback`/`useEffect` deps. ESLint `react-hooks/exhaustive-deps` is enabled.
- Don't introduce array indices as `key` in dynamic lists where rows can be removed — use a stable UID (see `PromptRulesPage.tsx`'s `modelUids` parallel array for the pattern).

## Backend API contract

All requests go to the backend's management API at `/v0/management/...`. The backend is the [Z-M-Huang/CLIProxyAPI](https://github.com/Z-M-Huang/CLIProxyAPI) fork. The auth header is `Authorization: Bearer <management-key>`.

When adding a new fork-only management endpoint:
1. Add the typed client in `src/services/api/<feature>.ts`.
2. Re-export from `src/services/api/index.ts`.
3. Add the page / UI affordance.
4. Add i18n keys in all four locale files.
5. Document the customization in `CONTRIBUTING.md`'s customization surface.

## See also

- `CONTRIBUTING.md` — fork workflow (branch model, upstream sync, release process).
- `CLAUDE.md` — Claude Code-specific quick rules.
