import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = process.cwd();
const read = (p) => fs.readFileSync(`${root}/${p}`, 'utf8');

const page = read('src/app/(dashboard)/dashboard/[projectId]/skills/video-creator/page.tsx');
const recorder = read('src/lib/video/product-demo-recorder.ts');
const en = read('src/messages/en.json');
const he = read('src/messages/he.json');

assert.match(page, /disabled=\{testingAccess \|\| !demoUrl\}/, 'Test demo access should only require a URL, not email/password');
assert.match(en, /optional for password-login apps only/i, 'English copy should tell users email/password are optional');
assert.match(he, /אופציונלי/, 'Hebrew copy should tell users email/password are optional');
assert.match(recorder, /looksLikeExternalAuthWall/, 'verifier should detect external auth walls like Google sign-in');
assert.match(recorder, /Google login/, 'external Google auth should return a clear failure reason');
assert.match(recorder, /looksLikeAccessibleApp/, 'URL-only magic/invite links should be accepted when they land in the app');
assert.match(recorder, /Invite\/magic link works/, 'successful URL-only access should use invite/magic-link wording');

console.log('product-demo invite-link access checks passed');
