const ASCII_PUNCT = c => c >= 33 && c <= 47 || c >= 58 && c <= 64 || c >= 91 && c <= 96 || c >= 123 && c <= 126;
const PUNCT = c => ASCII_PUNCT(c) || c >= 128 && /[\p{P}\p{S}]/u.test(String.fromCodePoint(c));
const SPACE = c => c === 32 || c === 9 || c === 10 || c === 13;
const FLANK_SPACE = c => SPACE(c) || c >= 128 && /\s/u.test(String.fromCodePoint(c));
const ALPHA = c => c >= 65 && c <= 90 || c >= 97 && c <= 122;
const DIGIT = c => c >= 48 && c <= 57;
const ALNUM = c => ALPHA(c) || DIGIT(c);
const LOWER = c => c >= 65 && c <= 90 ? c + 32 : c;
const HEX = '0123456789ABCDEF';
const WIN1252 = [0x20ac,0x81,0x201a,0x192,0x201e,0x2026,0x2020,0x2021,0x2c6,0x2030,0x160,0x2039,0x152,0x8d,0x17d,0x8f,0x90,0x2018,0x2019,0x201c,0x201d,0x2022,0x2013,0x2014,0x2dc,0x2122,0x161,0x203a,0x153,0x9d,0x17e,0x178];
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', copy: '\u00a9', reg: '\u00ae', trade: '\u2122', hellip: '\u2026', mdash: '\u2014', ndash: '\u2013', lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201c', rdquo: '\u201d' };
const FAST_SPECIAL = /[&<>"'\\\r\n*_~\[\]!@\x60]|http|www\.|:\/\//i;
const TEXT_STOP = new Uint8Array(128);
for (const c of [10,13,32,33,34,38,39,42,44,60,62,64,91,92,95,96,126]) TEXT_STOP[c] = 1;

function esc(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 38) out += '&amp;';
    else if (c === 60) out += '&lt;';
    else if (c === 62) out += '&gt;';
    else if (c === 34) out += '&quot;';
    else if (c === 39) out += '&#39;';
    else out += s[i];
  }
  return out;
}

function escAttr(s) {
  let out = '';
  for (let i = 0; i < s.length;) {
    const c = s.charCodeAt(i);
    if (c === 38) {
      const e = entityEnd(s, i, s.length);
      if (e > i) { out += s.slice(i, e); i = e; continue; }
      out += '&amp;';
    } else if (c === 60) out += '&lt;';
    else if (c === 62) out += '&gt;';
    else if (c === 34) out += '&quot;';
    else if (c === 39) out += '&#39;';
    else out += s[i];
    i++;
  }
  return out;
}

function escapeRun(src, start, end) {
  let amp = -1, lt = -1, gt = -1, dq = -1, sq = -1;
  for (let i = start; i < end; i++) {
    const c = src.charCodeAt(i);
    if (c === 38 && amp < 0) amp = i;
    else if (c === 60 && lt < 0) lt = i;
    else if (c === 62 && gt < 0) gt = i;
    else if (c === 34 && dq < 0) dq = i;
    else if (c === 39 && sq < 0) sq = i;
  }
  if (amp < 0 && lt < 0 && gt < 0 && dq < 0 && sq < 0) return src.slice(start, end);
  return esc(src.slice(start, end));
}

function entityEnd(src, i, end) {
  let semi = src.indexOf(';', i + 1);
  if (semi < 0 || semi >= end || semi - i > 32) return -1;
  let p = i + 1;
  if (src.charCodeAt(p) === 35) {
    p++;
    let radix = 10;
    if (src.charCodeAt(p) === 120 || src.charCodeAt(p) === 88) { radix = 16; p++; }
    if (p === semi) return -1;
    if (semi - p > (radix === 16 ? 6 : 7)) return -1;
    for (; p < semi; p++) {
      const c = src.charCodeAt(p);
      if (!(c >= 48 && c <= 57 || radix === 16 && (c >= 65 && c <= 70 || c >= 97 && c <= 102))) return -1;
    }
    return semi + 1;
  }
  if (!ALPHA(src.charCodeAt(p))) return -1;
  for (p++; p < semi; p++) if (!ALNUM(src.charCodeAt(p))) return -1;
  return semi + 1;
}

function decodeEntity(src, start, end) {
  let p = start + 2, radix = 10;
  if (src.charCodeAt(p) === 120 || src.charCodeAt(p) === 88) { radix = 16; p++; }
  let n = 0;
  for (; p < end - 1; p++) {
    const c = src.charCodeAt(p);
    const d = c >= 48 && c <= 57 ? c - 48 : radix === 16 && LOWER(c) >= 97 && LOWER(c) <= 102 ? LOWER(c) - 87 : -1;
    if (d < 0 || d >= radix) return null;
    n = n * radix + d;
  }
  if (n > 0x10ffff) return null;
  if (n === 0 || n >= 0xd800 && n <= 0xdfff) n = 0xfffd;
  else if (n >= 0x80 && n <= 0x9f) n = WIN1252[n - 0x80];
  return String.fromCodePoint(n);
}

function normalizeHref(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 128) {
      if (ALNUM(c) || c === 59 || c === 47 || c === 63 || c === 58 || c === 64 || c === 38 || c === 61 || c === 43 || c === 36 || c === 44 || c === 45 || c === 95 || c === 46 || c === 33 || c === 126 || c === 42 || c === 39 || c === 40 || c === 41 || c === 35 || c === 37) out += s[i];
      else out += '%' + HEX[(c >> 4) & 15] + HEX[c & 15];
    } else {
      const cp = s.codePointAt(i), width = cp > 0xffff ? 2 : 1;
      try { out += encodeURI(s.slice(i, i + width)); } catch { return null; }
      if (width === 2) i++;
    }
  }
  return out;
}

function decodeEscaped(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 92 && i + 1 < s.length && ASCII_PUNCT(s.charCodeAt(i + 1))) i++;
    out += s[i];
  }
  return out;
}

function codeSpan(src, start, end, run) {
  let i = start + run;
  while (i < end) {
    const at = src.indexOf(String.fromCharCode(96), i);
    if (at < 0 || at >= end) return null;
    let n = 1; while (src.charCodeAt(at + n) === 96) n++;
    if (n === run) {
      let value = '';
      for (let x = start + run; x < at; x++) {
        const c = src.charCodeAt(x);
        if (c === 13) { if (src.charCodeAt(x + 1) === 10) x++; value += ' '; }
        else if (c === 10 || c === 9) value += ' ';
        else value += src[x];
      }
      if (value.length > 1 && value.charCodeAt(0) === 32 && value.charCodeAt(value.length - 1) === 32) {
        let nonSpace = false;
        for (let x = 0; x < value.length; x++) if (value.charCodeAt(x) !== 32) { nonSpace = true; break; }
        if (nonSpace) value = value.slice(1, -1);
      }
      return { end: at + run, html: '<code>' + esc(value) + '</code>' };
    }
    i = at + n;
  }
  return null;
}

function runAt(src, i, end, ch) {
  let n = 1; while (i + n < end && src.charCodeAt(i + n) === ch) n++;
  return n;
}

function pointBefore(src, i) {
  let c = src.charCodeAt(i - 1);
  if (c >= 0xdc00 && c <= 0xdfff && i > 1) {
    const high = src.charCodeAt(i - 2);
    if (high >= 0xd800 && high <= 0xdbff) return 0x10000 + ((high - 0xd800) << 10) + c - 0xdc00;
  }
  return c;
}

function flanking(src, start, run, end, ch) {
  const prev = start > 0 ? pointBefore(src, start) : 32;
  const next = start + run < end ? src.codePointAt(start + run) : 32;
  const ps = FLANK_SPACE(prev), ns = FLANK_SPACE(next), pp = PUNCT(prev), np = PUNCT(next);
  const left = !ns && (!np || ps || pp), right = !ps && (!pp || ns || np);
  if (ch === 95) return left && (!right || pp) ? 1 : 0;
  return left ? 1 : 0;
}

function isCloser(src, at, run, end, ch) {
  const prev = at > 0 ? pointBefore(src, at) : 32;
  const next = at + run < end ? src.codePointAt(at + run) : 32;
  const ps = FLANK_SPACE(prev), ns = FLANK_SPACE(next), pp = PUNCT(prev), np = PUNCT(next);
  const right = !ps && (!pp || ns || np);
  if (ch === 95) return right && (!( !ns && (!np || ps || pp)) || np);
  return right;
}

function findEmphasisClose(src, start, end, ch, run, refs = null) {
  const needle = ch === 42 ? '*' : ch === 95 ? '_' : '~';
  let at = start, nested1 = 0, nested2 = 0, nested3 = 0;
  while (at < end) {
    const found = src.indexOf(needle, at);
    if (found < 0 || found >= end) return -1;
    const tick = src.indexOf(String.fromCharCode(96), at);
    if (tick >= 0 && tick < found) {
      let escapedTicks = 0;
      for (let p = tick - 1; p >= start && src.charCodeAt(p) === 92; p--) escapedTicks++;
      if (escapedTicks & 1) { at = tick + 1; continue; }
      const ticks = runAt(src, tick, end, 96), span = codeSpan(src, tick, end, ticks);
      if (span) { at = span.end; continue; }
    }
    const angle = src.indexOf('<', at);
    if (angle >= 0 && angle < found) {
      const link = angleLink(src, angle, end);
      if (link) { at = link.end; continue; }
      const tagEnd = rawTagEnd(src, angle, end);
      if (tagEnd > angle) { at = tagEnd; continue; }
    }
    const bracket = src.indexOf('[', at);
    if (bracket >= 0 && bracket < found) {
      let escaped = false;
      for (let p = bracket - 1; p >= start && src.charCodeAt(p) === 92; p--) escaped = !escaped;
      if (!escaped) {
        const close = bracketClose(src, bracket, end), after = close + 1;
        if (close >= 0 && (src.charCodeAt(after) === 40 || src.charCodeAt(after) === 91)) {
          if (src.charCodeAt(after) === 40) {
            const target = linkTarget(src, after, end);
            if (target) { at = target.end; continue; }
          } else { at = after + 1; continue; }
        }
        if (close >= 0 && refs && refLookup(refs, src.slice(bracket + 1, close))) { at = close + 1; continue; }
      }
    }
    at = found;
    let slashCount = 0;
    for (let p = at - 1; p >= start && src.charCodeAt(p) === 92; p--) slashCount++;
    if (slashCount & 1) { at++; continue; }
    const n = runAt(src, at, end, ch);
    if (n > 3 || ch === 126 && n > 2) return -2;
    const canOpen = !!flanking(src, at, n, end, ch);
    const canClose = isCloser(src, at, n, end, ch);
    if (ch === 42 && n === 2 && canClose && !SPACE(src.charCodeAt(at + n)) &&
        (run === 1 && nested2 > 0 || run === 2 && nested1 > 0)) return -2;
    let nested = n === 1 ? nested1 : n === 2 ? nested2 : nested3;
    if (canClose && n === 3 && nested1 && nested2) {
      nested1--; nested2--; at += n; continue;
    }
    if (canClose && n === run && nested) nested--;
    else if (canClose && n === run) return at * 4;
    else if (canClose && n > run && n === run + 1 && nested1) return at * 4 + 1;
    else if (canClose && n > run && n === run + 2 && nested2) return at * 4 + 2;
    else if (canClose && nested) nested--;
    else if (canOpen && !canClose) nested++;
    else if (n !== run && canClose || canOpen && canClose) return -2;
    if (n === 1) nested1 = nested;
    else if (n === 2) nested2 = nested;
    else nested3 = nested;
    at += n;
  }
  return nested1 || nested2 || nested3 ? -2 : -1;
}

function linkTarget(src, open, end) {
  let i = open + 1;
  while (i < end && SPACE(src.charCodeAt(i))) i++;
  let href = '';
  if (src.charCodeAt(i) === 60) {
    const from = ++i;
    while (i < end && src.charCodeAt(i) !== 10 && src.charCodeAt(i) !== 13) {
      if (src.charCodeAt(i) === 92 && i + 1 < end && ASCII_PUNCT(src.charCodeAt(i + 1))) { i += 2; continue; }
      if (FLANK_SPACE(src.codePointAt(i))) return null;
      if (src.charCodeAt(i) === 62) break;
      i++;
    }
    if (i >= end || src.charCodeAt(i) !== 62) return null;
    href = decodeEscaped(src.slice(from, i++));
  } else {
    const from = i; let depth = 0;
    while (i < end) {
      const c = src.charCodeAt(i);
      if (c === 92 && i + 1 < end && ASCII_PUNCT(src.charCodeAt(i + 1))) { i += 2; continue; }
      if (SPACE(c)) break;
      if (c === 40) depth++;
      else if (c === 41) { if (depth === 0) break; depth--; }
      i++;
    }
    if (depth) return null;
    href = decodeEscaped(src.slice(from, i));
  }
  if (href.slice(0, 11).toLowerCase() === 'javascript:' || href.slice(0, 9).toLowerCase() === 'vbscript:' || href.slice(0, 5).toLowerCase() === 'data:') return null;
  const beforeSpace = i;
  while (i < end && SPACE(src.charCodeAt(i))) i++;
  let title = '';
  if (i > beforeSpace && (src.charCodeAt(i) === 34 || src.charCodeAt(i) === 39 || src.charCodeAt(i) === 40)) {
    const q = src.charCodeAt(i++), close = q === 40 ? 41 : q, from = i;
    while (i < end && src.charCodeAt(i) !== close) {
      if ((src.charCodeAt(i) === 10 || src.charCodeAt(i) === 13) && q !== 40) return null;
      if (src.charCodeAt(i) === 92 && i + 1 < end && ASCII_PUNCT(src.charCodeAt(i + 1))) i++;
      i++;
    }
    if (i >= end || i === from) return null;
    title = decodeEscaped(src.slice(from, i++));
    while (i < end && SPACE(src.charCodeAt(i))) i++;
  } else i = beforeSpace;
  if (src.charCodeAt(i) !== 41) return null;
  return { end: i + 1, href, title };
}

function rawTagEnd(src, start, end) {
  if (src.startsWith('<!--', start)) {
    if (src.charCodeAt(start + 4) === 62) return start + 5;
    if (src.charCodeAt(start + 4) === 45 && src.charCodeAt(start + 5) === 62) return start + 6;
    const close = src.indexOf('-->', start + 4);
    return close >= 0 && close + 3 <= end ? close + 3 : -1;
  }
  let i = start + 1, c = src.charCodeAt(i), closing = false;
  if (c === 33 || c === 63) {
    if (c === 33 && src.startsWith('<![CDATA[', start)) {
      const close = src.indexOf(']]>', start + 9);
      return close >= 0 && close + 3 <= end ? close + 3 : -1;
    }
    const close = src.indexOf('>', i + 1);
    return close >= 0 && close < end ? close + 1 : -1;
  }
  if (c === 47) { closing = true; c = src.charCodeAt(++i); }
  if (!ALPHA(c)) return -1;
  for (; i < end; i++) {
    c = src.charCodeAt(i);
    if (!(ALNUM(c) || c === 45)) break;
  }
  c = src.charCodeAt(i);
  if (!(SPACE(c) || c === 47 || c === 62)) return -1;
  if (closing) {
    while (i < end && SPACE(src.charCodeAt(i))) i++;
    return src.charCodeAt(i) === 62 ? i + 1 : -1;
  }
  while (i < end) {
    c = src.charCodeAt(i);
    if (SPACE(c)) { i++; continue; }
    if (c === 62) return i + 1;
    if (c === 47) return src.charCodeAt(i + 1) === 62 ? i + 2 : -1;
    if (!(ALPHA(c) || c === 95 || c === 58)) return -1;
    i++;
    while (i < end) {
      c = src.charCodeAt(i);
      if (!(ALNUM(c) || c === 95 || c === 46 || c === 58 || c === 45)) break;
      i++;
    }
    while (i < end && SPACE(src.charCodeAt(i))) i++;
    if (src.charCodeAt(i) === 61) {
      i++;
      while (i < end && SPACE(src.charCodeAt(i))) i++;
      const quote = src.charCodeAt(i);
      if (quote === 34 || quote === 39) {
        i++;
        while (i < end && src.charCodeAt(i) !== quote) {
          i++;
        }
        if (i >= end) return -1;
        i++;
      } else {
        const from = i;
        while (i < end) {
          c = src.charCodeAt(i);
          if (SPACE(c) || c === 62 || c === 47 && src.charCodeAt(i + 1) === 62) break;
          if (c === 34 || c === 39 || c === 61 || c === 60 || c === 96) return -1;
          i++;
        }
        if (i === from) return -1;
      }
    }
    c = src.charCodeAt(i);
    if (!(SPACE(c) || c === 47 || c === 62)) return -1;
  }
  return -1;
}

function emailSpan(src, start, end) {
  let at = start;
  while (at < end) {
    const c = src.charCodeAt(at);
    if (!(ALNUM(c) || c === 46 || c === 95 || c === 43 || c === 45)) break;
    at++;
  }
  if (at === start || src.charCodeAt(at) !== 64) return null;
  let to = at + 1;
  while (to < end) {
    const c = src.charCodeAt(to);
    if (!(ALNUM(c) || c === 45 || c === 95 || c === 46)) break;
    to++;
  }
  while (to > at + 1) {
    const c = src.charCodeAt(to - 1);
    if (c === 46 || c === 44 || c === 33 || c === 63 || c === 58 || c === 59) to--;
    else break;
  }
  if (to <= at + 1 || !ALNUM(src.charCodeAt(at + 1))) return null;
  let dots = 0, label = at + 1;
  for (let i = at + 1; i <= to; i++) {
    const c = src.charCodeAt(i);
    if (c === 46 || i === to) {
      if (i === label || dots && !ALNUM(src.charCodeAt(i - 1))) return null;
      if (c === 46) { dots++; label = i + 1; }
    }
  }
  if (!dots || !ALNUM(src.charCodeAt(to - 1))) return null;
  const next = to < end ? src.charCodeAt(to) : -1;
  if (ALNUM(next) || next === 45 || next === 95) return null;
  return { start, at, end: to };
}

function angleLink(src, start, end) {
  const close = src.indexOf('>', start + 1);
  if (close < 0 || close >= end) return null;
  const body = src.slice(start + 1, close);
  if (!body) return null;
  for (let i = 0; i < body.length; i++) if (FLANK_SPACE(body.charCodeAt(i)) || body.charCodeAt(i) === 60 || body.charCodeAt(i) === 62) return null;
  let email = body.indexOf('@');
  if (body.slice(0, 7).toLowerCase() === 'mailto:') {
    const addr = emailSpan(body, 7, body.length);
    if (!addr || addr.end !== body.length) return null;
    return { end: close + 1, html: '<a href="' + escAttr(body) + '">' + esc(body) + '</a>' };
  }
  if (email > 0 && body.indexOf(':') < 0) {
    const addr = emailSpan(body, 0, body.length);
    if (addr && addr.end === body.length) return { end: close + 1, html: '<a href="mailto:' + escAttr(body) + '">' + esc(body) + '</a>' };
  }
  const colon = body.indexOf(':');
  if (colon < 2 || colon > 32 || !ALPHA(body.charCodeAt(0))) return null;
  for (let i = 1; i < colon; i++) {
    const c = body.charCodeAt(i);
    if (!(ALNUM(c) || c === 43 || c === 45 || c === 46)) return null;
  }
  const href = normalizeHref(body);
  if (href === null) return null;
  return { end: close + 1, html: '<a href="' + esc(href) + '">' + esc(body) + '</a>' };
}

function bareLink(src, start, end) {
  if (start && (ALNUM(src.charCodeAt(start - 1)) || src.charCodeAt(start - 1) === 95 || src.charCodeAt(start - 1) === 47)) return null;
  let prefix = 0, www = false;
  const a = src.charCodeAt(start), b = src.charCodeAt(start + 1), c = src.charCodeAt(start + 2), d = src.charCodeAt(start + 3);
  if (LOWER(a) === 104 && LOWER(b) === 116 && LOWER(c) === 116 && LOWER(d) === 112) {
    if (src.charCodeAt(start + 4) === 115 && src.charCodeAt(start + 5) === 58 && src.charCodeAt(start + 6) === 47 && src.charCodeAt(start + 7) === 47) prefix = 8;
    else if (src.charCodeAt(start + 4) === 58 && src.charCodeAt(start + 5) === 47 && src.charCodeAt(start + 6) === 47) prefix = 7;
  } else if (LOWER(a) === 102 && LOWER(b) === 116 && LOWER(c) === 112 && src.charCodeAt(start + 3) === 58 && src.charCodeAt(start + 4) === 47 && src.charCodeAt(start + 5) === 47) prefix = 6;
  else if (a === 119 && b === 119 && c === 119 && d === 46) { prefix = 4; www = true; }
  else if (LOWER(a) === 120 && src.slice(start, start + 5).toLowerCase() === 'xmpp:') prefix = 5;
  if (!prefix) return null;
  let i = start + prefix, parens = 0;
  while (i < end) {
    const x = src.charCodeAt(i);
    if (SPACE(x) || x === 60 || x === 62 || x === 34 || x === 39) break;
    if (x === 38 && entityEnd(src, i, end) > i) break;
    if (x === 40) parens++;
    else if (x === 41) parens--;
    i++;
  }
  if (prefix === 5) {
    const firstSlash = src.indexOf('/', start + prefix);
    if (firstSlash >= 0 && firstSlash < i) {
      const secondSlash = src.indexOf('/', firstSlash + 1);
      if (secondSlash >= 0 && secondSlash < i) i = secondSlash;
    }
  }
  while (i > start + prefix) {
    const x = src.charCodeAt(i - 1);
    if (x === 46 || x === 44 || x === 58 || x === 59 || x === 33 || x === 63 || x === 42 || x === 95 || x === 126) i--;
    else if (x === 41 && parens < 0) { i--; parens++; }
    else break;
  }
  if (i <= start + prefix) return null;
  const label = src.slice(start, i), href = normalizeHref(www ? 'http://' + label : label);
  if (href === null) return null;
  return { end: i, html: '<a href="' + esc(href) + '">' + esc(label) + '</a>' };
}

function imageAlt(src, start, end) {
  let alt = '';
  for (let i = start; i < end; i++) {
    const c = src.charCodeAt(i);
    if (c === 42 || c === 95 || c === 126) {
      const run = runAt(src, i, end, c), close = findEmphasisClose(src, i + run, end, c, run);
      if (close === -2) return null;
      if (close >= 0) {
        const closeAt = close >> 2, extra = close & 3;
        const inner = imageAlt(src, i + run, closeAt + extra);
        if (inner === null) return null;
        alt += inner; i = closeAt + run + extra - 1; continue;
      }
    }
    if (c === 96) {
      const run = runAt(src, i, end, 96), span = codeSpan(src, i, end, run);
      if (span) {
        let text = '';
        for (let x = i + run; x < span.end - run; x++) {
          const q = src.charCodeAt(x);
          if (q === 10 || q === 13 || q === 9) text += ' ';
          else text += src[x];
        }
        if (text.length > 1 && text[0] === ' ' && text[text.length - 1] === ' ') text = text.slice(1, -1);
        alt += text; i = span.end - 1; continue;
      }
      return null;
    }
    if (c === 91 || c === 93) return null;
    if (c === 38) {
      const e = entityEnd(src, i, end);
      if (e < 0) { alt += '&'; continue; }
      if (src.charCodeAt(i + 1) === 35) { const value = decodeEntity(src, i, e); if (value === null) return null; alt += value; }
      else {
        const name = src.slice(i + 1, e - 1), value = NAMED[name];
        if (value === undefined) return null;
        alt += value;
      }
      i = e - 1;
    } else if (c === 60) {
      const tagEnd = rawTagEnd(src, i, end);
      if (tagEnd > i) { i = tagEnd - 1; continue; }
      const link = angleLink(src, i, end);
      if (link) { const close = src.indexOf('>', i + 1); alt += src.slice(i + 1, close); i = close; }
      else alt += '<';
    } else if (c === 92 && i + 1 < end && ASCII_PUNCT(src.charCodeAt(i + 1))) alt += src[++i];
    else alt += src[i];
  }
  return alt;
}

function bracketClose(src, open, end) {
  let depth = 1;
  for (let i = open + 1; i < end; i++) {
    const c = src.charCodeAt(i);
    if (c === 92) { i++; continue; }
    if (c === 96) {
      const run = runAt(src, i, end, 96), span = codeSpan(src, i, end, run);
      if (span) { i = span.end - 1; continue; }
    }
    if (c === 60) {
      const link = angleLink(src, i, end);
      if (link) { i = link.end - 1; continue; }
      const tagEnd = rawTagEnd(src, i, end);
      if (tagEnd > i) { i = tagEnd - 1; continue; }
    }
    if (c === 91) depth++;
    else if (c === 93 && --depth === 0) return i;
  }
  return -1;
}

function hasUnescapedBracket(src, start, end) {
  for (let i = start; i < end; i++) {
    const c = src.charCodeAt(i);
    if (c === 92) { i++; continue; }
    if (c === 91 || c === 93) return true;
  }
  return false;
}

function hasNestedLink(src, open, close, end, refs) {
  const first = src.indexOf('[', open + 1);
  if (first < 0 || first >= close) return false;
  for (let i = open + 1; i < close; i++) {
    const c = src.charCodeAt(i);
    if (c === 92) { i++; continue; }
    if (c === 96) {
      const run = runAt(src, i, close, 96), span = codeSpan(src, i, close, run);
      if (span) { i = span.end - 1; continue; }
    }
    if (c !== 91) continue;
    const nestedClose = bracketClose(src, i, close);
    if (nestedClose < 0) continue;
    const after = src.charCodeAt(nestedClose + 1);
    if (src.charCodeAt(i - 1) === 33 && after === 91) {
      const imageRefClose = bracketClose(src, nestedClose + 1, close);
      if (imageRefClose >= 0) { i = imageRefClose; continue; }
    }
    if (src.charCodeAt(i - 1) !== 33 && (after === 40 || refs && refLookup(refs, src.slice(i + 1, nestedClose)))) return true;
    if (refs && after === 91 && src.charCodeAt(i - 1) !== 33) {
      const refClose = bracketClose(src, nestedClose + 1, close);
      if (refClose >= 0 && refLookup(refs, src.slice(nestedClose + 2, refClose) || src.slice(i + 1, nestedClose))) return true;
    }
    i = nestedClose;
  }
  return false;
}

function hasDeepBrackets(src, start, end) {
  const first = src.indexOf('[', start + 1);
  if (first < 0 || first >= end) return false;
  let depth = 0;
  for (let i = start; i < end; i++) {
    const c = src.charCodeAt(i);
    if (c === 92) { i++; continue; }
    if (c === 96) {
      const run = runAt(src, i, end, 96), span = codeSpan(src, i, end, run);
      if (span) { i = span.end - 1; continue; }
    }
    if (c === 91) { if (++depth >= 3) return true; }
    else if (c === 93 && depth) depth--;
  }
  return false;
}

function hasComplexCodeLabel(src, start, end) {
  for (let i = start; i < end; i++) {
    if (src.charCodeAt(i) !== 96) continue;
    const run = runAt(src, i, end, 96);
    if (run !== 2) { i += run - 1; continue; }
    const span = codeSpan(src, i, src.length, run);
    if (!span || span.end > end) return true;
    for (let x = i + run; x < span.end - run; x++) {
      if (src.charCodeAt(x) === 96 && runAt(src, x, span.end - run, 96) === 1) return true;
    }
    i = span.end - 1;
  }
  return false;
}

function hasCrossingCodeBracket(src) {
  let open = -1;
  while ((open = src.indexOf('[', open + 1)) >= 0) {
    const close = src.indexOf(']', open + 1);
    if (close < 0) return false;
    const tick = src.indexOf(String.fromCharCode(96), open + 1);
    if (tick >= 0 && tick < close) {
      const run = runAt(src, tick, src.length, 96), span = codeSpan(src, tick, src.length, run);
      if (span && span.end > close + 1 && (src.charCodeAt(close + 1) === 40 || src.charCodeAt(close + 1) === 91)) return true;
    }
  }
  return false;
}

function referenceKey(label) {
  return label.trim().replace(/\s+/g, ' ').toUpperCase().toLowerCase().replace(/\u00df/g, 'ss');
}

function refLookup(refs, label) {
  if (!refs) return null;
  const key = referenceKey(label);
  const ref = refs[key];
  return ref && typeof ref.href === 'string' ? ref : null;
}

function renderRange(src, start, end, refs, depth, inLink) {
  if (depth > 12) return null;
  let out = '';
  for (let i = start; i < end;) {
    const c = src.charCodeAt(i);
    if (c === 96) {
      const run = runAt(src, i, end, 96), span = codeSpan(src, i, end, run);
      if (span) { out += span.html; i = span.end; continue; }
      const nextTick = src.indexOf(String.fromCharCode(96), i + run);
      if (nextTick >= 0 && nextTick < end) return null;
      out += src.slice(i, i + run); i += run; continue;
    }
    if (c === 38) {
      const e = entityEnd(src, i, end);
      if (e < 0) { out += '&amp;'; i++; continue; }
      if (src.charCodeAt(i + 1) === 35) { const value = decodeEntity(src, i, e); if (value === null) return null; out += esc(value); }
      else out += src.slice(i, e);
      i = e; continue;
    }
    if (c === 92) {
      if (src.charCodeAt(i + 1) === 10 || src.charCodeAt(i + 1) === 13) {
        let nl = i + 2;
        if (src.charCodeAt(i + 1) === 13 && src.charCodeAt(nl) === 10) nl++;
        out += '<br>'; i = nl; while (i < end && (src.charCodeAt(i) === 32 || src.charCodeAt(i) === 9)) i++; continue;
      }
      if (i + 1 < end && ASCII_PUNCT(src.charCodeAt(i + 1))) { out += esc(src[i + 1]); i += 2; continue; }
      out += '\\'; i++; continue;
    }
    if (c === 10 || c === 13) {
      let nl = i + 1; if (c === 13 && src.charCodeAt(nl) === 10) nl++;
      let spaces = i; while (spaces > start && src.charCodeAt(spaces - 1) === 32) spaces--;
      if (i - spaces >= 2) {
        out = out.slice(0, out.length - (i - spaces));
        out += '<br>';
        while (nl < end && (src.charCodeAt(nl) === 32 || src.charCodeAt(nl) === 9)) nl++;
      } else out += src.slice(i, nl);
      i = nl; continue;
    }
    if (c === 32) {
      let j = i + 1; while (j < end && src.charCodeAt(j) === 32) j++;
      let nl = j; if (src.charCodeAt(nl) === 13 && src.charCodeAt(nl + 1) === 10) nl++;
      if (nl < end && (src.charCodeAt(nl) === 10 || src.charCodeAt(nl) === 13) && j - i >= 2) {
        out += '<br>'; i = nl + 1; while (i < end && (src.charCodeAt(i) === 32 || src.charCodeAt(i) === 9)) i++; continue;
      }
      out += src.slice(i, j); i = j; continue;
    }
    if (c === 91 || c === 33 && src.charCodeAt(i + 1) === 91) {
      const image = c === 33, open = image ? i + 1 : i, close = bracketClose(src, open, end);
      if (close >= 0) {
        const after = close + 1;
        if (src.charCodeAt(after) === 40) {
          if (!image && inLink) return null;
          if (!image && hasNestedLink(src, open, close, end, refs)) {
            if (hasDeepBrackets(src, open, close)) return null;
            out += '['; i = open + 1; continue;
          }
          if (!image && src.indexOf(String.fromCharCode(96, 96), open + 1) < close && hasComplexCodeLabel(src, open + 1, close)) return null;
          const target = linkTarget(src, after, end); if (!target) return null;
          const label = image ? '' : renderRange(src, open + 1, close, refs, depth + 1, true);
          if (!image && label === null) return null;
          const href = normalizeHref(target.href); if (href === null) return null;
          const title = target.title ? ' title="' + escAttr(target.title) + '"' : '';
          if (image) {
            const alt = imageAlt(src, open + 1, close); if (alt === null) return null;
            out += '<img src="' + escAttr(href) + '" alt="' + esc(alt) + '"' + title + '>';
          } else out += '<a href="' + escAttr(href) + '"' + title + '>' + label + '</a>';
          i = target.end; continue;
        }
        if (refs) {
          let finish = after, label = src.slice(open + 1, close), refLabel = label;
          if (src.charCodeAt(finish) === 91) {
            const refClose = bracketClose(src, finish, end); if (refClose < 0) return null;
            if (hasUnescapedBracket(src, finish + 1, refClose)) {
              // Marked rejects this reflink label, then resolves only the nolink label.
              finish = after;
            } else {
              if (refClose > finish + 1) refLabel = src.slice(finish + 1, refClose);
              finish = refClose + 1;
            }
          }
          if (!image && hasNestedLink(src, open, close, end, refs)) {
            if (hasDeepBrackets(src, open, close)) return null;
            out += '['; i = open + 1; continue;
          }
          const ref = refLookup(refs, refLabel);
          if (ref) {
            const href = normalizeHref(ref.href); if (href === null) return null;
            if (!image && src.indexOf(String.fromCharCode(96, 96), open + 1) < close && hasComplexCodeLabel(src, open + 1, close)) return null;
            const title = ref.title == null || ref.title === '' ? '' : ' title="' + escAttr(String(ref.title)) + '"';
            if (image) {
              const alt = imageAlt(src, open + 1, close); if (alt === null) return null;
              out += '<img src="' + escAttr(href) + '" alt="' + esc(alt) + '"' + title + '>';
            } else {
              const rendered = renderRange(src, open + 1, close, refs, depth + 1, true); if (rendered === null) return null;
              out += '<a href="' + escAttr(href) + '"' + title + '>' + rendered + '</a>';
            }
            i = finish; continue;
          }
        }
      }
      if (inLink && c === 91 && close >= 0 && src.charCodeAt(close + 1) === 40) return null;
    }
    if (c === 60) {
      const link = angleLink(src, i, end);
      if (link) { out += link.html; i = link.end; continue; }
      const tagEnd = rawTagEnd(src, i, end);
      if (tagEnd > i) {
        if (!src.startsWith('<!--', i)) for (let x = i; x < tagEnd; x++) if (src.charCodeAt(x) === 10 || src.charCodeAt(x) === 13) return null;
        out += src.slice(i, tagEnd); i = tagEnd; continue;
      }
      out += '&lt;'; i++; continue;
    }
    if (c === 62 || c === 34 || c === 39) {
      out += c === 62 ? '&gt;' : c === 34 ? '&quot;' : '&#39;'; i++; continue;
    }
    if (!inLink && LOWER(c) === 109 && src.slice(i, i + 7).toLowerCase() === 'mailto:') {
      const email = emailSpan(src, i + 7, end);
      if (email) {
        const label = src.slice(i, email.end), href = normalizeHref(label);
        if (href !== null) { out += '<a href="' + escAttr(href) + '">' + esc(label) + '</a>'; i = email.end; continue; }
      }
    }
    if (c === 104 || c === 72 || c === 102 || c === 70 || c === 119 || c === 87 || c === 120 || c === 88) {
      const link = inLink ? null : bareLink(src, i, end);
      if (link) { out += link.html; i = link.end; continue; }
    }
    if (c === 64 && !inLink) {
      let from = i;
      while (from > start) { const x = src.charCodeAt(from - 1); if (ALNUM(x) || x === 46 || x === 95 || x === 43 || x === 45) from--; else break; }
      if (from < i && (from === start || !(ALNUM(src.charCodeAt(from - 1)) || src.charCodeAt(from - 1) === 95 || src.charCodeAt(from - 1) === 92))) {
        const email = emailSpan(src, from, end);
        if (email && email.at === i) {
          const label = src.slice(from, email.end), href = normalizeHref('mailto:' + label);
          if (href !== null) { out = out.slice(0, out.length - (i - from)); out += '<a href="' + escAttr(href) + '">' + esc(label) + '</a>'; i = email.end; continue; }
        }
      }
      out += '@'; i++; continue;
    }
    if ((c === 42 || c === 95 || c === 126)) {
      const run = runAt(src, i, end, c);
      if (run <= (c === 126 ? 2 : 3) && flanking(src, i, run, end, c)) {
        const closeCode = findEmphasisClose(src, i + run, end, c, run, refs);
        if (closeCode === -2) return null;
        const close = closeCode >= 0 ? closeCode >> 2 : -1, extra = closeCode >= 0 ? closeCode & 3 : 0;
        if (close >= 0 && close > i + run) {
          const inner = renderRange(src, i + run, close + extra, refs, depth + 1, inLink); if (inner === null) return null;
          if (c === 126) out += '<del>' + inner + '</del>';
          else if (run === 1) out += '<em>' + inner + '</em>';
          else if (run === 2) out += '<strong>' + inner + '</strong>';
          else out += '<em><strong>' + inner + '</strong></em>';
          i = close + run + extra; continue;
        }
      }
      if (run > (c === 126 ? 2 : 3)) return null;
      if (run > 1 && src.indexOf(c === 42 ? '**' : c === 95 ? '__' : '~~', i + run) >= 0) return null;
      out += src.slice(i, i + run); i += run; continue;
    }
    if (c === 60 || c === 62 || c === 34 || c === 39) {
      out += c === 60 ? '&lt;' : c === 62 ? '&gt;' : c === 34 ? '&quot;' : '&#39;'; i++; continue;
    }
    const from = i;
    while (i < end) {
      const x = src.charCodeAt(i);
      if (x === 96 || x === 38 || x === 92 || x === 10 || x === 13 || x === 32 || x === 91 || x === 33 || x === 42 || x === 95 || x === 126 || x === 60 || x === 62 || x === 34 || x === 39) break;
      if (x === 64) break;
      if ((x === 104 || x === 72 || x === 102 || x === 70 || x === 119 || x === 87 || x === 120 || x === 88) &&
          (i === start || !(ALNUM(src.charCodeAt(i - 1)) || src.charCodeAt(i - 1) === 95 || src.charCodeAt(i - 1) === 47))) {
        if (!inLink && bareLink(src, i, end)) break;
      }
      i++;
    }
    if (i === from) { out += src[i++]; continue; }
    out += src.slice(from, i);
  }
  return out;
}

function hasUnsafeDelimiterRuns(src) {
  if (!src.includes('*') && !src.includes('_') && !src.includes('~')) return false;
  const runs = [[], [], []];
  for (let which = 0; which < 3; which++) {
    const c = which === 0 ? '*' : which === 1 ? '_' : '~';
    let i = src.indexOf(c);
    while (i >= 0) {
      let end = i + 1;
      while (end < src.length && src.charCodeAt(end) === c.charCodeAt(0)) end++;
      runs[which].push([i, end]);
      if (runs[which].length > 2) return true;
      i = src.indexOf(c, end);
    }
  }
  const a = runs[0].length === 2 ? [runs[0][0][0], runs[0][1][1]] : null;
  const b = runs[1].length === 2 ? [runs[1][0][0], runs[1][1][1]] : null;
  const c = runs[2].length === 2 ? [runs[2][0][0], runs[2][1][1]] : null;
  return !!(a && b && a[0] < b[1] && b[0] < a[1] || a && c && a[0] < c[1] && c[0] < a[1] || b && c && b[0] < c[1] && c[0] < b[1]);
}

function hasParenBareUrl(src) {
  for (let i = src.indexOf('('); i >= 0; i = src.indexOf('(', i + 1)) {
    if (src.charCodeAt(i - 1) === 93) continue;
    const j = i + 1, a = LOWER(src.charCodeAt(j)), b = LOWER(src.charCodeAt(j + 1)), c = LOWER(src.charCodeAt(j + 2));
    if (a === 104 && b === 116 && c === 116 || a === 102 && b === 116 && c === 112 ||
        src.startsWith('www.', j)) return true;
  }
  return false;
}

export function renderInline(src, refs = null) {
  if (typeof src !== 'string') return null;
  if (!FAST_SPECIAL.test(src)) return src;
  if (src.length > 600) return null;
  if (src.includes('xmpp:')) return null;
  if (src.includes('](') && hasParenBareUrl(src)) return null;
  if (hasUnsafeDelimiterRuns(src)) return null;
  if (src.includes('[') && src.includes(String.fromCharCode(96)) && hasCrossingCodeBracket(src)) return null;
  return renderRange(src, 0, src.length, refs, 0, false);
}
