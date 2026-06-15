# NutraPass Manual Product Catalog Refresh Protocol

Use this when Shopify products, tags, descriptions, or product URLs have changed and the NutraPass Research Agent should refresh its product catalog.

## Copy/paste prompt for Hermes

```text
Refresh the NutraPass Research Agent product catalog manually and verify brand coverage.

Project path: /home/ericraschka/Q Sync/NutraPass/NutraPass
Worker: https://nutrapass-ai.eric-012.workers.dev
Widget: https://nutrapass-widget.pages.dev

Do the following:
1. Run the manual catalog refresh endpoint: POST https://nutrapass-ai.eric-012.workers.dev/product-catalog/refresh
2. Fetch https://nutrapass-ai.eric-012.workers.dev/product-catalog and report:
   - mode
   - source
   - productCount
   - lastSyncedAt
   - brand counts
3. Run the local regression tests from the project directory:
   - npm test
4. Verify the live widget can read the refreshed catalog using a cache-busted URL.
5. Test these brand-coverage queries and summarize which brands appear:
   - protein bars for workouts
   - running fuel or salty carbs
   - creatine for strength
   - vegan collagen vitamin C beauty support
   - hydration electrolytes
   - gut prebiotic probiotic
6. Do not deploy unless code changed. If only Shopify products changed, the manual refresh is enough.
7. Save a short dated report under /home/ericraschka/Q Sync/NutraPass/NutraPass/reports/.

Keep claims compliance-safe. Do not say products treat, cure, prevent, reverse, or heal anything.
```

## Direct manual refresh command

From any terminal with network access:

```bash
python3 - <<'PY'
import json, urllib.request
base='https://nutrapass-ai.eric-012.workers.dev'
req=urllib.request.Request(base+'/product-catalog/refresh', method='POST', data=b'{}', headers={'Content-Type':'application/json','User-Agent':'NutraPassManualRefresh/1.0'})
refresh=json.load(urllib.request.urlopen(req, timeout=120))
cat=json.load(urllib.request.urlopen(urllib.request.Request(base+'/product-catalog', headers={'User-Agent':'NutraPassManualRefresh/1.0'}), timeout=60))
print(json.dumps({
  'refreshMode': refresh.get('mode'),
  'mode': cat.get('mode'),
  'source': cat.get('source'),
  'productCount': cat.get('productCount') or len(cat.get('products', [])),
  'lastSyncedAt': cat.get('lastSyncedAt')
}, indent=2))
PY
```

## Operational notes

- The daily Cloudflare cron is intentionally disabled. Shopify catalog sync is manual to avoid unnecessary Storefront API/token use.
- The Worker still caches the catalog in KV.
- Normal Shopify product edits do not require a widget deploy.
- Deploy only when Worker/widget code changes.
- If the storefront domain changes, update `ALLOWED_ORIGINS` in `wrangler.toml` before deploying.
- Optional Turnstile support is coded but inactive unless `TURNSTILE_SECRET_KEY` is added as a Worker secret and the widget starts sending `turnstileToken`.
