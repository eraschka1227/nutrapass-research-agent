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

async function workerFallback(goal, extraBody = {}) {
  const tempModule = path.join(os.tmpdir(), `nutrapass-worker-${Date.now()}-${Math.random().toString(16).slice(2)}.mjs`);
  fs.writeFileSync(tempModule, fs.readFileSync(workerPath, 'utf8'));
  try {
    const mod = await import(`file://${tempModule}`);
    const response = await mod.default.fetch(new Request('https://example.test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal, products: [], ingredients: [], ...extraBody })
    }), {});
    return response.json();
  } finally {
    fs.unlinkSync(tempModule);
  }
}

(async () => {
  const reflux = await workerFallback('I get heartburn and acid reflux after big dinners. What nutrition angles should I compare?');
  const refluxOverview = String(reflux.nutritionOverview || '').toLowerCase();
  assert('reflux fallback uses Nutritional Key Points wording, not Potential causes', refluxOverview.startsWith('nutritional key points:') && !refluxOverview.includes('potential causes'));
  assert('reflux fallback gives issue-specific explanation', /meal|late-night|caffeine|spicy|upper-digestive|reflux/.test(refluxOverview));
  assert('reflux fallback does not use generic wellness concerns filler', !refluxOverview.includes('wellness concerns may be influenced'));

  const bloat = await workerFallback('I feel bloated and gassy after meals, especially with onions and dairy.');
  const bloatBlob = JSON.stringify(bloat).toLowerCase();
  assert('bloat fallback routes to bloat/gas-specific content', /bloat|gas|fodmap|dairy|digestive enzymes|probiotics/.test(bloatBlob));

  const vague = await workerFallback('I want to feel better.');
  const vagueBlob = JSON.stringify(vague).toLowerCase();
  assert('fully vague fallback asks one clarifying question instead of category-mismatch filler', vagueBlob.includes('what is the main thing') && vagueBlob.includes('joint/mobility') && !vagueBlob.includes('does not match one narrow category') && !vagueBlob.includes('broad wellness drivers'));

  const shoulder = await workerFallback('My shoulder is crunchy and painful.');
  const shoulderOverview = String(shoulder.nutritionOverview || '').toLowerCase();
  const shoulderBlob = JSON.stringify(shoulder).toLowerCase();
  assert('vague physical clue routes to joint/mobility overview instead of broad category punt', shoulderOverview.startsWith('nutritional key points:') && /shoulder|joint|tendon|mobility|range of motion/.test(shoulderOverview) && !shoulderOverview.includes('what is the main thing you want help comparing'));
  assert('joint/mobility fallback gives relevant ingredients and products', /collagen|omega-3|curcumin|glucosamine|magnesium/.test(shoulderBlob) && /joint complex|joint comfort|mobility/.test(shoulderBlob));
  assert('Nutritional Key Points no longer includes Nutrition options to compare section', !shoulderOverview.includes('nutrition options to compare') && !String(reflux.nutritionOverview || '').toLowerCase().includes('nutrition options to compare'));

  const menopauseSleep = await workerFallback('I am struggling with sleep and menopause. What nutrition options should I compare?');
  const menopauseOverview = String(menopauseSleep.nutritionOverview || '').toLowerCase();
  const menopauseNotes = JSON.stringify(menopauseSleep.ingredientNotes || []).toLowerCase();
  assert('menopause sleep fallback includes a what-may-be-going-on nutritional key points', menopauseOverview.startsWith('nutritional key points:') && /menopause|perimenopause|hot flashes|night sweats|hormone/.test(menopauseOverview));
  assert('menopause sleep fallback prioritizes clinically backed ingredients while allowing traditional options', /magnesium|l-theanine|glycine/.test(menopauseNotes) && /black cohosh|saffron|soy isoflavones|red clover/.test(menopauseNotes));

  const commonImmune = await workerFallback('I want to support my immune system naturally', { useCommonFastPath: true });
  const commonImmuneOverview = String(commonImmune.nutritionOverview || '').toLowerCase();
  assert('common fast-path immunity overview uses full Nutritional Key Points shape', commonImmune.mode === 'common_template_cached' && commonImmuneOverview.startsWith('nutritional key points:') && commonImmuneOverview.includes('food first:') && commonImmuneOverview.includes('easy things to try:'));
  assert('common fast-path immunity overview is richer than old short supplement disclaimer', /sleep quality|stress load|vitamin d status|protein intake|gut health|seasonal exposure/.test(commonImmuneOverview) && commonImmuneOverview.length > 450);

  const commonSleep = await workerFallback('I need help with sleep and stress support', { useCommonFastPath: true });
  const commonSleepOverview = String(commonSleep.nutritionOverview || '').toLowerCase();
  assert('common fast-path sleep/stress overview uses full Nutritional Key Points shape', commonSleep.mode === 'common_template_cached' && commonSleepOverview.startsWith('nutritional key points:') && commonSleepOverview.includes('food first:') && commonSleepOverview.includes('easy things to try:'));

  const worker = fs.readFileSync(workerPath, 'utf8');
  assert('common response cache version is bumped after preloaded mechanism upgrade', worker.includes("COMMON_RESPONSE_CACHE_PREFIX = 'nutrapass:common-response:v5:'"));
  assert('AI prompts forbid category-routing language and generic wellness dumps', /Never tell the user their question does not match a category/.test(worker) && /Never expose internal routing/.test(worker) && /meal quality, protein, fiber, hydration, sleep, stress, movement, nutrient gaps/.test(worker));
  assert('AI prompts require friendly upbeat tone and evidence-tiered ingredient framing', /friendly, upbeat, and reassuring/.test(worker) && /Prioritize clinically backed ingredients/.test(worker) && /traditional or alternative options/.test(worker));
  assert('Black Cohosh lookup prompt is balanced rather than reflexively negative', /Black cohosh/.test(worker) && /balanced, not dismissive/.test(worker));
  assert('worker detects and retries generic AI overview filler', /hasGenericWellnessFiller/.test(worker) && /rewriteGenericWellnessAnswer/.test(worker) && /broad wellness drivers/.test(worker));

  const index = fs.readFileSync(indexPath, 'utf8');
  const nutrientMatches = index.match(/\{nm:'/g) || [];
  assert('browser nutrient pool has at least 45 entries', nutrientMatches.length >= 45);
  assert('AI request sends expanded ingredient context', index.includes('topNutrients(input,20)'));

  if (process.exitCode) process.exit(process.exitCode);
  console.log('All nutritional key points specificity checks passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
