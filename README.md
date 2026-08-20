# Anjaneya Decorations — Order Management (Frontend)

Next.js 14 (App Router), fully TypeScript, UI built with
[HeroUI](https://www.heroui.com/), themed with colors sampled directly
from the Anjaneya Decorations logo.

This is now a **static-export SPA** meant for **Cloudflare Pages**. All
data lives in a separate Cloudflare Worker + D1 backend (see the sibling
`backend/` project) — this app talks to it entirely over `fetch()` from
the browser.

## What changed from the file-based version

- `next.config.mjs` sets `output: "export"` — `next build` now produces a
  plain `out/` folder of static HTML/JS/CSS, no Node server required.
- The old `app/api/*` routes and `lib/store.ts` (which read/wrote
  `data/*.json` on disk) are gone. That logic now lives in the Worker.
- Every page (`/`, `/orders`, `/orders/new`, `/orders/detail`,
  `/customers`, `/staff`) is a client component that fetches from the
  Worker API on mount, via `lib/api.ts` (`apiFetch`, using
  `NEXT_PUBLIC_API_URL`).
- The order detail route changed from a dynamic segment
  (`/orders/[id]`) to a query param (`/orders/detail?id=ADVKM-0007`),
  since static export can't pre-generate pages for IDs it doesn't know
  about at build time.
- `AppShell`/`AppShellInner` load HeroUI client-side only
  (`next/dynamic(..., { ssr: false })`). This app never needs
  server-rendered HTML — everything is fetched after the page loads
  anyway — and it sidesteps an SSR incompatibility between
  HeroUI/framer-motion and Next's static-export prerenderer.

## Run it locally

Requires [Node.js](https://nodejs.org) 18+, and the backend running
(see `backend/README.md`).

```bash
npm install
cp .env.local.example .env.local   # points at http://localhost:8787
npm run dev
```

Open http://localhost:3000.

## Build for Cloudflare Pages

```bash
npm install
NEXT_PUBLIC_API_URL=https://your-worker.workers.dev npm run build
```

This produces a static `out/` folder — that's what you deploy.

### Deploy via the Cloudflare dashboard

1. Push this project to a GitHub/GitLab repo (or use direct upload).
2. In Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages**
   → connect your repo.
3. Build settings:
   - **Framework preset:** Next.js (Static HTML Export)
   - **Build command:** `npm run build`
   - **Build output directory:** `out`
   - **Environment variable:** `NEXT_PUBLIC_API_URL` = your deployed
     Worker URL (e.g. `https://anjaneya-backend.<you>.workers.dev`)
4. Deploy. Cloudflare rebuilds on every push.

### Deploy via Wrangler CLI

```bash
npm install
NEXT_PUBLIC_API_URL=https://your-worker.workers.dev npm run build
npx wrangler pages deploy out --project-name=anjaneya-decorations
```

## Notes

- Location capture (`navigator.geolocation`) needs `localhost` or HTTPS —
  both `localhost:3000` and your `*.pages.dev` deployment satisfy that.
- Deploy the backend first so you have a Worker URL to build the
  frontend against — see `backend/README.md`.
- Theme colors and the HeroUI Tailwind v4 plugin config still live in
  `app/globals.css` and `heroui.plugin.js`, unchanged.
