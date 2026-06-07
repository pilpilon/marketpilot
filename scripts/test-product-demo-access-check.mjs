import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = process.cwd();
const read = (p) => fs.readFileSync(`${root}/${p}`, 'utf8');
const exists = (p) => fs.existsSync(`${root}/${p}`);

assert.ok(
  exists('src/app/api/skills/video-creator/test-access/route.ts'),
  'preflight test-access API route should exist'
);

const route = read('src/app/api/skills/video-creator/test-access/route.ts');
const recorder = read('src/lib/video/product-demo-recorder.ts');
const page = read('src/app/(dashboard)/dashboard/[projectId]/skills/video-creator/page.tsx');
const en = read('src/messages/en.json');
const he = read('src/messages/he.json');

assert.match(recorder, /verifyProductDemoAccess/, 'recorder should expose a login/access verifier');
assert.match(route, /verifyProductDemoAccess/, 'test-access route should call the verifier');
assert.match(route, /demoPassword/, 'test-access route should accept the demo password for one-time verification');
assert.doesNotMatch(route, /encryptSecret|pipeline_jobs|campaigns/, 'test-access must not create jobs or store credentials');
assert.match(page, /handleTestAccess/, 'UI should provide a pre-generate access test action');
assert.match(page, /testAccessStatus/, 'UI should show access test status before generate');
assert.match(page, /testDemoAccess/, 'UI should render a Test access button');
assert.match(page, /accessTestPassed/, 'UI should show a successful access test result');
assert.match(page, /accessTestFailed/, 'UI should show a failed access test result');
assert.match(en, /testDemoAccess/, 'English copy should include Test access');
assert.match(he, /testDemoAccess/, 'Hebrew copy should include Test access');

console.log('product-demo-access preflight checks passed');
