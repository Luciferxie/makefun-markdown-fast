import { Lexer, Parser } from './vendor/marked/marked.esm.js';
import { renderInline } from './fastinline.js';

const markedInlineTokens = Lexer.prototype.inlineTokens;
const STATEFUL_HTML = /<a\s|<\/a>|<\/?(?:pre|code|kbd|script)(?:\s|>)/i;

// Marked emits an html token's text verbatim, and its block parser only concatenates parseInline output for paragraphs, headings, and table cells, so one html token is equivalent to the token list it would build.
Lexer.prototype.inlineTokens = function (src, tokens = []) {
  if (this.state.inLink || this.state.inRawBlock || src.includes('<') && STATEFUL_HTML.test(src)) {
    return markedInlineTokens.call(this, src, tokens);
  }

  const html = renderInline(src, this.tokens.links);
  if (html === null) return markedInlineTokens.call(this, src, tokens);

  tokens.push({ type: 'html', raw: src, text: html });
  return tokens;
};

export function parse(markdown) {
  return Parser.parse(Lexer.lex(markdown));
}
