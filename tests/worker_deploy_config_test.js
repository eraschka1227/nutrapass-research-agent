const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const wranglerPath = path.join(root, 'wrangler.toml');
const readmePath = path.join(root, 'AI_SETUP.md');

function assert(name, condition) {
  if (!condition) {
    console.error(`FAIL: ${name}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${name}`);
  }
}

const wrangler = fs.existsSync(wranglerPath) ? fs.readFileSync(wranglerPath, 'utf8') : '';
const readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf8') : '';

assert('wrangler.toml exists', fs.existsSync(wranglerPath));
assert('wrangler points to NutraPass worker entry', /main\s*=\s*"api\/nutrapass-worker\.js"/.test(wrangler));
assert('wrangler uses compatibility date', /compatibility_date\s*=/.test(wrangler));
assert('wrangler selects Claude as the primary AI provider', /AI_PROVIDER\s*=\s*"claude"/.test(wrangler));
assert('wrangler defines default Claude model', /ANTHROPIC_MODEL\s*=\s*"claude/.test(wrangler));
assert('setup guide documents Anthropic Claude secret', readme.includes('wrangler secret put ANTHROPIC_API_KEY'));
assert('setup guide documents OpenAI secret', readme.includes('wrangler secret put OPENAI_API_KEY'));
assert('setup guide documents frontend endpoint override', readme.includes('window.NUTRAPASS_AI_ENDPOINT'));
assert('setup guide documents safe fallback behavior', /fallback/i.test(readme) && /static/i.test(readme));
assert('setup guide documents npm install', readme.includes('npm install'));
assert('setup guide documents Node 22 requirement', /Node\.js\s+22/i.test(readme));
assert('setup guide documents npm deploy script', readme.includes('npm run deploy'));

if (process.exitCode) process.exit(process.exitCode);
console.log('All Worker deployment config checks passed.');
