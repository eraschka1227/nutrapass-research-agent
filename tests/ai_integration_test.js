const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const workerPath = path.join(root, 'api', 'nutrapass-worker.js');
const html = fs.readFileSync(htmlPath, 'utf8');
const worker = fs.existsSync(workerPath) ? fs.readFileSync(workerPath, 'utf8') : '';

function assert(name, condition) {
  if (!condition) {
    console.error(`FAIL: ${name}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${name}`);
  }
}

assert('frontend defines configurable AI endpoint', html.includes('window.NUTRAPASS_AI_ENDPOINT'));
assert('npAsk supports async backend request', /window\.npAsk\s*=\s*async\s*function/.test(html));
assert('frontend has consumer-friendly loading state', html.includes('Building your NutraPass response'));
assert('loading state includes animated cute heart progress UI', /@keyframes\s+npHeartbeat/.test(html) && /class=\"np-loader-heart/.test(html) && /♥/.test(html) && /aria-label=\"NutraPass heart loading animation\"/.test(html));
assert('Explore button has warm loading animation and loading label state', /\.np-btn\.is-loading/.test(html) && /@keyframes\s+npBtnGradientWave/.test(html) && /@keyframes\s+npBtnShimmer/.test(html) && /function\s+npSetExploreBusy/.test(html) && /btn\.innerHTML='<span class="np-btn-label">Loading<\/span>'/.test(html) && /finally\{\s*npSetExploreBusy\(false\);\s*\}/.test(html));
assert('frontend jumps to results after rendering', /function\s+npJumpToResults/.test(html) && /scrollIntoView\(\{behavior:'smooth',block:'start'\}\)/.test(html) && /npJumpToResults\(out\)/.test(html));
assert('frontend can render backend response payload', html.includes('renderAiResponse'));
assert('frontend retains static fallback', html.includes('npStaticAsk') && html.includes('topNutrients(input,16)'));
assert('backend worker file exists', fs.existsSync(workerPath));
assert('backend calls OpenAI responses/chat API without exposing key to browser', /api\.openai\.com/.test(worker) && /OPENAI_API_KEY/.test(worker));
assert('backend can call Anthropic Claude Messages API for A/B testing', /api\.anthropic\.com\/v1\/messages/.test(worker) && /ANTHROPIC_API_KEY/.test(worker));
assert('backend exposes provider selection for openai/claude/ab variants', worker.includes('selectAiProvider') && worker.includes("return 'claude'") && worker.includes("return 'openai'") && worker.includes("return Math.random() < 0.5"));
assert('backend contains compliance guardrails', worker.includes('not medical advice') && worker.includes('not intended to diagnose, treat, cure, or prevent any disease'));
assert('backend returns JSON response for page', worker.includes('nutritionOverview') && worker.includes('ingredientNotes') && worker.includes('products'));

if (process.exitCode) process.exit(process.exitCode);
console.log('All AI integration checks passed.');
