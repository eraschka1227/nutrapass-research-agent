# NutraPass Research Agent

Customer-facing NutraPass Research Agent widget plus Cloudflare Worker backend.

## What this repo owns

- `index.html` — the embeddable Research Agent / education-center widget.
- `api/nutrapass-worker.js` — Cloudflare Worker API that calls AI providers server-side.
- `tests/` — regression checks for AI integration, privacy/safety copy, UI behavior, and deployment config.
- `scripts/deploy-widget.sh` — clean Cloudflare Pages staging/deploy helper.
- `docs/` — deployment, Shopify embed, and compliance notes.

## Control model

Production should be controlled by Eric/NutraPass:

1. Developers push feature branches.
2. Pull requests create preview/review builds.
3. Eric approves merge to `main`.
4. `main` deploys to production Cloudflare Pages/Worker.
5. Shopify embeds the production Pages URL; Shopify should not contain AI secrets or core agent logic.

## Local setup

Requires Node.js 22+.

```bash
npm install
npm test
npm run stage:widget
```

## Deployment

See:

- [`docs/deployment.md`](docs/deployment.md)
- [`docs/shopify-embed.md`](docs/shopify-embed.md)
- [`docs/compliance-notes.md`](docs/compliance-notes.md)

## Current production references

Known existing surfaces:

- Widget/Page host: `https://nutrapass-widget.pages.dev`
- Worker API: `https://nutrapass-ai.eric-012.workers.dev`

Verify current runtime status before announcing a deploy as live. The droid insists. Annoying, but correct.
