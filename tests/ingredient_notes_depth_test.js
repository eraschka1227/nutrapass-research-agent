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

assert('worker prompt requires 10–12 ingredient notes', /10[–-]12 ingredient notes/i.test(worker));
assert('worker prompt separates strongest matches from additional comparison options', /Top Matches/i.test(worker) && /Additional Options to Compare/i.test(worker));
assert('worker prompt asks for 2–3 sentence research context', /2[–-]3 sentence research context/i.test(worker));
assert('worker accepts at least 20 approved ingredients from frontend', /body\.ingredients\) \? body\.ingredients\.slice\(0, 20\)/.test(worker));
assert('frontend sends top 20 candidate ingredients to AI', /topNutrients\(input,20\)/.test(html));
assert('frontend renders Top Matches section', /Top Matches/.test(html));
assert('frontend renders Additional Options to Compare section', /Additional Options to Compare/.test(html));
assert('frontend removes redundant Ingredient Research Notes wrapper', !/Ingredient Research Notes/.test(html));
assert('ingredient note bestFit copy does not repeat section rank labels', !/bestFit:\s*['"]Top Match:/i.test(worker) && !/bestFit:\s*['"]Additional Option to Compare:/i.test(worker) && !/\$\{idx < 6 \? 'Top Match' : 'Additional Option to Compare'\}:/.test(worker));
assert('worker prompt examples omit per-card rank labels in bestFit', !/"bestFit":"Top Match:/i.test(worker) && !/"bestFit":"Additional Option to Compare:/i.test(worker));
assert('Joint Complex is treated as product or category, not ingredient note', /Joint Complex/.test(worker) && /function\s+npNormalizeIngredientName/.test(html) && /Joint support nutrients/.test(html) && /Joint Complex/.test(html));
assert('test is included in npm test script', pkg.scripts && /ingredient_notes_depth_test\.js/.test(pkg.scripts.test || ''));

if (process.exitCode) process.exit(process.exitCode);
console.log('Ingredient note depth checks passed.');
