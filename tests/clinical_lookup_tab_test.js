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

assert('clinical research lookup tab is present', /Clinical Research Lookup/.test(html) && /npPanelClinical/.test(html) && /npTabClinical/.test(html));
assert('tab switcher hides and shows panels', /window\.npSwitchTab/.test(html) && /aria-selected/.test(html) && /panelClinical\.hidden=guidance/.test(html));
assert('clinical lookup has ingredient input and common lookup chips', /id="npClinicalIn"/.test(html) && /npSetClinical\('Magnesium'\)/.test(html) && /npSetClinical\('Berberine'\)/.test(html));
assert('clinical lookup renders summary and many evidence links', /function npClinicalLinks/.test(html) && /PubMed review search/.test(html) && /ClinicalTrials\.gov/.test(html) && /Google Scholar/.test(html) && /Examine/.test(html));
assert('NIH ODS fact-sheet links are included for common nutrients', /function npOdsUrl/.test(html) && /VitaminD-Consumer/.test(html) && /Magnesium-Consumer/.test(html));
assert('frontend sends clinicalLookup request to worker', /JSON\.stringify\(\{clinicalLookup:term\}\)/.test(html));
assert('worker supports clinical lookup route', /clinicalLookup/.test(worker) && /staticClinicalLookupFallback/.test(worker));
assert('worker has clinical lookup prompt and provider calls', /CLINICAL_LOOKUP_PROMPT/.test(worker) && /callOpenAiClinicalLookup/.test(worker) && /callClaudeClinicalLookup/.test(worker));
assert('clinical prompt blocks medical claims and fake citations', /Do not diagnose, treat, cure, mitigate, prevent, reverse, fix, or heal/.test(worker) && /Do not invent PubMed IDs/.test(worker));
assert('mobile portrait keeps clinical/result columns single-width', /host page has a side menu/.test(html) && /orientation:portrait\) and \(max-width:1024px\)/.test(html) && /\.np-lookup-grid,\s*\.np-follow-msg\.has-products/s.test(html) && /\.np-research-side\{\s*display:none!important;/s.test(html) && /\.np-tab\{\s*flex:1 1 100%;/s.test(html));
assert('NutraPass header avoids redundant research/health pills', !/Health Tool \+ Product Finder/.test(html) && /Evidence Support • Not Medical Advice/.test(html) && !/Research Support • Not Medical Advice/.test(html));
assert('test is included in npm test script', pkg.scripts && /clinical_lookup_tab_test\.js/.test(pkg.scripts.test || ''));

if (process.exitCode) process.exit(process.exitCode);
console.log('Clinical lookup tab checks passed.');
