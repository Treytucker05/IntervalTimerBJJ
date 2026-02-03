<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your VOW BJJ timer

This repository contains a fully client-side interval timer that runs without any API keys.

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

1. Ensure GitHub Pages is enabled for your repository.
2. Push to `main` (or run the workflow manually) to trigger the **Deploy to GitHub Pages** workflow.

> **Tip:** GitHub Pages serves the built `dist/` output produced by Vite. Opening `index.html` directly from the repo will cause the MIME type error above because the browser cannot execute raw `.tsx` files.
