const fs = require('fs');
const path = require('path');
const os = require('os');

const root = path.resolve(__dirname, '..');
const workerPath = path.join(root, 'api', 'nutrapass-worker.js');

function assert(name, condition) {
  if (!condition) {
    console.error(`FAIL: ${name}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${name}`);
  }
}

(async () => {
  const tempModule = path.join(os.tmpdir(), `nutrapass-worker-${Date.now()}.mjs`);
  fs.writeFileSync(tempModule, fs.readFileSync(workerPath, 'utf8'));
  const mod = await import(`file://${tempModule}`);
  const response = await mod.default.fetch(new Request('https://example.test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goal: 'I keep getting strong cravings to chew ice and dirt after night shifts, plus restless legs. What nutrition angles should I compare?',
      products: [],
      ingredients: []
    })
  }), {});
  const data = await response.json();
  const blob = JSON.stringify(data).toLowerCase();

  assert('unusual pica-style request uses fallback mode without configured AI keys', data.mode === 'fallback_no_ai_key');
  assert('pica-style request mentions iron or ferritin comparison', /iron|ferritin/.test(blob));
  assert('pica-style request includes professional-care/lab-test guidance', /professional|clinician|healthcare|lab|blood/.test(blob));
  assert('pica-style request is not misclassified as calf tension summary', !/calf tension|tight calves/.test(blob));

  fs.unlinkSync(tempModule);
  if (process.exitCode) process.exit(process.exitCode);
  console.log('All unusual request fallback checks passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
