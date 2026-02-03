<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1tiZQ4Hl3yZSBs0Ta0b0Z03AEDZhrYUog

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

### Troubleshooting

If you see an error like:

```
Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "application/octet-stream".
```

it means the browser is trying to load `index.tsx` directly from a static server. `*.tsx` files must be processed by Vite (or another bundler) before the browser can run them. Make sure you start the dev server with `npm run dev`, or build and serve the `dist/` output with `npm run build` and `npm run preview`.

## Deploy to GitHub Pages

1. In your GitHub repository, go to **Settings → Secrets and variables → Actions** and add a secret named `GEMINI_API_KEY`.
2. Ensure GitHub Pages is enabled for your repository.
3. Push to `main` (or run the workflow manually) to trigger the **Deploy to GitHub Pages** workflow.

> **Note:** This app is a client-side bundle, so the `GEMINI_API_KEY` is embedded in the built assets and exposed to anyone who can load the site.
