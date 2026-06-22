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
  const tempModule = path.join(os.tmpdir(), `nutrapass-worker-simplero-${Date.now()}.mjs`);
  fs.writeFileSync(tempModule, fs.readFileSync(workerPath, 'utf8'));
  const mod = await import(`file://${tempModule}`);

  const calls = [];
  global.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('/customers/search.json')) {
      return new Response(JSON.stringify({ customers: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (String(url).includes('/customers.json') && init.method === 'POST') {
      return new Response(JSON.stringify({ customer: { id: 12345 } }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: 'unexpected call' }), { status: 500 });
  };

  const env = {
    SIMPLERO_WEBHOOK_SECRET: 'test-secret',
    SHOPIFY_STORE_DOMAIN: 'nutrapass.club',
    SHOPIFY_ADMIN_ACCESS_TOKEN: 'shpat_test'
  };

  const denied = await mod.default.fetch(new Request('https://example.test/simplero-webhook', {
    method: 'POST',
    body: JSON.stringify({ contact: { email: 'member@example.com' } })
  }), env);
  assert('Simplero webhook rejects missing secret', denied.status === 404);

  const approved = await mod.default.fetch(new Request('https://example.test/simplero-webhook?action=subscribed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-NutraPass-Webhook-Secret': 'test-secret' },
    body: JSON.stringify({ contact: { email: 'Member@Example.com', first_name: 'Mina', last_name: 'Mint' } })
  }), env);
  const approvedJson = await approved.json();

  assert('Simplero webhook returns success', approved.status === 200 && approvedJson.ok === true);
  assert('Simplero webhook normalizes email', approvedJson.email === 'member@example.com');
  assert('Simplero webhook creates customer when missing', approvedJson.action === 'created' && approvedJson.customerId === 12345);
  assert('Simplero webhook adds paid subscriber tags', approvedJson.addedTags.includes('nutrapass') && approvedJson.addedTags.includes('approved') && approvedJson.addedTags.includes('paid subscriber'));
  assert('Shopify Admin API search was called', calls.some((call) => call.url.includes('/admin/api/2025-10/customers/search.json')));
  assert('Shopify Admin API create was called', calls.some((call) => call.url.includes('/admin/api/2025-10/customers.json') && call.init.method === 'POST'));

  fs.unlinkSync(tempModule);
  if (process.exitCode) process.exit(process.exitCode);
  console.log('All Simplero → Shopify webhook checks passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
