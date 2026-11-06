// Edits values inside a walkthrough.js without touching anything else in the file: a narration line's
// text, or a top-level setting (title, subtitle, tempo, captions, narration mode). A small tokenizer finds the
// exact source range of the value, so comments, formatting and animation code are left as they are.
// Every edit is checked by loading the result (see tools/admin/server.js), never trusted blind.

// Tokens: { t: 'str' | 'tmpl' | 'num' | 'id' | 'p' (punctuation), v, s (start), e (end) }.
function tokenize(src) {
  const out = [];
  let i = 0;
  const n = src.length;
  const isId = c => /[A-Za-z0-9_$]/.test(c);
  // After these, a '/' starts a regex rather than a division.
  const regexAfter = t => !t || (t.t === 'p' && !/[)\]}]/.test(t.v)) || (t.t === 'id' && /^(return|typeof|case|in|of|new|delete|void|throw)$/.test(t.v));

  function skipString(q, j) {
    for (j++; j < n; j++) {
      if (src[j] === '\\') { j++; continue; }
      if (src[j] === q) return j + 1;
    }
    throw new Error('Unterminated string');
  }
  function skipTemplate(j) {
    for (j++; j < n; j++) {
      const c = src[j];
      if (c === '\\') { j++; continue; }
      if (c === '`') return j + 1;
      if (c === '$' && src[j + 1] === '{') j = skipExpr(j + 2) - 1;
    }
    throw new Error('Unterminated template');
  }
  // Skips a ${...} expression body; returns the index after its closing brace.
  function skipExpr(j) {
    let depth = 1;
    while (j < n) {
      const c = src[j];
      if (c === '"' || c === "'") j = skipString(c, j);
      else if (c === '`') j = skipTemplate(j);
      else if (c === '/' && src[j + 1] === '/') { while (j < n && src[j] !== '\n') j++; }
      else if (c === '/' && src[j + 1] === '*') { j = src.indexOf('*/', j + 2) + 2; }
      else { if (c === '{') depth++; else if (c === '}' && --depth === 0) return j + 1; j++; }
    }
    throw new Error('Unterminated ${}');
  }

  while (i < n) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 2; continue; }
    if (c === '"' || c === "'") { const e = skipString(c, i); out.push({ t: 'str', s: i, e }); i = e; continue; }
    if (c === '`') { const e = skipTemplate(i); out.push({ t: 'tmpl', s: i, e }); i = e; continue; }
    if (c === '/' && regexAfter(out[out.length - 1])) {
      let j = i + 1, cls = false;
      for (; j < n; j++) {
        if (src[j] === '\\') { j++; continue; }
        if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false;
        else if (src[j] === '/' && !cls) break;
      }
      j++;
      while (j < n && /[a-z]/i.test(src[j])) j++;
      out.push({ t: 'p', v: 'regex', s: i, e: j }); i = j; continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) {
      let j = i; while (j < n && /[0-9.eE_xXa-fA-F]/.test(src[j])) j++;
      out.push({ t: 'num', v: src.slice(i, j), s: i, e: j }); i = j; continue;
    }
    if (isId(c)) { let j = i; while (j < n && isId(src[j])) j++; out.push({ t: 'id', v: src.slice(i, j), s: i, e: j }); i = j; continue; }
    out.push({ t: 'p', v: c, s: i, e: i + 1 }); i++;
  }
  return out;
}

// The JS value of a plain string literal token.
function strValue(src, tok) {
  return Function('"use strict"; return (' + src.slice(tok.s, tok.e) + ');')();
}

// A string literal for text, in the file's style: single quotes, or double when the text has an apostrophe.
function quote(text) {
  if (!text.includes("'")) return "'" + text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r') + "'";
  return JSON.stringify(text);
}

const OPEN = { '{': '}', '[': ']', '(': ')' };

// Index of the token that closes the bracket at index k.
function matchClose(toks, k) {
  let depth = 0;
  for (let i = k; i < toks.length; i++) {
    const v = toks[i].t === 'p' ? toks[i].v : null;
    if (v && OPEN[v]) depth++;
    else if (v === '}' || v === ']' || v === ')') { if (--depth === 0) return i; }
  }
  throw new Error('Unbalanced brackets');
}

// Direct properties of the object literal whose '{' is token k: { key: { k (key token), vs, ve } }
// where vs..ve (inclusive) are the value's tokens.
function props(toks, k) {
  const end = matchClose(toks, k), out = {};
  let i = k + 1;
  while (i < end) {
    const key = toks[i];
    let vs = i;
    if ((key.t === 'id' || key.t === 'str') && toks[i + 1] && toks[i + 1].v === ':') vs = i + 2;
    let j = vs, depth = 0;
    for (; j < end; j++) {
      const v = toks[j].t === 'p' ? toks[j].v : null;
      if (v && OPEN[v]) depth++;
      else if (v === '}' || v === ']' || v === ')') depth--;
      else if (v === ',' && depth === 0) break;
    }
    if (vs !== i) out[key.t === 'id' ? key.v : null] = { k: i, vs, ve: j - 1 };
    i = j + 1;
  }
  return out;
}

// Elements of the array literal whose '[' is token k: [{ vs, ve }].
function elements(toks, k) {
  const end = matchClose(toks, k), out = [];
  let i = k + 1;
  while (i < end) {
    let j = i, depth = 0;
    for (; j < end; j++) {
      const v = toks[j].t === 'p' ? toks[j].v : null;
      if (v && OPEN[v]) depth++;
      else if (v === '}' || v === ']' || v === ')') depth--;
      else if (v === ',' && depth === 0) break;
    }
    if (j > i) out.push({ vs: i, ve: j - 1 });
    i = j + 1;
  }
  return out;
}

// The '{' token of the object passed to KZWalkthrough.create(...).
function createObject(toks) {
  for (let i = 0; i + 3 < toks.length; i++) {
    if (toks[i].v === 'KZWalkthrough' && toks[i + 1].v === '.' && toks[i + 2].v === 'create' && toks[i + 3].v === '(' && toks[i + 4] && toks[i + 4].v === '{') return i + 4;
  }
  throw new Error('KZWalkthrough.create({ ... }) not found');
}

const splice = (src, s, e, text) => src.slice(0, s) + text + src.slice(e);

// The string-literal token holding the text of line `index` of chapter `chapterId`.
function lineToken(src, toks, chapterId, index) {
  const root = props(toks, createObject(toks));
  if (!root.chapters || toks[root.chapters.vs].v !== '[') throw new Error('chapters: [ ... ] not found');
  for (const ch of elements(toks, root.chapters.vs)) {
    if (toks[ch.vs].v !== '{') continue;
    const p = props(toks, ch.vs);
    if (!p.id || toks[p.id.vs].t !== 'str' || strValue(src, toks[p.id.vs]) !== chapterId) continue;
    if (!p.lines || toks[p.lines.vs].v !== '[') throw new Error(`Chapter ${chapterId}: lines: [ ... ] not found`);
    const el = elements(toks, p.lines.vs)[index];
    if (!el) throw new Error(`Chapter ${chapterId} has no line ${index + 1}`);
    if (el.vs === el.ve && toks[el.vs].t === 'str') return toks[el.vs];
    if (toks[el.vs].v === '{') {
      const lp = props(toks, el.vs);
      if (lp.text && lp.text.vs === lp.text.ve && toks[lp.text.vs].t === 'str') return toks[lp.text.vs];
    }
    throw new Error(`Line ${chapterId}-${index + 1} is not a plain string, so it can only be edited in walkthrough.js`);
  }
  throw new Error(`No chapter with id '${chapterId}'`);
}

function setLine(src, chapterId, index, text) {
  const tok = lineToken(src, tokenize(src), chapterId, index);
  return splice(src, tok.s, tok.e, quote(text));
}

// Sets a top-level setting. kind: 'string' (title, subtitle), 'number' (tempo) or 'boolean' (captions). Missing settings are
// added after the narration line (or at the start of the object).
function setSetting(src, key, value, kind) {
  const toks = tokenize(src), k = createObject(toks), root = props(toks, k);
  const literal = kind === 'number' ? String(+value) : kind === 'boolean' ? String(!!value) : quote(String(value));
  const plain = t => (kind === 'boolean' ? t.t === 'id' && /^(true|false)$/.test(t.v) : t.t === (kind === 'number' ? 'num' : 'str'));
  const p = root[key];
  if (p) {
    if (p.vs !== p.ve || !plain(toks[p.vs])) throw new Error(`${key} is not a plain ${kind}, so it can only be edited in walkthrough.js`);
    return splice(src, toks[p.vs].s, toks[p.vs].e, literal);
  }
  const after = root.narration || root.subtitle || root.title;
  const anchor = after ? toks[after.ve + 1] : toks[k];   // the comma after it, or the '{'
  const lineEnd = src.indexOf('\n', anchor.e);
  const indent = (src.slice(src.lastIndexOf('\n', toks[(after || { k: k + 1 }).k].s) + 1).match(/^\s*/) || [''])[0];
  return splice(src, lineEnd, lineEnd, `\n${indent}${key}: ${literal},`);
}

// Sets narration.mode ('transcript' | 'audio' | 'speech').
function setNarrationMode(src, mode) {
  const toks = tokenize(src), root = props(toks, createObject(toks));
  const n = root.narration;
  if (!n) return setSetting(src, 'narration', '', 'string').replace(/narration: '',/, `narration: { mode: ${quote(mode)} },`);
  if (toks[n.vs].v !== '{') throw new Error('narration is not an object literal');
  const m = props(toks, n.vs).mode;
  if (!m || toks[m.vs].t !== 'str') throw new Error('narration.mode not found');
  return splice(src, toks[m.vs].s, toks[m.vs].e, quote(mode));
}

module.exports = { tokenize, setLine, setSetting, setNarrationMode, quote };
