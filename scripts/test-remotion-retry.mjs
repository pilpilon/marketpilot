import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = process.cwd();
const read = (p) => fs.readFileSync(`${root}/${p}`, 'utf8');

const composer = read('src/lib/video/composer.ts');
const worker = read('src/app/api/cron/process-video-jobs/route.ts');

assert.match(composer, /VIDEO_FRAMES_PER_LAMBDA \|\| "480"/, 'Remotion default framesPerLambda should be conservative to reduce AWS Lambda fan-out');
assert.match(composer, /isRetryableComposerError/, 'composer should expose retryable error classifier');
assert.match(composer, /Rate Exceeded|Concurrency limit|TooManyRequests|Throttl/i, 'retry classifier should include AWS/Remotion rate-limit words');
assert.match(worker, /compositionAttempts/, 'worker metadata should track composition retry attempts');
assert.match(worker, /composerRetryAt/, 'worker should defer retry until a backoff timestamp');
assert.match(worker, /Math\.pow\(2, attempt/, 'worker should use exponential backoff');
assert.match(worker, /delete nextMeta\.composerHandle/, 'worker should clear failed Remotion handles before retrying');
assert.match(worker, /isRetryableComposerError/, 'worker should retry retryable composer start/poll errors instead of marking failed');
assert.match(worker, /const composingJob = jobs\.find/, 'cron should avoid processing multiple composing jobs in one tick');
assert.match(worker, /jobsToProcess/, 'cron should use the serialized composing-job list');

console.log('remotion retry/serialization checks passed');
