# Calorie Tracker

A free, private calorie and macro tracker with the everyday MyFitnessPal features and no paywall. It runs in the browser and can be installed to your phone's home screen as a PWA. All data stays on your device.

**Live app:** https://chiennugget.github.io/calorie-tracker/

## Features

**Food diary**
- **Quick add**: log one-off meals (like dinner out) with a custom name, calories, protein, carbs and fat. If you leave calories blank, they're worked out from the macros, and you get a warning when the numbers don't add up.
- **My meals**: save meals and add them again in one tap. You can sort by most used, most recent or A–Z.
- **Recent foods**: re-log anything you've eaten before.
- **Food search**: search the free [Open Food Facts](https://world.openfoodfacts.org) database and log by grams or by servings.
- **Barcode scanner**: uses your phone camera. It uses the native BarcodeDetector where available and falls back to ZXing. You can also type a barcode by hand.
- Breakfast, lunch, dinner and snack sections, with **copy yesterday's meal**.
- Edit an entry's servings or meal, delete it with undo, or save any entry to My meals.

**Goals & tracking**
- Daily calorie and macro goals, shown with a progress ring and bars.
- A **goal calculator** (Mifflin–St Jeor BMR × activity) that suggests calorie and macro targets for losing, maintaining or gaining weight.
- **Water** tracking with quick-add buttons (ml or oz).
- **Exercise** logging with rough presets. Burned calories are shown separately and do not change your remaining calories.
- A logging streak.

**Weight**
- **Daily weigh-ins** (kg or lb), with notes and full history.
- A smoothed **trend weight** line that evens out daily water swings, plus a goal-weight line and 7-day and total change.

**Progress**
- Charts of calories against your goal over 7, 30 or 90 days.
- Average macro split, calories per meal, and days on target.
- **Estimated real maintenance** calories, worked out from what you ate and how your trend weight changed.

**Your data**
- Stored on the device only, with no account.
- JSON backup export and import, plus CSV export of your diary and weigh-ins.
- Works offline (service worker).

## Development

```bash
npm install
npm run dev      # http://localhost:5173/calorie-tracker/
npm test         # unit tests for the core logic
npm run build
```

Pushing to `main` runs the tests and deploys to GitHub Pages (`.github/workflows/deploy.yml`).

## Project structure

```
src/
  lib/          # framework-agnostic core (types, store, nutrition maths, storage, food API)
  components/   # shared UI: add-food sheet, meal form, barcode scanner, etc.
  screens/      # Diary, Progress, Weight, Settings
```

## Roadmap: native app

The code is laid out so it can move to React Native / Expo later:
- Everything in `src/lib/` is plain TypeScript with no DOM dependencies, so it can be copied as-is.
- Storage goes through the `StorageAdapter` interface in `src/lib/storage.ts`. Swap `localStorage` for MMKV or AsyncStorage.
- `Store` is a plain class with a `subscribe`/`getState` pair, so it plugs into `useSyncExternalStore` the same way.
- On native, use `expo-camera` for barcodes and `victory-native` or `react-native-gifted-charts` for charts.

Other ideas: recipe builder (combine foods into a meal), micronutrients, intermittent fasting timer, body measurements, optional cloud sync.
