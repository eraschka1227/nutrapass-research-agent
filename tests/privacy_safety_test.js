const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
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

assert('frontend has a visible privacy and AI processing notice near input', /np-privacy-note/.test(html) && /NutraPass does not save your questions or generated reports on our servers/.test(html) && /AI provider/.test(html));
assert('frontend clearly says NutraPass will not collect sell or save personal data from the tool', /NutraPass will not collect, sell, or save your personal data from this tool/.test(html));
assert('frontend tells users not to enter identifiers or highly sensitive medical details', /avoid entering names, contact details, account numbers, or highly sensitive medical details/i.test(html));
assert('frontend includes emergency or professional care safety language', /severe, urgent, or rapidly worsening/i.test(html) && /professional medical care/i.test(html));
assert('frontend includes fuller privacy and safety disclaimer block', /np-legal/.test(html) && /No personal-data collection/.test(html) && /without database, file, or browser local-storage saving/.test(html));
assert('copied, emailed, and rendered report text include privacy and AI processing notice', /currentReportText/.test(html) && /NutraPass does not save your questions or generated reports on our servers/.test(html) && /sent to our AI provider/.test(html) && /sent securely to our AI provider/.test(html));
assert('rendered results do not incorrectly claim AI reports are browser-only', !/generated in this browser from your wellness-goal text/.test(html));
assert('frontend does not persist reports or questions in browser storage', !/localStorage|sessionStorage/.test(html));

assert('worker defines no-store privacy headers', /const privacyHeaders/.test(worker) && /Cache-Control': 'no-store, no-cache, must-revalidate, private'/.test(worker) && /X-Content-Type-Options': 'nosniff'/.test(worker));
assert('worker applies privacy headers to JSON and health responses', /headers: \{ \.\.\.privacyHeaders, 'Content-Type': 'application\/json' \}/.test(worker) && /headers: \{ \.\.\.privacyHeaders, 'Content-Type': 'text\/html; charset=UTF-8' \}/.test(worker));
assert('worker OPTIONS also uses privacy headers', /method === 'OPTIONS'\) return new Response\(null, \{ headers: privacyHeaders \}\)/.test(worker));
assert('worker does not return raw provider error details to the browser', /AI provider unavailable; static educational fallback used\./.test(worker) && !/error: String\(error\)\.slice/.test(worker));
assert('worker source does not bind to NutraPass persistence services for user questions', !/\bKV_NAMESPACE\b|\bD1\b|\bR2\b|DurableObject|Analytics Engine|ctx\.waitUntil\([^)]*log/i.test(worker));
assert('privacy safety test is included in npm test script', pkg.scripts && /privacy_safety_test\.js/.test(pkg.scripts.test || ''));

if (process.exitCode) process.exit(process.exitCode);
console.log('Privacy and safety checks passed.');
