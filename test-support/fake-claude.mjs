#!/usr/bin/env node
// Stand-in for the Claude Code CLI in tests. It reports what it received and never calls Claude.
//
// On start it prints its cwd, arguments, terminal variables and size.
// Every input chunk is echoed as `IN:<hex>`; every line ended by Enter as `LINE:<text>`.
// Line commands: STREAM (5 chunks, 300 ms apart), ASK (waits for one key, then ANSWER:<key>),
// COUNT (400 numbered lines, 5 ms apart), /exit (exits with code 0).

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

let line = '';
let waitingAnswer = false;

function runLine(text) {
  out(`LINE:${text}`);
  if (text === '/exit') {
    out('BYE');
    process.exit(0);
  } else if (text === 'STREAM') {
    let n = 0;
    const timer = setInterval(() => {
      n += 1;
      out(`CHUNK${n}`);
      if (n === 5) clearInterval(timer);
    }, 300);
  } else if (text === 'ASK') {
    waitingAnswer = true;
    out('PERMISSION?(y/n)');
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
  }
}

process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  out(`IN:${Buffer.from(chunk, 'utf8').toString('hex')}`);
  if (waitingAnswer) {
    waitingAnswer = false;
    out(`ANSWER:${chunk}`);
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
