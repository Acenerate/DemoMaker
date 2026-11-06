// File writes that ride out brief locks. Sync tools (Dropbox, OneDrive) and virus scanners open new or
// changed files for a moment, and on Windows a write during that moment fails with EBUSY, EPERM or
// UNKNOWN. These helpers retry for a few seconds before giving up.
const fs = require('fs');

const TRANSIENT = new Set(['EBUSY', 'EPERM', 'EACCES', 'UNKNOWN', 'ENOTEMPTY']);

function retry(fn) {
  for (let i = 0; ; i++) {
    try { return fn(); } catch (e) {
      if (!TRANSIENT.has(e.code) || i >= 25) throw e;
      const until = Date.now() + 200;
      while (Date.now() < until) { /* brief synchronous wait */ }
    }
  }
}

const writeFile = (file, data) => retry(() => fs.writeFileSync(file, data));
const unlink = file => retry(() => fs.unlinkSync(file));
const removeDir = dir => retry(() => fs.rmSync(dir, { recursive: true, force: true }));

module.exports = { retry, writeFile, unlink, removeDir };
