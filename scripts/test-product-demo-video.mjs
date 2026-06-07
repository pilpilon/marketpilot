import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = process.cwd();
const read = (p) => fs.readFileSync(`${root}/${p}`, 'utf8');

const worker = read('src/app/api/cron/process-video-jobs/route.ts');
const sceneClip = read('src/remotion/components/SceneClip.tsx');
const composition = read('src/remotion/VideoComposition.tsx');
const types = read('src/lib/video/types.ts');
const productDemoStage = worker.match(/async function stageProductDemoWalkthrough[\s\S]*?\/\/ ── Stage: Scene generation/)?.[0] || '';

assert.match(worker, /stageProductDemoWalkthrough/, 'product_demo jobs should use a dedicated walkthrough stage, not the Veo scene pipeline');
assert.match(worker, /template \|\| "product_demo"[\s\S]*stageProductDemoWalkthrough/, 'product_demo should branch into the walkthrough stage during planning');
assert.match(productDemoStage, /project_screenshots[\s\S]*screenshot_type[\s\S]*product/i, 'product demo should load approved product screenshots');
assert.doesNotMatch(productDemoStage, /startSceneGeneration/, 'product_demo walkthrough stage should not start Veo scene generation');
assert.match(productDemoStage, /status: "composing"/, 'product_demo should jump straight to Remotion composition');
assert.match(sceneClip, /imageUrl/, 'Remotion scene clip should support screenshot/image scenes');
assert.match(composition, /scene\.imageUrl/, 'VideoComposition should pass screenshot imageUrl scenes into SceneClip');
assert.match(types, /imageUrl\?: string/, 'VideoScene should store screenshot imageUrl for product demo scenes');

console.log('product-demo-video checks passed');
