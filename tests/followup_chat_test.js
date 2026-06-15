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

assert('frontend renders a follow-up questions panel after the report', /function npFollowupPanel\(\)/.test(html) && /Follow-up Questions/.test(html) && /np-follow-card/.test(html));
assert('follow-up panel preserves the original report state instead of replacing it', /function npReportContextForFollowup/.test(html) && /window\.npLastReport/.test(html) && /report:npReportContextForFollowup\(data\)/.test(html));
assert('follow-up action posts a followUpQuestion to the same backend endpoint', /window\.npAskFollowup\s*=\s*async\s*function/.test(html) && /followUpQuestion:q/.test(html) && /NUTRAPASS_AI_ENDPOINT/.test(html));
assert('follow-up chat has visible user and AI message bubbles', /np-follow-msg is-user/.test(html) && /np-follow-msg is-ai/.test(html) && /npRenderFollowupMessages/.test(html));
assert('follow-up answers can show one gap-filling question and right-side related products', /np-follow-gaps/.test(html) && /slice\(0,1\)/.test(html) && /np-follow-msg\.has-products/.test(html) && /aria-label="Related products from this report"/.test(html) && /npProductCards\(productItems\)/.test(html));
assert('follow-up font is larger and product cards are moved into a side rail', /\.np-follow-msg\{[^}]*font-size:\.94rem/.test(html) && /grid-template-columns:minmax\(0,1fr\) 230px/.test(html) && /\.np-follow-answer/.test(html));
assert('new first-question report clears prior follow-up chat', /window\.npLastReport=null;/.test(html));
assert('print output hides follow-up chat controls', /np-follow-card\{display:none!important\}/.test(html));
assert('worker defines follow-up prompt and strict JSON shape', /FOLLOW_UP_PROMPT/.test(worker) && /"answer"/.test(worker) && /"gaps"/.test(worker) && /type: 'followup'/.test(worker));
assert('follow-up prompt requests shared friendly upbeat personality and tight responses', /friendly, upbeat, reassuring NutraPass voice/.test(worker) && /nutrition research guide, not a clinician or hypey salesperson/.test(worker) && /55–110 words/.test(worker) && /Avoid wall-of-text responses/.test(worker));
assert('follow-up prompt mirrors evidence-tiering rules from original prompt', /Prioritize clinically backed ingredients and fundamentals first/.test(worker) && /Traditional, botanical, alternative, or emerging options are acceptable as comparison options/.test(worker) && /clearly label them as traditional, emerging, mixed-evidence, or situation-dependent/.test(worker));
assert('follow-up prompt limits gaps and gives off-catalog quality-label guidance', /at most one short gap-filling question/.test(worker) && /Leave gaps empty/.test(worker) && /transparent Supplement Facts panel/.test(worker) && /third-party testing or cGMP/.test(worker) && /Return an empty products array/.test(worker) && /asksAboutOffCatalogProduct/.test(worker) && /parsed\.products = \[\]/.test(worker));
assert('frontend formats follow-up text instead of rendering one escaped wall', /function npFormatFollowupText/.test(html) && /npFormatFollowupText\(t\.text\)/.test(html));
assert('worker routes follow-up requests without requiring a new goal report', /followUpQuestion/.test(worker) && /callClaudeFollowUp/.test(worker) && /callOpenAiFollowUp/.test(worker));
assert('worker follow-up fallback preserves context language', /staticFollowUpFallback/.test(worker) && /original NutraPass report/.test(worker));
assert('test is included in npm test script', pkg.scripts && /followup_chat_test\.js/.test(pkg.scripts.test || ''));

if (process.exitCode) process.exit(process.exitCode);
console.log('Follow-up chat checks passed.');
