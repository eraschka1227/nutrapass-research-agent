# NutraPass AI setup

This folder now has a hybrid AI setup:

```txt
Index.html → Cloudflare Worker → Claude API → strict JSON → NutraPass renderer
```

The Anthropic/Claude key is never stored in `Index.html`. The page only calls a backend endpoint through `window.NUTRAPASS_AI_ENDPOINT`.

## Files

- `Index.html` — single-file NutraPass widget with static fallback and AI-ready frontend.
- `api/nutrapass-worker.js` — Cloudflare Worker backend that calls Claude server-side, with OpenAI still available as an optional fallback/A-B provider.
- `wrangler.toml` — Cloudflare Worker deploy config.
- `tests/ai_integration_test.js` — checks frontend/backend AI integration guardrails.
- `tests/worker_deploy_config_test.js` — checks deploy config and setup docs.

## Local/static demo behavior

If the Worker is not deployed, the widget still works with the built-in static rules. When AI fetch fails, users see a small static fallback notice instead of a broken result.

## Deploy the Worker

Prerequisite: **Node.js 22+**. Current Wrangler releases require Node 22, and `package.json` pins Wrangler for repeatable deploys.

From this `NutraPass` folder:

```bash
npm install
npx wrangler login
npm run secret:anthropic
npm run deploy
```

`npm run secret:anthropic` wraps `wrangler secret put ANTHROPIC_API_KEY`, which stores the Claude API key server-side in Cloudflare.

Optional OpenAI fallback/A-B key:

```bash
npm run secret:openai
```

`npm run secret:openai` wraps `wrangler secret put OPENAI_API_KEY`, which stores the OpenAI key server-side in Cloudflare.

Optional model override:

```bash
npx wrangler secret put ANTHROPIC_MODEL
```

Default Claude model in `wrangler.toml` is `claude-haiku-4-5-20251001`, and `AI_PROVIDER = "claude"` makes Claude the primary response source. The Worker still supports `openai` or `ab` if you deliberately change `AI_PROVIDER` later.

For local Worker testing before deploy:

```bash
npm run dev
```

## Connect the HTML widget

Set the page endpoint before the NutraPass script runs if the Worker is deployed somewhere other than `/api/nutrapass-research`:

```html
<script>
  window.NUTRAPASS_AI_ENDPOINT = 'https://nutrapass-ai.YOUR_SUBDOMAIN.workers.dev';
</script>
```

If this file is embedded in Shopify/custom HTML, paste that small endpoint script immediately before the NutraPass widget HTML.

## Cost controls to add before broad launch

Recommended before real public traffic:

1. Add Cloudflare rate limiting or Turnstile.
2. Keep AI responses concise.
3. Send only matched product/ingredient context, not a giant catalog.
4. Set an Anthropic/Claude monthly usage budget.
5. Keep the static fallback enabled.

## Compliance guardrails included

The Worker prompt instructs the model to:

- provide educational wellness information only;
- avoid medical advice;
- avoid diagnose/treat/cure/prevent language;
- recommend only supplied/approved products;
- avoid invented citations;
- include food-first and lifestyle-first guidance;
- include professional-care notes for red flags.
