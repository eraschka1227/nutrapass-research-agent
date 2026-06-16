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
assert('privacy and AI processing notice stays near input and full legal block, not duplicated in rendered results', /currentReportText/.test(html) && /NutraPass does not save your questions or generated reports on our servers/.test(html) && /sent to our AI provider/.test(html) && /aria-label="Educational disclaimer"/.test(html) && !/aria-label="Educational and AI use disclaimer"/.test(html));
assert('rendered results do not incorrectly claim AI reports are browser-only', !/generated in this browser from your wellness-goal text/.test(html));
assert('frontend does not persist reports or questions in browser storage', !/localStorage|sessionStorage/.test(html));

assert('worker defines no-store privacy headers', /function privacyHeaders/.test(worker) && /Cache-Control': 'no-store, no-cache, must-revalidate, private'/.test(worker) && /X-Content-Type-Options': 'nosniff'/.test(worker));
assert('worker applies privacy headers to JSON and health responses', /headers: \{ \.\.\.privacyHeaders\(origin\), 'Content-Type': 'application\/json' \}/.test(worker) && /headers: \{ \.\.\.privacyHeaders\(origin\), 'Content-Type': 'text\/html; charset=UTF-8' \}/.test(worker));
assert('worker OPTIONS also uses privacy headers', /method === 'OPTIONS'\) return new Response\(null, \{ headers: privacyHeaders\(allowOrigin\) \}\)/.test(worker));
assert('worker does not return raw provider error details to the browser', /AI provider unavailable; static educational fallback used\./.test(worker) && !/error: String\(error\)\.slice/.test(worker));
assert('worker source does not bind to NutraPass persistence services for user questions', !/\bKV_NAMESPACE\b|\bD1\b|\bR2\b|DurableObject|Analytics Engine|ctx\.waitUntil\([^)]*log/i.test(worker));
assert('worker prompt has hard privacy data-collection rule in system and follow-up prompts', /Privacy\/data-collection rule:[\s\S]*not collecting, selling, or saving personal data from this tool/.test(worker) && /Do not say NutraPass stores wellness goals, health overviews, account settings, personal profiles/.test(worker));
assert('worker routes privacy follow-up questions to static privacy policy answer before AI', /function asksAboutPrivacyOrData/.test(worker) && /privacyPolicyAnswerPayload/.test(worker) && /mode: 'privacy_policy_static', type: 'followup'/.test(worker));
assert('worker routes vulgar abusive or aggressively sexual questions to a fixed non-engagement response before AI', /DISALLOWED_QUESTION_RESPONSE = 'I can’t help with vulgar, abusive, or aggressively sexual questions\. NutraPass is here for respectful wellness and product research\.'/.test(worker) && /function asksVulgarAbusiveOrSexualQuestion/.test(worker) && /mode: 'content_safety_static'/.test(worker) && /aiUsed: false/.test(worker));
assert('worker routes cancer and clearly non-nutrition questions to no-results static responses before AI', /function asksAboutCancerOrSeriousTreatment/.test(worker) && /function asksClearlyNonNutritionQuestion/.test(worker) && /mode: 'medical_redirect_static'/.test(worker) && /mode: 'out_of_scope_static'/.test(worker));
assert('worker prompt tells AI no-results answers must omit ingredients and products', /No-results consistency rule:[\s\S]*do not provide ingredient results or related products[\s\S]*"noResults": true/.test(worker));
assert('worker content-safety response does not return products ingredients gaps or provider details', /function disallowedQuestionAnswerPayload\(\)[\s\S]*answer: DISALLOWED_QUESTION_RESPONSE,[\s\S]*gaps: \[\],[\s\S]*products: \[\],[\s\S]*noResults: true/.test(worker) && /function disallowedQuestionReportPayload\(\)[\s\S]*summary: DISALLOWED_QUESTION_RESPONSE,[\s\S]*nutritionOverview: '',[\s\S]*ingredientNotes: \[\],[\s\S]*products: \[\],[\s\S]*noResults: true/.test(worker));
assert('frontend suppresses fallback ingredient and product sections for no-results payloads', /var noResults=!!\(payload&&payload\.noResults\)/.test(html) && /if\(!ingredients\.length && !noResults && !hasIngredientResults\) ingredients=topNutrients/.test(html) && /if\(!products\.length && !noResults && !hasProductResults\) products=topProds/.test(html) && /var ingredientPanel=nuts\?/.test(html) && /var productPanel=cards\?/.test(html));
assert('worker static privacy answer does not claim saved goals or account profile data', /NutraPass does not save your questions, follow-up questions, or generated reports on our servers/.test(worker) && !/You can review or update your information anytime through your account/.test(worker));
assert('privacy safety test is included in npm test script', pkg.scripts && /privacy_safety_test\.js/.test(pkg.scripts.test || ''));

if (process.exitCode) process.exit(process.exitCode);
console.log('Privacy and safety checks passed.');
