import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from './parse.js';

const kit = process.env.MAKEFUN_KIT_DIR ??
  new URL('../work/markdown-render-speed-02-kit/', import.meta.url).pathname;
const input = JSON.parse(readFileSync(join(kit, 'practice/input/cases.json'), 'utf8'));
const expected = JSON.parse(readFileSync(join(kit, 'practice/reference/expected.json'), 'utf8')).cases;

if (input.length !== expected.length) {
  throw new Error(`case count mismatch: ${input.length} vs ${expected.length}`);
}

let passed = 0;
const started = process.hrtime.bigint();
for (let i = 0; i < input.length; i++) {
  const actual = parse(input[i].markdown);
  const want = expected[i].html;
  if (actual === want) {
    passed++;
    continue;
  }
  let at = 0;
  const end = Math.min(actual.length, want.length);
  while (at < end && actual.charCodeAt(at) === want.charCodeAt(at)) at++;
  console.error(`FAIL ${input[i].id} at ${at}`);
  console.error(`want: ${JSON.stringify(want.slice(Math.max(0, at - 60), at + 140))}`);
  console.error(` got: ${JSON.stringify(actual.slice(Math.max(0, at - 60), at + 140))}`);
}
const ms = Number(process.hrtime.bigint() - started) / 1e6;
console.log(`${passed}/${input.length} passed in ${ms.toFixed(1)} ms`);
if (passed !== input.length) process.exitCode = 1;
