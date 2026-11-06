#!/usr/bin/env node
// Stand-in for the Claude Code CLI in tests. It reports what it received and never calls Claude.
//
// On start it prints its cwd, arguments, terminal variables and size.
// Every input chunk is echoed as `IN:<hex>`; every line ended by Enter as `LINE:<text>`.
// Line commands: STREAM (5 chunks, 300 ms apart), ASK (waits for one key, then ANSWER:<key>),
// COUNT (400 numbered lines, 5 ms apart), LINKS (web addresses and OSC 8 hyperlinks, see printLinks),
// /exit (exits with code 0), /crash <code> (exits with that code), /pid (prints PID:<pid>).
// With `--settings <file>` it runs the file's hooks like Claude Code: UserPromptSubmit for every line
// not starting with `/` or `HOOK `, plus TURN (Stop after 1.5 s), WORK (tool use, TICK<n> every 250 ms
// for 30 s, then Stop), PERM (PermissionRequest, waits for one key, then Stop) and
// `HOOK <event> [field=value ...]` (fires that single event).
// Hook events carry `session_id` = the `--resume <id>` value, `fake` without it.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const out = (text) => process.stdout.write(`${text}\r\n`);

out('FAKE-CLI');
out(`CWD:${process.cwd()}`);
out(`ARGS:${JSON.stringify(process.argv.slice(2))}`);
out(`TERM:${process.env.TERM ?? ''}`);
out(`COLORTERM:${process.env.COLORTERM ?? ''}`);
out(`MARK:${process.env.FAKE_CLI_MARK ?? ''}`);
out(`SIZE:${process.stdout.columns}x${process.stdout.rows}`);
out('READY');

process.on('SIGWINCH', () => out(`WINCH:${process.stdout.columns}x${process.stdout.rows}`));

const settingsIndex = process.argv.indexOf('--settings');
const resumeIndex = process.argv.indexOf('--resume');
const claudeSessionId = resumeIndex > 0 ? process.argv[resumeIndex + 1] : 'fake';
const hooks = settingsIndex > 0 ? JSON.parse(readFileSync(process.argv[settingsIndex + 1], 'utf8')).hooks ?? {} : {};

function matches(matcher, target) {
  if (matcher === undefined || matcher === '' || matcher === '*') return true;
  return new RegExp(`^(?:${matcher})$`).test(target ?? '');
}

function fireHook(input) {
  const target = input.tool_name ?? input.notification_type;
  for (const group of hooks[input.hook_event_name] ?? []) {
    if (!matches(group.matcher, target)) continue;
    for (const hook of group.hooks ?? []) {
      execFileSync('sh', ['-c', hook.command], { input: JSON.stringify({ session_id: claudeSessionId, cwd: process.cwd(), ...input }) });
    }
  }
}

// Rows for the link tests. HARD is broken at the terminal width with CR LF, as Claude Code breaks long lines itself.
function printLinks() {
  const hyperlink = (address, text) => `\x1b]8;;${address}\x07${text}\x1b]8;;\x07`;
  out('WEB:see https://example.test/plain/page.');
  out('PAREN:(https://example.test/paren/x),');
  out(`SOFT:https://example.test/soft/${'a'.repeat(260)}.`);
  const hard = `HARD:https://example.test/hard/${'b'.repeat(260)}. done`;
  const columns = process.stdout.columns;
  const rows = [];
  for (let start = 0; start < hard.length; start += columns) rows.push(hard.slice(start, start + columns));
  out(rows.join('\r\n'));
  out(`OSC8:${hyperlink('https://example.test/docs/page', 'docs')} end`);
  out(`FILE:${hyperlink('file:///etc/hostname', 'secret')} end`);
  out('LINKS-DONE');
}

let line = '';
let onAnswer;

function runLine(text) {
  out(`LINE:${text}`);
  if (text.startsWith('HOOK ')) {
    const [name, ...fields] = text.slice(5).split(' ');
    fireHook({ hook_event_name: name, ...Object.fromEntries(fields.map((field) => field.split('='))) });
    return;
  }
  if (!text.startsWith('/')) fireHook({ hook_event_name: 'UserPromptSubmit', prompt: text });
  if (text === '/exit') {
    out('BYE');
    process.exit(0);
  } else if (text.startsWith('/crash ')) {
    process.exit(Number(text.slice('/crash '.length)));
  } else if (text === '/pid') {
    out(`PID:${process.pid}`);
  } else if (text === 'STREAM') {
    let n = 0;
    const timer = setInterval(() => {
      n += 1;
      out(`CHUNK${n}`);
      if (n === 5) clearInterval(timer);
    }, 300);
  } else if (text === 'ASK') {
    onAnswer = () => {};
    out('PERMISSION?(y/n)');
  } else if (text === 'LINKS') {
    printLinks();
  } else if (text === 'COUNT') {
    let n = 0;
    const timer = setInterval(() => {
      n += 1;
      out(`L${String(n).padStart(5, '0')}`);
      if (n === 400) {
        clearInterval(timer);
        out('COUNT-DONE');
      }
    }, 5);
  } else if (text === 'TURN') {
    setTimeout(() => {
      out('TURN-DONE');
      fireHook({ hook_event_name: 'Stop' });
    }, 1500);
  } else if (text === 'WORK') {
    fireHook({ hook_event_name: 'PreToolUse', tool_name: 'Bash' });
    let n = 0;
    const timer = setInterval(() => {
      n += 1;
      out(`TICK${n}`);
      if (n === 120) {
        clearInterval(timer);
        fireHook({ hook_event_name: 'Stop' });
      }
    }, 250);
  } else if (text === 'PERM') {
    fireHook({ hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
    onAnswer = () => fireHook({ hook_event_name: 'Stop' });
    out('PERMISSION?(y/n)');
  }
}

process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  out(`IN:${Buffer.from(chunk, 'utf8').toString('hex')}`);
  if (onAnswer) {
    const answered = onAnswer;
    onAnswer = undefined;
    out(`ANSWER:${chunk}`);
    answered();
    return;
  }
  for (const ch of chunk) {
    if (ch === '\r') {
      const text = line;
      line = '';
      runLine(text);
    } else if (ch === '\x7f') {
      line = line.slice(0, -1);
    } else if (ch >= ' ') {
      line += ch;
    }
  }
});
