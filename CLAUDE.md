# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A free, private calorie/macro/weight tracker. It's a React + TypeScript PWA built with Vite and hosted on GitHub Pages at `https://chiennugget.github.io/calorie-tracker/`. The user is in Singapore, so hawker food matters. The plan is to port it to React Native later, which shapes the architecture (see below).

## Commands

```bash
npm run dev                 # http://localhost:5173/calorie-tracker/
npm test                    # vitest run (unit tests in src/**/*.test.ts)
npm run e2e                 # Playwright: builds, serves on :4173, runs e2e/ on iPhone 13 + desktop Chromium with axe
npx vitest run src/lib/sgFoods.test.ts        # one file
npx vitest run -t "tolerates typos"            # one test by name
npm run build               # tsc -b && vite build (typecheck is part of the build)
npm run lint                # oxlint
```

Pushing to `main` runs `.github/workflows/deploy.yml`, which lints, unit-tests, builds, runs the E2E suite and deploys to Pages. PRs run the same checks without deploying. The Vite `base` is `/calorie-tracker/`; override it with the `BASE_PATH` env var.

## Architecture

**Two layers:**
- `src/lib/` is framework-agnostic TypeScript with no DOM or React imports, except `useStore.ts` and `backup.ts` (file downloads). Keep it portable for the React Native port.
- `src/components/` and `src/screens/` hold the web UI.

**State:**
- `lib/store.ts` is a tiny `Store` class. Every mutation goes through its methods, for example `addEntry`, `logWeight`, `copyEntries` and `updateSettings`.
- It persists through a `StorageAdapter` (`lib/storage.ts`). The adapter is localStorage today and would be MMKV or AsyncStorage on native.
- `lib/useStore.ts` exposes a singleton `store` plus `useAppData()`, built on `useSyncExternalStore`.
- Screens receive the whole `AppData` as a prop and call `store.*` directly. There's no other state library.

**Data model (`lib/types.ts`):**
- `FoodEntry.nutrients` are **per serving**. Totals are `nutrients × servings`, so use `entryTotal` / `sumEntries` in `lib/nutrition.ts`.
- There's one `WeighIn` per date; logging again replaces it.
- Exercise calories are shown but deliberately **not** added to the calorie budget: `daySummary().remaining = goal − food`.
- `AppData.version` (`DATA_VERSION`, currently 2) gates backup import in `storage.parseData`. That function migrates older versions step by step in `migrate()`, validates row by row (bad rows are dropped, numbers coerced) and refuses newer versions. When the schema changes, bump `DATA_VERSION`, add a migration step and add a test in `storage.test.ts`.
- `AppData.meta` holds housekeeping (`onboarded`, `lastBackupAt`, `backupReminderDismissedAt`), not diary data.
- `Store` reports failed saves through `setSaveErrorHandler` (App shows a toast). `useStore.ts` reloads on the `storage` event so tabs stay in sync.
- `lib/insights.ts` holds derived logic: `weekBudget`, `estimateTdee` (adaptive maintenance), `adaptiveCalorieGoal`, `projectGoalDate`, `recentFoods`, `usualFoods`, `recentMeals` and `shouldRemindBackup`.
- Dates are local `YYYY-MM-DD` strings. Use the `lib/date.ts` helpers, never `toISOString()`, which is UTC.

**Food sources, all ending in `store.addEntry`:**
- Quick add, saved meals and recent entries.
- `lib/sgFoods.ts` is an offline Singapore hawker database: about 90 dishes with `oilG`, portion factors and add-ons.
  - `computeDish` applies the portion, oil and add-on adjustments.
  - `searchSgDishes` does token search with a typo, initials and subsequence fallback.
- `lib/foodApi.ts` handles Open Food Facts search and barcode lookup.
  - The legacy `/cgi/search.pl` is the only OFF search that allows browser CORS calls, and its rate-limit 503s have no CORS headers, so it retries once.

(An AI photo worker used to live in `worker/`; it was removed because it wasn't being used.)

**Cloud backup (optional, Supabase):**
- It's switched on by the build variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (GitHub Actions variables, or `.env.local`). Without them the cloud UI is hidden. Setup steps are in `docs/cloud-backup.md`, and the schema is in `supabase/migrations/`.
- localStorage stays the source of truth. The cloud holds whole-`AppData` JSON snapshots, one row per user per local day, in the `backups` table with RLS.
- `lib/cloudBackup.ts` (pure) holds the rules:
  - the `BackupTarget` interface
  - `shouldAutoUpload`, the wipe safeguard that never uploads a wiped or shrunk diary over a bigger cloud copy
  - `snapshotsToPrune` (30 daily snapshots, then monthly)
  - `backupSignature`, which ignores `meta` so recording `lastBackupAt` doesn't trigger another upload
- `src/cloud/cloud.ts` is the web orchestrator. It subscribes to the store, debounces uploads, uploads on `visibilitychange`, and exposes `useCloud()` plus the actions. `src/cloud/supabase.ts` is the only file that imports supabase-js and is dynamically imported, so it stays out of the main bundle.
- Sign-in uses an emailed 6-digit code (`signInWithOtp` / `verifyOtp`), not a link, because links open outside the iOS home-screen app. A successful upload sets `meta.lastBackupAt`, which silences the backup reminder.

**UI conventions:**
- All styling lives in one file, `src/index.css`, with design tokens on `:root` and a dark-mode override. There's no CSS framework.
- The look is a warm cream background, bold grotesk headings, royal-blue (`--accent`) pill buttons, and pastel meal cards (`--breakfast`, `--lunch`, `--dinner`, `--snacks`). Reuse the tokens rather than hard-coding colours.
- `Sheet` (`components/ui.tsx`) wraps a native `<dialog>`.
  - It locks body scroll with an iOS-safe `position: fixed` technique.
  - `tall` gives it a fixed height, so inputs such as the search box don't jump when content changes.
- Settings sub-pages are driven from `App.tsx` (`settingsPage` state plus `history.pushState`), so the phone's back gesture works.
- Progress and Weight are lazy-loaded because recharts is heavy.
- Inputs stay at 16px or larger, otherwise iOS zooms in on focus.
- Text colours must pass WCAG AA (4.5:1) on cards *and* meal pastels. Use `--protein-ink`, `--carbs-ink` and `--fat-ink` for macro text; the plain `--protein` etc. are for chart fills. The axe E2E checks enforce this in light and dark mode.
- If an `aria-label` is used, it must contain the visible text (WCAG 2.5.3). Prefer `.sr-only` text for extra context.

## Testing notes

- Unit tests run in a Node environment (vitest), not a DOM. Unit-test the pure `lib/` logic: `core.test.ts`, `insights.test.ts`, `storage.test.ts` and `sgFoods.test.ts`.
- E2E (`e2e/`, Playwright) runs against `vite preview` of the production build. It uses the `mobile` project (iPhone 13 viewport on Chromium) and the `desktop` project (smoke and a11y only).
  - Seed state with `seed(page, seedData({...}))` from `e2e/fixtures.ts`. Pass `null` for a fresh install.
  - Open Food Facts is mocked in every test; tests never hit the real API.
  - The E2E build goes to `dist-e2e` with a fake Supabase URL. `mockSupabase(page, rows)` in fixtures is an in-memory fake of auth and the `backups` table, and `signedIn(page)` starts with a session; call it after `seed()`. Unmocked Supabase calls fail as if offline.
  - The test process runs in `Asia/Singapore` like the browser (set in `playwright.config.ts`), so `day()` matches the app's today.
  - The service worker is blocked, and a11y tests emulate `reducedMotion: 'reduce'` so axe doesn't read mid-animation colours.
- `@playwright/test` is pinned to the preinstalled browser's version (1.63.0), and `playwright-core` is pinned via `overrides`. Upgrade them together.

## Design references

`.mcp.json` registers the **inspo** MCP server (`https://inspomcp.dev/api/mcp`), an archive of real site designs. Use it when redesigning screens. The design references so far: Headway, ClassPass, Headspace, Alma.
