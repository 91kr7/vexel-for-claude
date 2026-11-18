#!/usr/bin/env node
// Demo stand-in for the `claude` command, only for the README screenshots (see capture.ts).
// It never calls Claude. It draws a scripted Claude Code screen of invented text for the folder it runs in,
// and draws it again when the terminal changes its size.
const COLS_MIN = 30;

const ORANGE = '38;2;215;119;87';
const GREEN = '38;2;78;186;101';
const RED = '38;2;255;107;128';
const GRAY = '38;2;136;136;136';
const DIM = '38;2;105;105;105';
const WHITE = '39';
const BLUE = '38;2;122;162;247';
const ADD = '48;2;28;68;38;38;2;212;240;216';
const DEL = '48;2;90;32;40;38;2;250;214;218';

const text = (color, value) => ({ color, value });
const row = (...segs) => ({ segs });
const blank = () => ({ segs: [] });
// A paragraph: wrapped at the terminal width, with `lead` in the first row and spaces in the others.
const prose = (lead, leadColor, value, color = WHITE) => ({ prose: { lead, leadColor, value, color } });

const banner = (folder) => [
  row(text(ORANGE, ' ▐▛███▜▌   '), text(WHITE, 'Claude Code '), text(GRAY, 'v2.1.4')),
  row(text(ORANGE, '▝▜█████▛▘  '), text(GRAY, 'Opus 5.5 · Claude Max')),
  row(text(ORANGE, '  ▘▘ ▝▝    '), text(GRAY, folder)),
  blank(),
];
const user = (value) => prose('> ', GRAY, value, WHITE);
const say = (value) => prose('● ', WHITE, value);
const tool = (name, argument) => row(text(GREEN, '● '), text(WHITE, `${name}(${argument})`));
const result = (value, color = GRAY) => row(text(GRAY, '  ⎿  '), text(color, value));
const resultMore = (value, color = GRAY) => row(text(GRAY, '     '), text(color, value));
const diffRow = (number, mark, code) => {
  const style = mark === '+' ? ADD : mark === '-' ? DEL : GRAY;
  return row(text(GRAY, '     '), text(style, `${String(number).padStart(4)} ${mark} ${code}`));
};

const SCENES = {
  'shop-api': {
    folder: '/home/maya/projects/shop-api',
    content: [
      user('Add idempotency keys to the payment webhook so a retried event is not applied twice'),
      blank(),
      say('I will start with how the webhook handler works today.'),
      blank(),
      tool('Read', 'src/payments/webhook.ts'),
      result('Read 142 lines'),
      blank(),
      say('The handler has no memory of events it has seen. I will keep the event id in the `processed_events` table and skip a repeat.'),
      blank(),
      tool('Update', 'src/payments/webhook.ts'),
      result('Updated src/payments/webhook.ts with 14 additions and 2 removals'),
      diffRow(41, ' ', 'export async function handleWebhook(req: Request) {'),
      diffRow(42, ' ', '  const event = verifySignature(req);'),
      diffRow(43, '-', '  await applyEvent(event);'),
      diffRow(43, '+', '  const fresh = await markProcessed(event.id);'),
      diffRow(44, '+', '  if (!fresh) return new Response(null, { status: 200 });'),
      diffRow(45, '+', '  await applyEvent(event);'),
      diffRow(46, ' ', '  return new Response(null, { status: 204 });'),
      diffRow(47, ' ', '}'),
      blank(),
      tool('Write', 'src/payments/processed-events.ts'),
      result('Wrote 31 lines to src/payments/processed-events.ts'),
      blank(),
      say('Now the tests: a first delivery, a retry, and two events at the same time.'),
      blank(),
      tool('Bash', 'npm test -- --run payments'),
      result('Running…', GRAY),
    ],
    footer: [
      row(text(ORANGE, '✻ Running tests… '), text(GRAY, '(23s · ↓ 1.4k tokens · esc to interrupt)')),
    ],
  },
  'docs-site': {
    folder: '/home/maya/work/docs-site',
    content: [
      user('Rebuild the search index and publish the preview'),
      blank(),
      say('I will rebuild the index first, then push the preview build.'),
      blank(),
      tool('Bash', 'npm run build:search'),
      result('> docs-site@3.2.0 build:search'),
      resultMore('> node scripts/build-search-index.mjs'),
      resultMore('Indexed 214 pages in 1.8s'),
      blank(),
      say('The index is ready. Publishing needs your approval.'),
      blank(),
      row(text(ORANGE, '╭─ '), text(WHITE, 'Bash command')),
      row(text(ORANGE, '│')),
      row(text(ORANGE, '│  '), text(WHITE, 'npm run deploy:preview -- --branch docs-refresh')),
      row(text(ORANGE, '│  '), text(GRAY, 'Publish the preview build')),
      row(text(ORANGE, '│')),
      row(text(ORANGE, '│  '), text(WHITE, 'Do you want to proceed?')),
      row(text(ORANGE, '│  '), text(BLUE, '❯ 1. Yes')),
      row(text(ORANGE, '│    '), text(GRAY, '2. Yes, and do not ask again for npm run commands')),
      row(text(ORANGE, '│    '), text(GRAY, '3. No, and tell Claude what to do differently (esc)')),
      row(text(ORANGE, '╰─')),
    ],
    footer: [],
  },
  'mobile-app': {
    folder: '/home/maya/projects/mobile-app',
    content: [
      user('Fix the crash when the cart is empty on the checkout screen'),
      blank(),
      tool('Read', 'src/screens/Checkout.tsx'),
      result('Read 96 lines'),
      tool('Update', 'src/screens/Checkout.tsx'),
      result('Updated src/screens/Checkout.tsx with 4 additions and 1 removal'),
      tool('Bash', 'npm test -- Checkout'),
      result('Tests: 12 passed, 12 total'),
      blank(),
      say('Fixed. The total is now computed from `cart.items ?? []`, so an empty cart shows a zero total and the pay button stays disabled. The new test `shows an empty state` covers it.'),
    ],
    footer: [],
  },
  'data-pipeline': {
    folder: '/home/maya/work/data-pipeline',
    content: [
      user('Why is the nightly import slower since Monday?'),
      blank(),
      say('The import now reads every partition twice. I added a note to `docs/import.md`. Closing the session.'),
    ],
    footer: [],
    exitAfterMs: 1500,
  },
};

const sceneOf = () => {
  const folder = process.cwd().split('/').pop() ?? '';
  return SCENES[folder] ?? SCENES['shop-api'];
};

function wrap(value, width) {
  const words = value.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if (current !== '' && (current + ' ' + word).length > width) {
      lines.push(current);
      current = word;
    } else {
      current = current === '' ? word : `${current} ${word}`;
    }
  }
  if (current !== '') lines.push(current);
  return lines;
}

const paint = (color, value) => (value === '' ? '' : `\x1b[${color}m${value}\x1b[0m`);

function cut(segs, columns) {
  const out = [];
  let used = 0;
  for (const { color, value } of segs) {
    const room = columns - used;
    if (room <= 0) break;
    if (value.length > room) {
      out.push(paint(color, value.slice(0, room - 1) + '…'));
      used = columns;
      break;
    }
    out.push(paint(color, value));
    used += value.length;
  }
  return out.join('');
}

function render(scene) {
  const columns = Math.max(COLS_MIN, process.stdout.columns || 100);
  const rows = Math.max(10, process.stdout.rows || 30);
  const lines = [];
  for (const item of [...banner(scene.folder), ...scene.content]) {
    if (item.prose) {
      const { lead, leadColor, value, color } = item.prose;
      wrap(value, columns - lead.length - 1).forEach((part, index) =>
        lines.push(cut([text(leadColor, index === 0 ? lead : ' '.repeat(lead.length)), text(color, part)], columns)),
      );
    } else {
      lines.push(cut(item.segs, columns));
    }
  }
  const rule = paint(DIM, '─'.repeat(columns));
  const footer = [
    ...scene.footer.map((item) => cut(item.segs, columns)),
    rule,
    cut([text(WHITE, '> ')], columns),
    rule,
    cut([text(GRAY, '  ? for shortcuts')], columns),
  ];
  const room = Math.max(0, rows - footer.length);
  const shown = lines.slice(-room);
  while (shown.length < room) shown.push('');
  process.stdout.write('\x1b[?25l\x1b[2J\x1b[3J\x1b[H' + [...shown, ...footer].join('\r\n'));
}

const scene = sceneOf();
process.stdin.setRawMode?.(true);
process.stdin.resume();
render(scene);
process.on('SIGWINCH', () => render(scene));
if (scene.exitAfterMs) setTimeout(() => process.exit(0), scene.exitAfterMs);
else setInterval(() => {}, 1 << 30);
