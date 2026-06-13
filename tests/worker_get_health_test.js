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
  const tempModule = path.join(os.tmpdir(), `nutrapass-worker-health-${Date.now()}.mjs`);
  fs.writeFileSync(tempModule, fs.readFileSync(workerPath, 'utf8'));
  const mod = await import(`file://${tempModule}`);
  const response = await mod.default.fetch(new Request('https://example.test', { method: 'GET' }), {});
  const text = await response.text();

  assert('GET health page returns 200', response.status === 200);
  assert('GET health page is HTML', response.headers.get('Content-Type') && response.headers.get('Content-Type').includes('text/html'));
  assert('GET health page says NutraPass AI Worker', text.includes('NutraPass AI Worker'));
  assert('GET health page tells users it expects POST', /POST/i.test(text) && /endpoint/i.test(text));

  fs.unlinkSync(tempModule);
  if (process.exitCode) process.exit(process.exitCode);
  console.log('All Worker GET health checks passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
