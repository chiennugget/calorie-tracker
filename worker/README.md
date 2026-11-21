# AI food scan server (Cloudflare Worker)

A tiny server that gives the Calorie Tracker app AI photo estimates. It sends your food photo to **Google Gemini** with a prompt tuned for Singapore hawker food, and returns calories and macros for you to review.

- **Cost:** $0. Cloudflare Workers' free plan allows 100,000 requests a day, and Gemini's free tier covers personal use (with daily limits).
- **Privacy:** on Gemini's **free tier, Google may use what you send to improve its products.** Don't photograph anything private. Turning on billing in Google AI Studio changes this, but then it's no longer free.
- **Security:** your Gemini key stays on Cloudflare as a secret. The app must send your access code (`APP_TOKEN`), and only `ALLOWED_ORIGINS` (your GitHub Pages site) can call the server from a browser.

## One-time setup (about 10 minutes, on your Mac)

You need [Node.js](https://nodejs.org) 20 or newer. Check with `node -v`.

1. **Get a Gemini API key:** go to https://aistudio.google.com/apikey, then **Create API key**, and copy it.
2. **Create a free Cloudflare account** at https://dash.cloudflare.com/sign-up.
3. **Get the code and install:**

   ```bash
   git clone https://github.com/chiennugget/calorie-tracker.git
   cd calorie-tracker/worker
   npm install
   ```

4. **Log in to Cloudflare** (a browser window opens):

   ```bash
   npx wrangler login
   ```

5. **Add your secrets.** Paste each value when asked.

   ```bash
   npx wrangler secret put GEMINI_API_KEY
   ```

   For the access code, use any long random string. This makes one for you:

   ```bash
   openssl rand -hex 24
   ```

   ```bash
   npx wrangler secret put APP_TOKEN
   ```

   If `secret put` says the worker doesn't exist yet, run step 6 first, then come back to this step.

6. **Deploy:**

   ```bash
   npx wrangler deploy
   ```

   It prints a URL like `https://calorie-tracker-ai.<your-name>.workers.dev`.

7. **Connect the app:** go to **More → AI food scan**, paste the URL and your access code, then tap **Save & test connection**.

## Changing things

- **Different model:** edit `GEMINI_MODEL` in `wrangler.toml` (default is `gemini-flash-latest`), then run `npx wrangler deploy`. When that model is overloaded (503) or out of free quota (429), the server retries and then switches to `GEMINI_FALLBACK_MODEL` (default `gemini-flash-lite-latest`).
- **Running the app locally too:** add `http://localhost:5173` to `ALLOWED_ORIGINS` in `wrangler.toml`.
- **See live logs:**

  ```bash
  npx wrangler tail
  ```

- **New access code:** run `npx wrangler secret put APP_TOKEN` again, then update it in the app.

## API

| Method | Path        | Body                                   | Returns |
| ------ | ----------- | -------------------------------------- | ------- |
| GET    | `/health`   | none                                   | `{ ok, model }` |
| GET    | `/search?q=` | none                                  | `{ hits }`: Open Food Facts search, fetched by the server because browsers can't call it directly (CORS) |
| POST   | `/estimate` | `{ image: base64 JPEG, note?: string }` | `{ items: [{ name, matchId, portion, oil, calories, protein, carbs, fat, confidence, notes }], summary, model }` |

Every request needs the `X-App-Token` header. `matchId` refers to a dish in `src/lib/sgFoods.ts`, which the worker and the app share.
