const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const packagePath = path.join(root, 'package.json');

function assert(name, condition) {
  if (!condition) {
    console.error(`FAIL: ${name}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${name}`);
  }
}

const exists = fs.existsSync(packagePath);
assert('package.json exists for repeatable Worker deploy commands', exists);

let pkg = {};
if (exists) {
  pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
}

assert('package is private to avoid accidental npm publishing', pkg.private === true);
assert('package has wrangler dev script', pkg.scripts && pkg.scripts.dev === 'wrangler dev');
assert('package has wrangler deploy script', pkg.scripts && pkg.scripts.deploy === 'wrangler deploy');
assert('package has OpenAI secret helper', pkg.scripts && pkg.scripts['secret:openai'] === 'wrangler secret put OPENAI_API_KEY');
assert('package has Anthropic secret helper for Claude A/B tests', pkg.scripts && pkg.scripts['secret:anthropic'] === 'wrangler secret put ANTHROPIC_API_KEY');
assert('package has combined AI test script', pkg.scripts && /ai_integration_test\.js/.test(pkg.scripts.test || '') && /worker_deploy_config_test\.js/.test(pkg.scripts.test || ''));
assert('package pins secure wrangler 4.86+ as dev dependency', pkg.devDependencies && /^\^?4\.(8[6-9]|9\d|\d{3,})\./.test(pkg.devDependencies.wrangler || ''));
assert('package documents Node 22+ requirement for current Wrangler', pkg.engines && pkg.engines.node === '>=22.0.0');

if (process.exitCode) process.exit(process.exitCode);
console.log('All package deploy script checks passed.');
