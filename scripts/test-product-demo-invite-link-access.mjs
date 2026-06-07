import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = process.cwd();
const read = (p) => fs.readFileSync(`${root}/${p}`, 'utf8');

const page = read('src/app/(dashboard)/dashboard/[projectId]/skills/video-creator/page.tsx');
const route = read('src/app/api/skills/video-creator/test-access/route.ts');
const en = read('src/messages/en.json');
const he = read('src/messages/he.json');

assert.match(page, /disabled=\{testingAccess \|\| !demoUrl\}/, 'Test demo access should only require a URL, not email/password');
assert.match(en, /optional for password-login apps only/i, 'English copy should tell users email/password are optional');
assert.match(he, /אופציונלי/, 'Hebrew copy should tell users email/password are optional');
const recorder = read('src/lib/video/product-demo-recorder.ts');
assert.match(recorder, /looksLikeExternalAuthWall/, 'verifier should detect external auth walls like Google sign-in');
assert.match(recorder, /Google login/, 'external Google auth should return a clear failure reason');
assert.match(recorder, /looksLikeAccessibleApp/, 'URL-only magic/invite links should be accepted when they land in the app');
assert.match(recorder, /Invite\/magic link works/, 'successful URL-only access should use invite/magic-link wording');
assert.match(recorder, /let browser: Awaited<ReturnType<typeof launchRecorderBrowser>> \| null = null/, 'browser launch errors should be caught and returned as JSON');
assert.match(route, /export const runtime = "nodejs"/, 'test-access route should force Node runtime for Puppeteer');
assert.match(route, /await import\("@\/lib\/video\/product-demo-recorder"\)/, 'test-access route should dynamically import Puppeteer verifier inside try/catch');
assert.match(route, /status: 422/, 'test-access route should return JSON 422 for verifier failures instead of raw 500');

console.log('product-demo invite-link access checks passed');
