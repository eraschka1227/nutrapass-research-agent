# Deployment

## Fast controlled deploy

Hermes/Q can deploy without extra GitHub or Shopify steps when `CLOUDFLARE_API_TOKEN` is present in the service environment:

```bash
npm run deploy:all
```

That command checks Cloudflare auth, runs tests, deploys the Pages widget, and verifies the live Worker/widget URLs.

Full backend + widget deploy, only when the Cloudflare token has Worker edit permissions:

```bash
npm run deploy:all -- --include-worker
```

Widget-only:

```bash
npm run deploy:widget
```

Worker-only:

```bash
npm run deploy:worker
```

## Recommended workflow

Use GitHub + Cloudflare with separate preview and production paths.

```text
feature branch / pull request
        ↓
Cloudflare Pages preview deployment
        ↓
Eric review / compliance check
        ↓
merge to main
        ↓
production deploy
```

## Frontend/widget deployment

The Research Agent frontend is a static widget in `index.html` with public assets in `Art/`.

Stage a clean Pages artifact:

```bash
npm install
npm test
npm run stage:widget
```

Deploy manually when Cloudflare auth is available:

```bash
CLOUDFLARE_API_TOKEN=... npm run deploy:widget
```

Default Pages project from `scripts/deploy-widget.sh`:

```text
nutrapass-widget
```

Override if needed:

```bash
NUTRAPASS_PAGES_PROJECT=research-agent npm run deploy:widget
```

## Worker/API deployment

The Worker is configured in `wrangler.toml`:

```text
name = nutrapass-ai
main = api/nutrapass-worker.js
```

Deploy:

```bash
npm install
npx wrangler login
npm run secret:anthropic
npm run deploy
```

Optional OpenAI fallback/A-B key:

```bash
npm run secret:openai
```

Do not put AI provider keys in Shopify, `index.html`, GitHub, or screenshots. Use Cloudflare Worker secrets.

## GitHub permissions

Preferred:

- Developer: branch/PR access.
- Eric: production merge/deploy approval, Cloudflare secrets, Shopify admin, DNS.
- Hermes/Q: deploy key or short-lived token only as needed.

## Production verification checklist

Before saying “deployed”:

- [ ] `npm test` passes.
- [ ] `npm run stage:widget` creates only public files.
- [ ] Cloudflare deployment command completes.
- [ ] Production URL loads in a real browser.
- [ ] Research Agent can submit at least one safe educational prompt.
- [ ] Shopify page/embed points at the correct production URL.
- [ ] No medical diagnose/treat/cure/prevent language was introduced.
