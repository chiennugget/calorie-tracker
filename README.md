# Calorie Tracker

A free, private calorie and macro tracker with the everyday MyFitnessPal features and no paywall. It runs in the browser and can be installed to your phone's home screen as a PWA. All data stays on your device.

**Live app:** https://chiennugget.github.io/calorie-tracker/

## Features

**Food diary**
- **Quick add**: log one-off meals (like dinner out) with a custom name, calories, protein, carbs and fat. If you leave calories blank, they're worked out from the macros, and you get a warning when the numbers don't add up.
- **My meals**: save meals and add them again in one tap. You can sort by most used, most recent or A–Z.
- **Recent**: your usual foods for each meal (ranked by how often you have them then), whole recent meals you can log again in one tap, and everything else you've eaten lately.
- **Singapore hawker database**: about 90 hawker and kopitiam dishes (chicken rice, char kway teow, laksa, economy rice, prata, kopi and more) with **portion**, **oil level** and **add-on** adjusters. Works offline.
- **Food search**: hawker dishes appear as you type. Packaged foods come from the free [Open Food Facts](https://world.openfoodfacts.org) database, logged by grams or by servings.
- **Barcode scanner**: uses your phone camera. It uses the native BarcodeDetector where available and falls back to ZXing. You can also type a barcode by hand.
- Breakfast, lunch, dinner and snack sections. **Copy yesterday's meal**, or **copy any meal to another day or meal**, with undo.
- Edit an entry's servings or meal, delete it with undo, or save any entry to My meals.

**Goals & tracking**
- Daily calorie and macro goals, shown with a progress ring and bars.
- A **goal calculator** (Mifflin–St Jeor BMR × activity) that suggests calorie and macro targets for losing, maintaining or gaining weight.
- **Water** tracking with quick-add buttons (ml or oz).
- **Exercise** logging with rough presets. Burned calories are shown separately and do not change your remaining calories.
- A logging streak.
- A **weekly budget** card: how much of the week's calories are left, and a per-day figure for the rest of the week. Days you didn't log are left out instead of counted as zero.

**Weight**
- **Daily weigh-ins** (kg or lb), with notes and full history.
- A smoothed **trend weight** line that evens out daily water swings, plus a goal-weight line and 7-day and total change.

**Progress**
- Charts of calories against your goal over 7, 30 or 90 days.
- Average macro split, calories per meal, and days on target.
- **Your real maintenance**: an adaptive estimate from what you ate and how your trend weight moved over the last 4 weeks, with a one-tap "use as my goal" for your target rate.
- A **goal-weight date** projected from your current pace (also shown on the Weight tab).

**Your data**
- Stored on the device only, with no account.
- JSON backup export and import, plus CSV export of your diary and weigh-ins.
- Works offline (service worker).
- A **backup reminder** after the first week, then every 14 days. You get a warning if a change can't be saved (storage full or private browsing), and the app asks the browser to keep its storage persistent.
- Older data and backups are migrated automatically. Imports are validated row by row, so one corrupt row doesn't break a restore.
- Multiple open tabs stay in sync.

## Development

```bash
npm install
npm run dev      # http://localhost:5173/calorie-tracker/
npm test         # unit tests for the core logic (vitest)
npm run e2e      # Playwright E2E on iPhone + desktop viewports, with axe accessibility checks
npm run build
```

Pushing to `main` runs lint, unit tests, the build and the E2E suite, then deploys to GitHub Pages (`.github/workflows/deploy.yml`).

## Project structure

```
src/
  lib/          # framework-agnostic core (types, store, nutrition maths, storage, food API)
  components/   # shared UI: add-food sheet, meal form, barcode scanner, etc.
  screens/      # Diary, Progress, Weight, Settings
e2e/            # Playwright specs (smoke, logging, data safety, accessibility)
```

## Roadmap: native app

The code is laid out so it can move to React Native / Expo later:
- Everything in `src/lib/` is plain TypeScript with no DOM dependencies, so it can be copied as-is.
- Storage goes through the `StorageAdapter` interface in `src/lib/storage.ts`. Swap `localStorage` for MMKV or AsyncStorage.
- `Store` is a plain class with a `subscribe`/`getState` pair, so it plugs into `useSyncExternalStore` the same way.
- On native, use `expo-camera` for barcodes and `victory-native` or `react-native-gifted-charts` for charts.

Other ideas: recipe builder (combine foods into a meal), micronutrients, intermittent fasting timer, body measurements, optional cloud sync.
