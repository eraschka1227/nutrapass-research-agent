const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'api', 'nutrapass-worker.js'), 'utf8');
const wrangler = fs.readFileSync(path.join(root, 'wrangler.toml'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

function assert(name, condition) {
  if (!condition) {
    console.error(`FAIL: ${name}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${name}`);
  }
}

assert('worker exposes a live product catalog request route', /productCatalog/.test(worker) && /fetchLiveProductCatalog/.test(worker));
assert('worker can fetch Shopify Storefront products when token and domain are configured', /SHOPIFY_STOREFRONT_ACCESS_TOKEN/.test(worker) && /SHOPIFY_STORE_DOMAIN/.test(worker) && /\/api\/2025-10\/graphql\.json/.test(worker));
assert('worker paginates Shopify products so the import can include the full catalog', /hasNextPage/.test(worker) && /endCursor/.test(worker) && /after:\s*\$after/.test(worker) && /while\s*\(/.test(worker));
assert('worker normalizes Shopify products into NutraPass product-card fields', /normalizeShopifyProduct/.test(worker) && /imageUrl/.test(worker) && /brand/.test(worker) && /price/.test(worker) && /source:\s*'shopify_live'/.test(worker));
assert('worker preserves product URLs from supplied catalog after AI response', /enrichProductLinks/.test(worker) && /item\.url\s*\|\|\s*item\.u/.test(worker) && /match\.url\s*\|\|\s*match\.u/.test(worker));
assert('worker prefers live request products over static catalog for AI product recommendations', /approvedProductCatalog:\s*products\.length\s*\?\s*products\s*:\s*PRODUCT_CATALOG/.test(worker));
assert('worker falls back to the approved static catalog when live products are unavailable', /fallback_static_catalog/.test(worker) && /PRODUCT_CATALOG/.test(worker));
assert('frontend requests a live product catalog before ranking related products', /npLoadProductCatalog/.test(html) && /productCatalog:true/.test(html) && /npRankProducts/.test(html));
assert('frontend live catalog ranking ignores generic stopwords and boosts exact product-name matches', /NP_PRODUCT_RANK_STOPWORDS/.test(html) && /exactNameBoost/.test(html) && /phraseBoost/.test(html));
assert('frontend diversifies product candidates by brand before AI ranking', /npDiversifyProductCandidates/.test(html) && /seenBrands/.test(html) && /NP_PRODUCT_TAXONOMY/.test(html));
assert('frontend excludes non-ingestible body-care products from nutrition result rails', /npIsNonIngestibleProduct/.test(html) && /conditioner\|shampoo\|sun balm/.test(html) && /hair complex\|hair skin nails\|keratin/.test(html) && /filter\(function\(p\)\{return !npIsNonIngestibleProduct\(p,goal\);\}\)/.test(html));
assert('frontend boosts gut-immune product candidates for immune searches', /immune\|immunity\|cold\|flu\|seasonal/.test(html) && /probiotic/.test(html) && /postbiotic/.test(html) && /glutamine/.test(html));
assert('frontend sends a broader live product candidate set to AI for brand diversity', /npProductsForGoal\(input,24\)/.test(html));
assert('frontend still has static products as a fallback if live catalog fetch fails', /npStaticProducts/.test(html) && /P\.slice\(\)/.test(html));
assert('AI requests use the current live product list when available', /await npProductsForGoal\(input,24\)/.test(html) && /products:localProducts/.test(html));
assert('wrangler config points live product feed at NutraPass Shopify domain', /SHOPIFY_STORE_DOMAIN\s*=\s*"nutrapass\.club"/.test(wrangler) && /SHOPIFY_PRODUCTS_LIMIT/.test(wrangler));
assert('worker uses an origin allowlist instead of wildcard CORS', /ALLOWED_ORIGINS_DEFAULT/.test(worker) && /function pickOrigin/.test(worker) && !/Access-Control-Allow-Origin':\s*'\*'/.test(worker));
assert('worker guards oversized request bodies before parsing JSON', /MAX_BODY_BYTES/.test(worker) && /Request too large/.test(worker));
assert('worker has optional Turnstile verification gated by secret presence', /verifyTurnstile/.test(worker) && /TURNSTILE_SECRET_KEY/.test(worker) && /turnstileToken/.test(worker));
assert('worker accepts the larger diversified product candidate set', /body\.products\)\s*\?\s*body\.products\.slice\(0,\s*24\)/.test(worker));
assert('package includes a helper script for the Shopify Storefront token secret', pkg.scripts && /SHOPIFY_STOREFRONT_ACCESS_TOKEN/.test(pkg.scripts['secret:shopify'] || ''));
assert('wrangler config binds a KV namespace for cached product catalog', /kv_namespaces/.test(wrangler) && /binding\s*=\s*"PRODUCT_CATALOG_KV"/.test(wrangler));
assert('wrangler config does not schedule daily catalog sync cron', !/\[triggers\]/.test(wrangler) && !/crons\s*=/.test(wrangler));
assert('worker reads cached catalog before falling back to Shopify or static catalog', /readCachedProductCatalog/.test(worker) && /PRODUCT_CATALOG_KV\.get/.test(worker) && /mode:\s*'cached_shopify_catalog'/.test(worker));
assert('worker writes imported Shopify catalog to KV with sync metadata', /writeCachedProductCatalog/.test(worker) && /PRODUCT_CATALOG_KV\.put/.test(worker) && /lastSyncedAt/.test(worker));
assert('worker exposes a manual catalog refresh route for launch-day imports', /refreshProductCatalog/.test(worker) && /manual_refresh/.test(worker));
assert('worker uses common-intent templates only as a non-AI fallback or explicit override', /COMMON_INTENT_RESPONSES/.test(worker) && /classifyCommonIntent/.test(worker) && /shouldUseCommonFastPath/.test(worker) && /useCommonFallback/.test(worker) && /provider === 'fallback'/.test(worker) && /useCommonFastPath/.test(worker));
assert('worker caches common responses in KV using normalized intent keys', /COMMON_RESPONSE_CACHE_PREFIX/.test(worker) && /readCommonResponseCache/.test(worker) && /writeCommonResponseCache/.test(worker));
assert('worker keeps common-response product cards dynamic instead of freezing cached products', /freshResponse\s*=\s*buildCommonIntentResponse/.test(worker) && /writeCommonResponseCache\(env,\s*intent,\s*\{\s*\.\.\.freshResponse,\s*products:\s*\[\]\s*\}\)/.test(worker));
assert('worker common immunity template is detailed enough for top matches plus additional options', /ingredientTemplates/.test(worker) && /immune:\s*\[/.test(worker) && /Butyrate \/ postbiotics/.test(worker) && /Prebiotic fiber/.test(worker) && /Multivitamin support/.test(worker) && /COMMON_RESPONSE_CACHE_PREFIX\s*=\s*'nutrapass:common-response:v3:'/.test(worker));
assert('worker prioritizes immune product cards within common fast path', /prioritizeCommonIntentProducts/.test(worker) && /scoreCommonIntentProduct/.test(worker) && /postbiotic/.test(worker) && /hair complex\|hair skin nails\|keratin/.test(worker));
assert('worker records privacy-safe question analytics without raw user questions', /recordQuestionAnalytics/.test(worker) && /QUESTION_ANALYTICS_PREFIX/.test(worker) && /rawQuestion/.test(worker) === false && /goal\s*:\s*goal/.test(worker) === false);
assert('worker analytics track intent counts and response timing only', /cacheHit/.test(worker) && /aiUsed/.test(worker) && /avgResponseMs/.test(worker) && /lastSeenAt/.test(worker));
assert('worker exposes analytics summary only behind an optional read token', /question-analytics/.test(worker) && /getQuestionAnalyticsSummary/.test(worker) && /ANALYTICS_READ_TOKEN/.test(worker) && /storesRawQuestions:\s*false/.test(worker));
assert('test is included in npm test script', pkg.scripts && /live_product_feed_test\.js/.test(pkg.scripts.test || ''));

if (process.exitCode) process.exit(process.exitCode);
console.log('Live product feed checks passed.');
