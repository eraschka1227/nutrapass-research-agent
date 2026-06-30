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
    if (String(url).includes('/admin/oauth/access_token')) {
      const body = String(init.body || '');
      assert('Shopify token request uses client credentials grant', body.includes('grant_type=client_credentials') && body.includes('client_id=test-client-id') && body.includes('client_secret=test-client-secret'));
      return new Response(JSON.stringify({ access_token: 'generated_admin_token', expires_in: 86400, scope: 'write_customers' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
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
    SHOPIFY_ADMIN_STORE_DOMAIN: 'bf3gxy-cp.myshopify.com',
    SHOPIFY_ADMIN_CLIENT_ID: 'test-client-id',
    SHOPIFY_ADMIN_CLIENT_SECRET: 'test-client-secret'
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
  assert('Simplero webhook adds only the active tag', approvedJson.addedTags.length === 1 && approvedJson.addedTags[0] === 'active');
  assert('Shopify token endpoint was called', calls.some((call) => call.url.includes('/admin/oauth/access_token')));
  assert('Shopify Admin API search was called', calls.some((call) => call.url.includes('/admin/api/2025-10/customers/search.json') && call.init.headers['X-Shopify-Access-Token'] === 'generated_admin_token'));
  assert('Shopify Admin API create was called', calls.some((call) => call.url.includes('/admin/api/2025-10/customers.json') && call.init.method === 'POST' && call.init.headers['X-Shopify-Access-Token'] === 'generated_admin_token'));

  fs.unlinkSync(tempModule);
  if (process.exitCode) process.exit(process.exitCode);
  console.log('All Simplero → Shopify webhook checks passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
