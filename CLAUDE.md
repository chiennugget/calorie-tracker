# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A free, private calorie/macro/weight tracker. It's a React + TypeScript PWA built with Vite and hosted on GitHub Pages at `https://chiennugget.github.io/calorie-tracker/`. The user is in Singapore, so hawker food matters. The plan is to port it to React Native later, which shapes the architecture (see below).

## Commands

```bash
npm run dev                 # http://localhost:5173/calorie-tracker/
npm test                    # vitest run (app + worker tests)
npx vitest run src/lib/sgFoods.test.ts        # one file
npx vitest run -t "tolerates typos"            # one test by name
npm run build               # tsc -b && vite build (typecheck is part of the build)
npm run lint                # oxlint
npx tsc -p worker/tsconfig.json                # typecheck the Cloudflare worker (not covered by tsc -b)
```

Pushing to `main` runs `.github/workflows/deploy.yml`, which tests, builds and deploys to Pages. The Vite `base` is `/calorie-tracker/`; override it with the `BASE_PATH` env var.

The `worker/` folder is deployed separately by the user from their own machine with `npx wrangler deploy` (see `worker/README.md`). CI never deploys it.

## Architecture

**Two layers:**
- `src/lib/` is framework-agnostic TypeScript with no DOM or React imports, except `useStore.ts` and `aiScan.ts`. Keep it portable for the React Native port.
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
- `AppData.version` gates backup import in `storage.parseData`, which also normalises missing fields. Update it when the schema changes.
- Dates are local `YYYY-MM-DD` strings. Use the `lib/date.ts` helpers, never `toISOString()`, which is UTC.

**Food sources, all ending in `store.addEntry`:**
- Quick add, saved meals and recent entries.
- `lib/sgFoods.ts` is an offline Singapore hawker database: about 90 dishes with `oilG`, portion factors and add-ons.
  - `computeDish` applies the portion, oil and add-on adjustments.
  - `searchSgDishes` does token search with a typo, initials and subsequence fallback.
  - This file is **also imported by the worker**, so keep it free of DOM code.
- `lib/foodApi.ts` handles Open Food Facts search and barcode lookup.
  - The legacy `/cgi/search.pl` is the only OFF search that allows browser CORS calls, and its rate-limit 503s have no CORS headers, so it retries once.
  - When the AI worker is configured, search goes through the worker's `/search` proxy instead, which uses `search.openfoodfacts.org`.

**Optional AI worker (`worker/`):**
- A Cloudflare Worker that holds the Gemini key as a secret.
- Endpoints: `/health`, `POST /estimate` and `GET /search`, all authenticated by an `X-App-Token` header plus an `ALLOWED_ORIGINS` check.
- `estimate` sends the photo with a Singapore-hawker system prompt and the dish list from `sgFoods`. It asks for schema-constrained JSON and runs the result through `sanitiseEstimate`.
- On 503, 429 or 404 it retries and then falls back from `GEMINI_MODEL` to `GEMINI_FALLBACK_MODEL`.
- On the app side, `lib/aiScan.ts` keeps its config in a **separate localStorage key**, so it stays out of backups. It downsizes photos to a 1024px JPEG before upload. `components/AiScan.tsx` shows a review step: matched dishes are recomputed from `sgFoods` with editable portion and oil.

**UI conventions:**
- All styling lives in one file, `src/index.css`, with design tokens on `:root` and a dark-mode override. There's no CSS framework.
- The look is a warm cream background, bold grotesk headings, royal-blue (`--accent`) pill buttons, and pastel meal cards (`--breakfast`, `--lunch`, `--dinner`, `--snacks`). Reuse the tokens rather than hard-coding colours.
- `Sheet` (`components/ui.tsx`) wraps a native `<dialog>`.
  - It locks body scroll with an iOS-safe `position: fixed` technique.
  - `tall` gives it a fixed height, so inputs such as the search box don't jump when content changes.
- Settings sub-pages are driven from `App.tsx` (`settingsPage` state plus `history.pushState`), so the phone's back gesture works.
- Progress and Weight are lazy-loaded because recharts is heavy.
- Inputs stay at 16px or larger, otherwise iOS zooms in on focus.

## Testing notes

- Tests run in a Node environment (vitest), not a DOM. Unit-test the pure `lib/` and `worker/` logic.
- The worker tests stub `fetch`. `estimate()` takes `fetchImpl` and `delayMs` parameters so tests can avoid real network calls and sleeps.
- UI changes are checked by hand with the preinstalled Playwright Chromium against `npx vite preview --port 4173`, using phone viewports (`devices['iPhone 13']`).

## Design references

`.mcp.json` registers the **inspo** MCP server (`https://inspomcp.dev/api/mcp`), an archive of real site designs. Use it when redesigning screens. The design references so far: Headway, ClassPass, Headspace, Alma.
