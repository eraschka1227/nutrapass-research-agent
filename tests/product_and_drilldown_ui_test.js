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

assert('product cards render a brand label', /npProductBrand/.test(html) && /np-pbrand/.test(html));
assert('static products include actual vendor brands instead of NutraPass', /brand:'Silver Fern'/.test(html) && /brand:'Cellutrex'/.test(html) && !/brand:\s*p\.brand\|\|'NutraPass'/.test(html));
assert('product brand fallback does not mislabel products as NutraPass', /function npProductBrand\(p\)\{return \(p&&p\.brand\)\|\|'';\}/.test(html));
assert('product image placeholder is removed when no Shopify image is available', /npProductImage/.test(html) && /np-pimg/.test(html) && !/nutrapass-botanical-strip\.png/.test(html));
assert('frontend sends real brand and optional image metadata to AI worker', /brand:p\.brand\|\|''/.test(html) && /imageUrl:p\.img\|\|p\.imageUrl\|\|''/.test(html));
assert('worker asks providers to include actual product brand and optional image URL', /"brand":"Silver Fern"/.test(worker) && /"brand":"Cellutrex"/.test(worker) && /"imageUrl":""/.test(worker));
assert('ingredient drill-down renders list markup instead of card grid only', /np-type-list/.test(html) && /<ul class="np-type-list">/.test(html));
assert('ingredient drill-down includes multiple research links', /npResearchLinks/.test(html) && /PubMed search/.test(html) && /Google Scholar/.test(html));
assert('ingredient drill-down includes related product cards with Find Product links', /npRelatedProductsPanel/.test(html) && /npProductCards/.test(html) && /np-detail-products/.test(html) && /Related Products Available on NutraPass/.test(html) && /Find Product/.test(html));
assert('ingredient drill-down uses clinical long-form research list', /np-research-list/.test(html) && /np-source-row/.test(html) && /Clinical research links/.test(html) && /Direct citation/.test(html) && /Broader literature search/.test(html) && !/np-research-links">'\+links\.join\(''\)/.test(html));
assert('verbose drill-down helper sentence has been removed', !/Below are common researched forms, categories, or product types shoppers may see\. Use this as a comparison guide/.test(html));
assert('shorter drill-down helper copy is present', /Compare forms, fit, cautions, and source links before choosing\./.test(html));
assert('test is included in npm test script', pkg.scripts && /product_and_drilldown_ui_test\.js/.test(pkg.scripts.test || ''));

if (process.exitCode) process.exit(process.exitCode);
console.log('Product and drill-down UI checks passed.');
