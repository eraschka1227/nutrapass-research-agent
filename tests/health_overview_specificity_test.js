const fs = require('fs');
const path = require('path');
const os = require('os');

const root = path.resolve(__dirname, '..');
const workerPath = path.join(root, 'api', 'nutrapass-worker.js');
const indexPath = path.join(root, 'index.html');

function assert(name, condition) {
  if (!condition) {
    console.error(`FAIL: ${name}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${name}`);
  }
}

async function workerFallback(goal) {
  const tempModule = path.join(os.tmpdir(), `nutrapass-worker-${Date.now()}-${Math.random().toString(16).slice(2)}.mjs`);
  fs.writeFileSync(tempModule, fs.readFileSync(workerPath, 'utf8'));
  try {
    const mod = await import(`file://${tempModule}`);
    const response = await mod.default.fetch(new Request('https://example.test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal, products: [], ingredients: [] })
    }), {});
    return response.json();
  } finally {
    fs.unlinkSync(tempModule);
  }
}

(async () => {
  const reflux = await workerFallback('I get heartburn and acid reflux after big dinners. What nutrition angles should I compare?');
  const refluxOverview = String(reflux.nutritionOverview || '').toLowerCase();
  assert('reflux fallback uses Health Overview wording, not Potential causes', refluxOverview.startsWith('what may be going on:') && !refluxOverview.includes('potential causes'));
  assert('reflux fallback gives issue-specific explanation', /meal|late-night|caffeine|spicy|upper-digestive|reflux/.test(refluxOverview));
  assert('reflux fallback does not use generic wellness concerns filler', !refluxOverview.includes('wellness concerns may be influenced'));

  const bloat = await workerFallback('I feel bloated and gassy after meals, especially with onions and dairy.');
  const bloatBlob = JSON.stringify(bloat).toLowerCase();
  assert('bloat fallback routes to bloat/gas-specific content', /bloat|gas|fodmap|dairy|digestive enzymes|probiotics/.test(bloatBlob));

  const vague = await workerFallback('I want to feel better.');
  const vagueBlob = JSON.stringify(vague).toLowerCase();
  assert('vague fallback asks one clarifying question instead of category-mismatch filler', vagueBlob.includes('what is the main thing') && !vagueBlob.includes('does not match one narrow category') && !vagueBlob.includes('broad wellness drivers'));

  const worker = fs.readFileSync(workerPath, 'utf8');
  assert('AI prompts forbid category-routing language and generic wellness dumps', /Never tell the user their question does not match a category/.test(worker) && /Never expose internal routing/.test(worker) && /meal quality, protein, fiber, hydration, sleep, stress, movement, nutrient gaps/.test(worker));
  assert('original and follow-up prompts share the same NutraPass personality language', (worker.match(/friendly, upbeat, reassuring NutraPass voice/g) || []).length >= 2 && (worker.match(/nutrition research guide, not a clinician or hypey salesperson/g) || []).length >= 2);
  assert('original and follow-up prompts prioritize clinically backed options while allowing labeled traditional alternatives', (worker.match(/Prioritize clinically backed ingredients and fundamentals first/g) || []).length >= 2 && (worker.match(/traditional, emerging, mixed-evidence, or situation-dependent/g) || []).length >= 2 && /Do not present traditional or alternative options as equally proven/.test(worker));
  assert('worker detects and retries generic AI overview filler', /hasGenericWellnessFiller/.test(worker) && /rewriteGenericWellnessAnswer/.test(worker) && /broad wellness drivers/.test(worker));

  const index = fs.readFileSync(indexPath, 'utf8');
  const nutrientMatches = index.match(/\{nm:'/g) || [];
  assert('browser nutrient pool has at least 45 entries', nutrientMatches.length >= 45);
  assert('AI request sends expanded ingredient context', index.includes('topNutrients(input,20)'));

  if (process.exitCode) process.exit(process.exitCode);
  console.log('All health overview specificity checks passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
