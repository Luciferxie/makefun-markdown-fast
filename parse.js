import { marked } from './vendor/marked/marked.esm.js';

/** Render markdown with marked's default options. */
export function parse(markdown) {
  return marked.parse(markdown);
}
