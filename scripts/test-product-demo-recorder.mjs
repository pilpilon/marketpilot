import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = process.cwd();
const read = (p) => fs.readFileSync(`${root}/${p}`, 'utf8');
const exists = (p) => fs.existsSync(`${root}/${p}`);

assert.ok(exists('src/lib/video/product-demo-recorder.ts'), 'product-demo recorder module should exist');

const route = read('src/app/api/skills/video-creator/route.ts');
const worker = read('src/app/api/cron/process-video-jobs/route.ts');
const types = read('src/lib/video/types.ts');
const recorder = read('src/lib/video/product-demo-recorder.ts');
const page = read('src/app/(dashboard)/dashboard/[projectId]/skills/video-creator/page.tsx');

assert.match(types, /productDemoAccess\?:/, 'CreateVideoJobInput should accept product demo access details');
assert.match(types, /ProductDemoAccess/, 'video types should define product demo access contract');
assert.match(route, /productDemoAccess/, 'video creator API should read productDemoAccess from request body');
assert.match(route, /password[\s\S]*"\[redacted\]"/, 'API response/job metadata must not persist raw password in readable metadata');
assert.match(page, /demoUrl/, 'UI should collect a demo URL for product walkthrough recording');
assert.match(page, /demoEmail/, 'UI should collect demo login email');
assert.match(page, /demoPassword/, 'UI should collect demo login password');
assert.match(worker, /captureProductDemoFlows/, 'product_demo worker should try automatic browser flow capture');
assert.match(worker, /fallbackScreenshots/, 'worker should preserve screenshot fallback if recorder cannot access the app');
assert.match(recorder, /puppeteer/, 'recorder should use Puppeteer browser automation');
assert.match(recorder, /page\.mouse\.move/, 'recorder should move the cursor during feature flows');
assert.match(recorder, /page\.screenshot/, 'recorder should capture screenshots during flows');
assert.match(recorder, /invoice|supplier|inventory/i, 'recorder should include the three core BestRest-style feature flow intents');

console.log('product-demo-recorder checks passed');
