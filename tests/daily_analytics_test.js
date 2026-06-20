const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const worker = fs.readFileSync(path.join(root, 'api', 'nutrapass-worker.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

function assert(name, condition) {
  if (!condition) {
    console.error(`FAIL: ${name}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${name}`);
  }
}

assert('worker declares daily analytics KV prefix', /DAILY_ANALYTICS_PREFIX\s*=\s*'nutrapass:analytics:daily:v1:'/.test(worker));
assert('worker records daily analytics buckets without raw questions', /recordDailyAnalytics/.test(worker) && /dailyKey/.test(worker) && !/rawQuestion/.test(worker) && !/questionText/.test(worker));
assert('daily analytics tracks research, followup, clinical, ai, cache, error, and intent counts', /researchSearches/.test(worker) && /followupQuestions/.test(worker) && /clinicalLookups/.test(worker) && /aiUses/.test(worker) && /cacheHits/.test(worker) && /errors/.test(worker) && /intents/.test(worker));
assert('analytics summary returns today, last7Days, and last30Days rollups', /today/.test(worker) && /last7Days/.test(worker) && /last30Days/.test(worker) && /rollupDailyAnalytics/.test(worker));
assert('analytics summary explicitly remains privacy safe', /storesRawQuestions:\s*false/.test(worker) && /dailyAnalytics/.test(worker));
assert('research requests record daily analytics', /kind:\s*'research'/.test(worker) && /trackDaily\(ctx, env, \{[\s\S]*kind:\s*'research'/.test(worker));
assert('follow-up requests record daily analytics', /kind:\s*'followup'/.test(worker) && /trackDaily\(ctx, env, \{[\s\S]*kind:\s*'followup'/.test(worker));
assert('clinical lookups record daily analytics', /kind:\s*'clinical'/.test(worker) && /trackDaily\(ctx, env, \{[\s\S]*kind:\s*'clinical'/.test(worker));
assert('daily analytics test is included in npm test script', /daily_analytics_test\.js/.test(pkg.scripts.test || ''));

if (process.exitCode) process.exit(process.exitCode);
console.log('Daily analytics checks passed.');
