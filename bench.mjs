import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const kit = process.env.MAKEFUN_KIT_DIR ??
  new URL('../work/markdown-render-speed-02-kit/', import.meta.url).pathname;
const cases = JSON.parse(readFileSync(join(kit, 'practice/input/cases.json'), 'utf8'));
const docs = cases.filter((c) => c.id.startsWith('doc-')).slice(0, 40);

if (process.argv[2] === '--child') {
  const which = process.argv[3];
  const { parse } = await import(which === 'marked' ? './vendor/marked/marked.esm.js' : './parse.js');
  const render = which === 'marked' ? (s) => parse(s) : (s) => parse(s);
  for (let warm = 0; warm < 1; warm++) for (const c of docs) render(c.markdown);
  const samples = [];
  for (let run = 0; run < 3; run++) {
    const start = process.hrtime.bigint();
    for (const c of docs) render(c.markdown);
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  console.log(JSON.stringify(samples));
  process.exit(0);
}

function measure(which) {
  const run = spawnSync(process.execPath, [new URL(import.meta.url).pathname, '--child', which], {
    encoding: 'utf8',
  });
  if (run.status !== 0) throw new Error(run.stderr || `child failed: ${run.status}`);
  const samples = JSON.parse(run.stdout);
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

const markedMs = measure('marked');
const oursMs = measure('ours');
console.log(`marked  ${markedMs.toFixed(1)} ms`);
console.log(`ours    ${oursMs.toFixed(1)} ms`);
console.log(`speedup ${(markedMs / oursMs).toFixed(2)}x`);
