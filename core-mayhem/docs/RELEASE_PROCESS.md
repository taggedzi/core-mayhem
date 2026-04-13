# Release Process

This document covers how to build Core Mayhem into a production static site and deploy it.

---

## Overview

The project uses **Vite** to bundle TypeScript into a fully static site (HTML + CSS + hashed JS + copied assets). The output lands in `core-mayhem/dist/` and can be served by any static host with no server-side logic required.

All commands below are run from inside `core-mayhem/` (the inner project directory).

---

## 1. Pre-Release Checks

Run the full CI suite before building. This catches type errors, lint violations, test failures, and format issues in one pass:

```bash
npm run ci
```

This runs: `typecheck → lint → test:coverage → build`

To run checks individually:

```bash
npm run typecheck      # TypeScript type checking (no emit)
npm run lint           # ESLint
npm run format         # Prettier format check (use format:write to auto-fix)
npm test               # Run all tests once
```

If the pre-commit Husky hook catches issues, fix them before proceeding.

---

## 2. Building

```bash
npm run build
```

This runs `tsc -b && vite build` and outputs to `dist/`.

**What gets built:**
- `dist/index.html` — the entry point
- `dist/assets/*.js` / `*.css` — content-hashed bundles (safe for long-lived caching)
- `dist/assets/audio/` — audio files from `src/assets/audio/`
- `dist/assets/music/` — background music tracks from `public/assets/music/`
- `dist/assets/sprites/` — character/entity sprites from `public/assets/sprites/`
- `dist/assets/llama/` — WASM LLM inference modules from `public/assets/llama/`
- `dist/_headers` — Netlify/Cloudflare Pages security and cache headers

### Preview Locally Before Deploying

```bash
npm run preview
```

Serves `dist/` locally at `http://localhost:4173`. Test the golden path (start a match, audio, banter, HUD) before uploading.

---

## 3. Deploying

The `dist/` folder is self-contained static output. Upload or point your host to it.

### Option A — Netlify (recommended, zero-config)

Netlify reads `dist/_headers` automatically for security and cache headers.

**Via the Netlify dashboard (drag and drop):**
1. Build locally: `npm run build`
2. Go to [app.netlify.com](https://app.netlify.com) → "Add new site" → "Deploy manually"
3. Drag the `dist/` folder into the upload area

**Via continuous deployment (GitHub):**
1. Connect your GitHub repo in the Netlify dashboard
2. Set build settings:
   - **Base directory:** `core-mayhem`
   - **Build command:** `npm run build`
   - **Publish directory:** `core-mayhem/dist` (or `dist` if Netlify treats the base dir as root)
3. Push to `main` to trigger a deploy

**Via Netlify CLI:**
```bash
npm install -g netlify-cli
netlify deploy --dir=dist --prod
```

### Option B — Cloudflare Pages

Cloudflare Pages also reads `_headers` files automatically.

**Via dashboard:**
1. Connect your GitHub repo
2. Set:
   - **Root directory:** `core-mayhem`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`

**Via Wrangler CLI:**
```bash
npm install -g wrangler
wrangler pages deploy dist --project-name=core-mayhem
```

### Option C — GitHub Pages

**Via GitHub Actions:**

Create `.github/workflows/deploy.yml` in the repo root:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pages: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: core-mayhem/package-lock.json
      - run: npm ci
        working-directory: core-mayhem
      - run: npm run build
        working-directory: core-mayhem
      - uses: actions/upload-pages-artifact@v3
        with:
          path: core-mayhem/dist
      - uses: actions/deploy-pages@v4
```

Then in your repo settings: **Pages → Source → GitHub Actions**.

### Option D — VPS / Nginx / Apache

```bash
# Build locally
npm run build

# Copy dist/ to your server (adjust user, host, and path)
rsync -avz --delete dist/ user@yourserver.com:/var/www/core-mayhem/
```

**Nginx config equivalent to `_headers`:**

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;
    root /var/www/core-mayhem;
    index index.html;

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), accelerometer=(), payment=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; media-src 'self'; connect-src *; worker-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'self'" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Long-lived cache for hashed Vite bundles
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Never cache the HTML entry point
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Never cache the music playlist
    location = /assets/music/playlist.json {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
```

---

## 4. Post-Deploy Checks

After deploying, verify:

- [ ] Game loads and a match starts correctly
- [ ] Audio plays (SFX and music)
- [ ] Banter system works (in-browser LLM or Ollama, depending on config)
- [ ] Validate security headers at [securityheaders.com](https://securityheaders.com)
- [ ] Validate CSP at [csp-evaluator.withgoogle.com](https://csp-evaluator.withgoogle.com)

---

## 5. Maintenance Builds

When updating content only (no code changes), you can skip tests:

```bash
npm run build && npm run preview   # build and spot-check locally
```

When updating code, always run the full CI suite first:

```bash
npm run ci
```

### Cleaning Stale Build Artifacts

If you have stray `.js` or `.js.map` files left from a `tsc` run outside of the Vite pipeline:

```bash
npm run clean:build          # removes TS-compiled JS artifacts next to .ts source files
npm run clean:build -- --dry # preview what would be removed without deleting
```

---

## Notes

- **Base URL:** `vite.config.ts` sets `base: './'` so all asset URLs are relative. The site works at domain root or any subpath without extra configuration.
- **Ollama / LLM banter:** The CSP allows `connect-src *` because the Ollama URL is user-configured at runtime. If you disable the Ollama feature you can tighten this to `connect-src 'self'` in `public/_headers`.
- **Music playlist:** Add tracks to `public/assets/music/` and list them in `public/assets/music/playlist.json`. These are served statically and never bundled by Vite.
