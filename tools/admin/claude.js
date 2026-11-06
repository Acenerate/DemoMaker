// Runs Claude Code (the `claude` command-line tool) in the project folder for the admin's Ask Claude
// panel, and turns its streamed output into simple events the page can show. One run at a time; a
// follow-up message continues the same conversation.
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

// What Claude may do without asking (nobody is there to answer a permission prompt): read and edit
// project files, and run the project's checking tools. Anything that spends ElevenLabs credits is blocked.
const ALLOWED = [
  'Read', 'Edit', 'Write', 'Glob', 'Grep', 'TodoWrite',
  'Bash(node tools/check-walkthrough.js:*)', 'Bash(node tools/export-transcript.js:*)', 'Bash(node tools/snapshot-walkthrough.js:*)',
  'Bash(node tools/read-docs.js:*)',
  'Bash(ls:*)', 'Bash(mkdir:*)', 'Bash(cp:*)'
];
// Deletes are blocked too: in this permission mode Claude Code would otherwise allow rm inside the project.
const BLOCKED = ['Bash(node tools/make-voiceover.js:*)', 'Bash(curl:*)', 'WebSearch',
  'Bash(rm:*)', 'Bash(rmdir:*)', 'Bash(del:*)', 'Bash(Remove-Item:*)', 'PowerShell'];

function findClaude() {
  const home = os.homedir();
  const candidates = [process.env.CLAUDE_PATH,
    path.join(home, '.local', 'bin', process.platform === 'win32' ? 'claude.exe' : 'claude'),
    process.env.APPDATA && path.join(process.env.APPDATA, 'npm', 'claude.cmd'),
    '/usr/local/bin/claude', '/opt/homebrew/bin/claude'];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    candidates.push(path.join(dir, process.platform === 'win32' ? 'claude.exe' : 'claude'));
  }
  return candidates.find(p => p && fs.existsSync(p)) || null;
}

const rel = p => (p ? path.relative(ROOT, path.resolve(ROOT, String(p))).split(path.sep).join('/') : '');

// A one-line description of a tool call, for the activity list.
function describeTool(name, input = {}) {
  switch (name) {
    case 'Read': return `Reading ${rel(input.file_path)}`;
    case 'Write': return `Writing ${rel(input.file_path)}`;
    case 'Edit': case 'MultiEdit': return `Editing ${rel(input.file_path)}`;
    case 'Glob': return `Finding files: ${input.pattern}`;
    case 'Grep': return `Searching for "${input.pattern}"${input.path ? ' in ' + rel(input.path) : ''}`;
    case 'Bash': return `Running: ${String(input.command || '').slice(0, 160)}`;
    case 'TodoWrite': return `Planning: ${(input.todos || []).map(t => t.content).slice(0, 4).join(' · ')}`;
    case 'WebFetch': return `Fetching ${input.url}`;
    case 'Task': case 'Agent': return `Delegating: ${input.description || ''}`;
    default: return name;
  }
}

function createRunner() {
  const state = { running: false, sessionId: null, events: [], proc: null };
  const push = e => { e.n = state.events.length; e.t = Date.now(); state.events.push(e); };

  function start(prompt) {
    if (state.running) throw new Error('Claude is already working. Wait for it to finish, or press Stop.');
    const exe = findClaude();
    if (!exe) throw new Error('Claude Code is not installed (the claude command was not found). Install it, run `claude` once to sign in, then try again.');
    prompt = String(prompt || '').trim();
    if (!prompt) throw new Error('Type a request first.');

    const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits',
      '--allowedTools', ALLOWED.join(','), '--disallowedTools', BLOCKED.join(',')];
    if (state.sessionId) args.push('--resume', state.sessionId);

    if (state.proc) kill(state.proc);   // the last run's process, still winding down after its result
    push({ kind: 'user', text: prompt });
    state.running = true; state.quiet = false; state.stopping = false;
    const proc = spawn(exe, args, { cwd: ROOT, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], shell: /\.cmd$/i.test(exe) });
    state.proc = proc;
    let buf = '', err = '', gotResult = false;
    const calls = {};   // tool_use id -> { name, command }, to explain each result
    const resultText = c => (Array.isArray(c.content) ? c.content.map(x => x.text || '').join(' ') : String(c.content || '')).trim();

    proc.stdout.on('data', d => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        let m;
        try { m = JSON.parse(line); } catch (e) { continue; }
        if (m.session_id) state.sessionId = m.session_id;
        if (m.type === 'assistant' && m.message && Array.isArray(m.message.content)) {
          for (const c of m.message.content) {
            if (c.type === 'text' && c.text.trim()) push({ kind: 'text', text: c.text });
            if (c.type === 'tool_use') {
              calls[c.id] = { name: c.name, command: String((c.input || {}).command || '') };
              push({ kind: 'tool', name: c.name, text: describeTool(c.name, c.input) });
            }
          }
        } else if (m.type === 'user' && m.message && Array.isArray(m.message.content)) {
          for (const c of m.message.content) {
            if (c.type !== 'tool_result') continue;
            const call = calls[c.tool_use_id] || {}, t = resultText(c);
            const isCheck = /check-walkthrough\.js/.test(call.command || '');
            if (c.is_error && /requires approval|can.t be checked|permission|not allowed|denied|blocked/i.test(t)) {
              push({ kind: 'blocked', text: 'Blocked: that command needs approval, which the panel can\'t give. Claude will try another way.' });
            } else if (isCheck && /PASS\s/.test(t) && !/FAIL\s/.test(t)) {
              push({ kind: 'check-ok', text: 'Check passed: plays start to finish with no errors.' });
            } else if (isCheck && /FAIL\s/.test(t)) {
              const fails = t.split(/(?=FAIL\s)/).filter(x => x.startsWith('FAIL')).map(x => x.replace(/^FAIL\s+/, '').trim()).slice(0, 3);
              push({ kind: 'check-fail', text: 'Check found problems; Claude is fixing them: ' + fails.join(' · ').slice(0, 300) });
            } else if (c.is_error) {
              push({ kind: 'tool-error', text: t.slice(0, 300) });
            }
          }
        } else if (m.type === 'result') {
          gotResult = true;
          push({ kind: m.is_error ? 'error' : 'done', text: m.is_error ? (m.result || m.subtype || 'Claude stopped with an error') : '', seconds: Math.round((m.duration_ms || 0) / 1000), turns: m.num_turns, cost: m.total_cost_usd });
          // The result is the end of the run, even if the process (or something it started) lingers.
          state.running = false;
          setTimeout(() => { if (state.proc === proc) { state.quiet = true; kill(proc); } }, 5000);
        }
      }
    });
    proc.stderr.on('data', d => { err += d; });
    proc.on('error', e => { push({ kind: 'error', text: e.message }); });
    proc.on('close', code => {
      if (state.proc !== proc) return;
      if (state.stopping) push({ kind: 'stopped', text: 'Stopped.' });
      else if (!gotResult && !state.quiet) push({ kind: 'error', text: (err.trim().split('\n').slice(-3).join(' ') || `Claude Code exited (code ${code}).`) + (/log ?in|auth|credential/i.test(err) ? ' Run `claude` in a terminal once to sign in.' : '') });
      state.running = false; state.proc = null; state.stopping = false; state.quiet = false;
    });
  }

  // Ends a run's process and anything it started (a headless Chrome from a check, say).
  function kill(proc) {
    if (process.platform === 'win32') execFile('taskkill', ['/pid', String(proc.pid), '/T', '/F'], () => {});
    else proc.kill('SIGTERM');
  }

  function stop() {
    if (!state.proc || !state.running) return;
    state.stopping = true;
    kill(state.proc);
  }

  function reset() {
    if (state.running) throw new Error('Stop Claude before starting a new conversation.');
    state.sessionId = null; state.events = [];
  }

  function status(since = 0) {
    return { installed: !!findClaude(), running: state.running, sessionId: state.sessionId, events: state.events.slice(since), total: state.events.length };
  }

  return { start, stop, reset, status };
}

module.exports = { createRunner, findClaude };
