// Captures the screenshots of README.md from the real web client with invented demo data.
//
// How to run (from the repository root, after `npm install`):
//   npm run build && npx tsx e2e/readme-screenshots/capture.ts [shot ...]
// Without a shot name every shot is captured. The PNG files go to docs/screenshots, or to the folder in OUT_DIR.
// CAPTURE_PORT sets the port of the demo server (default 3390, never below 3300).
//
// SAFETY: this script must only ever talk to its own demo server. It never reads `PORT`, `AI_CLIENT_*` or
// `CLAUDE_CONFIG_DIR` from the environment: a shell that exports `PORT=4001` would point it at a real Vexel
// server, and the demo sessions would start the real `claude`. It refuses a busy port, checks that its own
// child process runs, and gives the server a PATH without any real `claude`.
//
// The script builds a demo world in /tmp/vexel-demo: git repositories with invented authors, a Claude Code
// folder with invented history, and a demo `claude` command (demo-claude.mjs) that draws scripted text.
// It starts its own backend on that world, takes the shots with Playwright and removes the world again.
// It never reads the real `~/.claude` and never calls Claude. This file is not a spec: `playwright test` ignores it.
/// <reference lib="dom" />
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { statSync } from 'node:fs';
import { appendFile, chmod, mkdir, rm, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type BrowserContext, type Page, chromium } from '@playwright/test';
import { pageSettled } from '../motion';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const OUT_DIR = path.resolve(process.env.OUT_DIR ?? path.join(repoRoot, 'docs/screenshots'));
const PORT = Number(process.env.CAPTURE_PORT ?? 3390);
if (!Number.isInteger(PORT) || PORT < 3300 || PORT > 65535 || PORT === 4001 || PORT === 3000) {
  throw new Error(`CAPTURE_PORT ${process.env.CAPTURE_PORT} is not allowed: use a free port from 3300 up, never 3000 or 4001`);
}
const BASE = `http://127.0.0.1:${PORT}`;

// The demo world. Folders live under HOME_REAL; the page shows them as HOME_SHOWN.
const WORLD = '/tmp/vexel-demo';
const HOME_REAL = `${WORLD}/maya`;
const HOME_SHOWN = '/home/maya';
const CLAUDE_DIR = `${WORLD}/claude`;
const DATA_DIR = `${WORLD}/data`;
const BIN_DIR = `${WORLD}/bin`;

// Longest folder first. The text of the page shows the second column for the first.
const HOME_PAIRS: [string, string][] = [[HOME_REAL, HOME_SHOWN], [WORLD, '/home']];

const projectDir = (name: string) => `${HOME_REAL}/${name}`;
const SHOP_API = projectDir('projects/shop-api');
const DOCS_SITE = projectDir('work/docs-site');
const MOBILE_APP = projectDir('projects/mobile-app');
const DATA_PIPELINE = projectDir('work/data-pipeline');
const BILLING = projectDir('work/billing-service');

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms);

// ---------------------------------------------------------------------------------------------------------------
// Git repositories

const AUTHORS = {
  maya: { name: 'Maya Chen', email: 'maya.chen@shop.example' },
  luis: { name: 'Luis Ortega', email: 'luis.ortega@shop.example' },
  priya: { name: 'Priya Nair', email: 'priya.nair@shop.example' },
  tom: { name: 'Tom Becker', email: 'tom.becker@shop.example' },
} as const;
type Author = keyof typeof AUTHORS;

function git(folder: string, args: string[], env: Record<string, string> = {}): string {
  return execFileSync('git', ['-c', 'commit.gpgsign=false', '-c', 'init.defaultBranch=main', ...args], {
    cwd: folder,
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '', HOME: WORLD, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', TZ: 'UTC', ...env },
  }).trim();
}

async function writeFiles(folder: string, files: Record<string, string>): Promise<void> {
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(folder, file)), { recursive: true });
    await writeFile(path.join(folder, file), content);
  }
}

/** The days are counted back from the fixed date of the shots, so the graph looks the same on every run. */
const at = (day: number, hour: number, minute = 0) => new Date(Date.UTC(2026, 10, day, hour, minute)).toISOString();

async function commit(folder: string, author: Author, when: string, message: string, files: Record<string, string>, merge?: string): Promise<void> {
  const { name, email } = AUTHORS[author];
  const env = { GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email, GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when };
  if (merge) {
    git(folder, ['merge', '--no-ff', '-m', message, merge], env);
    return;
  }
  await writeFiles(folder, files);
  git(folder, ['add', '-A']);
  git(folder, ['commit', '-q', '-m', message], env);
}

const WEBHOOK_BEFORE = `import { verifySignature } from './signature';
import { applyEvent } from './events';

export async function handleWebhook(req: Request): Promise<Response> {
  const event = verifySignature(req);
  await applyEvent(event);
  return new Response(null, { status: 204 });
}
`;

const WEBHOOK_AFTER = `import { verifySignature } from './signature';
import { applyEvent } from './events';
import { markProcessed } from './processed-events';

export async function handleWebhook(req: Request): Promise<Response> {
  const event = verifySignature(req);
  // The provider sends an event again until it gets a 2xx answer.
  const fresh = await markProcessed(event.id);
  if (!fresh) return new Response(null, { status: 200 });
  await applyEvent(event);
  return new Response(null, { status: 204 });
}
`;

const WEBHOOK_TEST_BEFORE = `import { describe, expect, it } from 'vitest';
import { handleWebhook } from './webhook';
import { signedRequest } from './test-helpers';

describe('handleWebhook', () => {
  it('answers 204 for a valid event', async () => {
    const response = await handleWebhook(signedRequest({ id: 'evt_1', type: 'payment.succeeded' }));
    expect(response.status).toBe(204);
  });
});
`;

const WEBHOOK_TEST_AFTER = `import { describe, expect, it } from 'vitest';
import { handleWebhook } from './webhook';
import { signedRequest } from './test-helpers';

describe('handleWebhook', () => {
  it('answers 204 for a valid event', async () => {
    const response = await handleWebhook(signedRequest({ id: 'evt_1', type: 'payment.succeeded' }));
    expect(response.status).toBe(204);
  });

  it('answers 200 and applies nothing for an event it has seen', async () => {
    await handleWebhook(signedRequest({ id: 'evt_2', type: 'payment.succeeded' }));
    const retry = await handleWebhook(signedRequest({ id: 'evt_2', type: 'payment.succeeded' }));
    expect(retry.status).toBe(200);
  });
});
`;

const PROCESSED_EVENTS = `import { db } from '../db';

/** Stores the event id. Gives false when the id was stored before. */
export async function markProcessed(eventId: string): Promise<boolean> {
  const result = await db.query(
    'INSERT INTO processed_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING',
    [eventId],
  );
  return result.rowCount === 1;
}
`;

async function seedShopApi(): Promise<void> {
  const repo = SHOP_API;
  await mkdir(repo, { recursive: true });
  git(repo, ['init', '-q', '-b', 'main']);
  await commit(repo, 'maya', at(2, 9, 12), 'Start the Express app with health and config', {
    'src/server.ts': "import express from 'express';\n\nexport const app = express();\napp.get('/health', (_req, res) => res.json({ ok: true }));\n",
    'package.json': '{ "name": "shop-api", "version": "0.1.0" }\n',
    'README.md': '# shop-api\n\nBackend of the shop.\n',
  });
  await commit(repo, 'luis', at(3, 14, 40), 'Add product catalog endpoints', {
    'src/catalog/routes.ts': "export const catalogRoutes = [];\n",
    'src/catalog/catalog.test.ts': "import { it } from 'vitest';\nit.todo('lists products');\n",
  });
  await commit(repo, 'maya', at(4, 10, 5), 'Add database migrations and seed data', {
    'db/migrations/001_products.sql': 'CREATE TABLE products (id serial PRIMARY KEY, name text NOT NULL, price_cents integer NOT NULL);\n',
    'db/seed.sql': "INSERT INTO products (name, price_cents) VALUES ('Mug', 1200), ('Poster', 1800);\n",
  });
  await commit(repo, 'tom', at(4, 15, 30), 'Add ESLint and Prettier configuration', { '.eslintrc.json': '{ "extends": "standard" }\n' });
  await commit(repo, 'maya', at(4, 17, 10), 'Run tests and lint in CI', { '.github/workflows/ci.yml': 'name: ci\non: [push]\n' });
  const base = git(repo, ['rev-parse', 'HEAD']);

  git(repo, ['checkout', '-q', '-b', 'fix/rounding', base]);
  await commit(repo, 'tom', at(5, 11, 30), 'Round prices to cents after discounts', { 'src/catalog/price.ts': 'export const round = (value: number) => Math.round(value);\n' });
  git(repo, ['checkout', '-q', 'main']);
  await commit(repo, 'luis', at(5, 16, 2), 'Add rate limiting to public endpoints', { 'src/middleware/rate-limit.ts': 'export const rateLimit = () => undefined;\n' });
  await commit(repo, 'tom', at(6, 9, 48), "Merge branch 'fix/rounding'", {}, 'fix/rounding');

  git(repo, ['checkout', '-q', '-b', 'feature/cart', 'main']);
  await commit(repo, 'priya', at(8, 10, 15), 'Add cart model and routes', { 'src/cart/cart.ts': 'export interface Cart { items: string[] }\n' });
  await commit(repo, 'priya', at(8, 15, 50), 'Validate item quantities in the cart', { 'src/cart/validate.ts': 'export const validate = () => true;\n' });
  git(repo, ['checkout', '-q', 'main']);
  await commit(repo, 'tom', at(9, 8, 30), 'Update dependencies', { 'package.json': '{ "name": "shop-api", "version": "0.2.0" }\n' });
  await commit(repo, 'maya', at(9, 17, 20), "Merge branch 'feature/cart'", {}, 'feature/cart');

  git(repo, ['checkout', '-q', '-b', 'feature/search', 'main']);
  await commit(repo, 'luis', at(10, 10, 5), 'Add full-text search to the catalog', { 'src/catalog/search.ts': 'export const search = () => [];\n' });
  await commit(repo, 'luis', at(10, 16, 40), 'Index product names and descriptions', { 'db/migrations/002_search_index.sql': 'CREATE INDEX products_search ON products (name);\n' });
  git(repo, ['checkout', '-q', 'main']);
  await commit(repo, 'priya', at(11, 9, 15), 'Document the API with OpenAPI', { 'docs/openapi.yaml': 'openapi: 3.1.0\n' });
  await commit(repo, 'luis', at(11, 15, 45), "Merge branch 'feature/search'", {}, 'feature/search');
  await commit(repo, 'luis', at(12, 11, 0), 'Log every request with a request id', { 'src/middleware/log.ts': 'export const log = () => undefined;\n' });
  await commit(repo, 'tom', at(13, 14, 5), 'Fix the 500 error for an unknown product id', { 'src/catalog/not-found.ts': 'export const notFound = () => 404;\n' });
  await commit(repo, 'maya', at(14, 9, 0), 'Release 0.3.0', { 'package.json': '{ "name": "shop-api", "version": "0.3.0" }\n' });

  git(repo, ['checkout', '-q', '-b', 'feature/webhooks', 'main']);
  await commit(repo, 'maya', at(16, 10, 20), 'Verify webhook signatures', {
    'src/payments/signature.ts': 'export const verifySignature = (_req: Request) => ({ id: "evt", type: "payment.succeeded" });\n',
    'src/payments/events.ts': 'export const applyEvent = async (_event: unknown) => undefined;\n',
    'src/payments/webhook.ts': WEBHOOK_BEFORE,
    'src/payments/webhook.test.ts': WEBHOOK_TEST_BEFORE,
    'src/payments/test-helpers.ts': 'export const signedRequest = (_body: object) => new Request("http://localhost");\n',
  });
  await commit(repo, 'maya', at(17, 9, 45), 'Add the processed_events table', {
    'db/migrations/002_processed_events.sql': 'CREATE TABLE processed_events (event_id text PRIMARY KEY, seen_at timestamptz NOT NULL DEFAULT now());\n',
  });

  // Uncommitted work: one staged file, two changed files and one new file.
  await writeFiles(repo, {
    'src/payments/webhook.ts': WEBHOOK_AFTER,
    'src/payments/webhook.test.ts': WEBHOOK_TEST_AFTER,
    'src/payments/processed-events.ts': PROCESSED_EVENTS,
    'docs/webhooks.md': '# Webhooks\n\nEvents are applied once.\n',
  });
  git(repo, ['add', 'src/payments/processed-events.ts', 'docs/webhooks.md']);
}

async function seedPlainFolder(folder: string, file = 'README.md'): Promise<void> {
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, file), '# demo\n');
}

// ---------------------------------------------------------------------------------------------------------------
// Claude Code folder, names and favourites

const encoded = (folder: string) => folder.replace(/[^A-Za-z0-9]/g, '-');

interface Usage {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

const userEntry = (text: string, cwd: string) => ({ type: 'user', isSidechain: false, cwd, message: { role: 'user', content: text } });
const assistantEntry = (usage: Usage, content: object[] = [{ type: 'text', text: 'Working on it.' }]) => ({
  type: 'assistant',
  isSidechain: false,
  message: {
    id: `msg_${randomUUID().slice(0, 12)}`,
    role: 'assistant',
    model: 'claude-opus-5-5',
    content,
    usage: { input_tokens: usage.input, output_tokens: usage.output, cache_creation_input_tokens: usage.cacheWrite, cache_read_input_tokens: usage.cacheRead },
  },
});
const toolUse = (name: string, input: object) => assistantEntry({ input: 2_000, output: 300, cacheWrite: 1_000, cacheRead: 160_000 }, [{ type: 'tool_use', id: `toolu_${randomUUID().slice(0, 8)}`, name, input }]);

async function writeTranscript(folder: string, id: string, entries: object[], modified: Date = new Date()): Promise<string> {
  const file = path.join(CLAUDE_DIR, 'projects', encoded(folder), `${id}.jsonl`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, entries.map((entry) => `${JSON.stringify(entry)}\n`).join(''));
  // Whole minutes: the Resume popup shows the time with the minute.
  const minute = new Date(Math.floor(modified.getTime() / MINUTE) * MINUTE);
  await utimes(file, minute, minute);
  return file;
}

interface PastSession {
  id: string;
  folder: string;
  prompt: string;
  age: number;
}

const past = (folder: string, age: number, prompt: string): PastSession => ({ id: randomUUID(), folder, prompt, age });

const PAST_SESSIONS: PastSession[] = [
  past(SHOP_API, 3 * HOUR, 'Add idempotency keys to the payment webhook so a retried event is not applied twice'),
  past(SHOP_API, 1 * DAY + 2 * HOUR, 'Why does the catalog endpoint return prices in cents for some products only?'),
  past(SHOP_API, 4 * DAY, 'Write a migration that adds an index on orders.customer_id'),
  past(MOBILE_APP, 26 * HOUR, 'Fix the crash when the cart is empty on the checkout screen'),
  past(DATA_PIPELINE, 2 * DAY + 4 * HOUR, 'Why is the nightly import slower since Monday?'),
];

const favoritePast = [PAST_SESSIONS[0]!, PAST_SESSIONS[3]!, PAST_SESSIONS[4]!];
const namedPast = new Map<string, string>([[PAST_SESSIONS[0]!.id, 'Webhook idempotency'], [PAST_SESSIONS[3]!.id, 'Empty cart crash']]);

async function seedClaudeWorld(): Promise<void> {
  for (const session of PAST_SESSIONS) {
    await writeTranscript(
      session.folder,
      session.id,
      [userEntry(session.prompt, session.folder), assistantEntry({ input: 1_200, output: 900, cacheWrite: 6_000, cacheRead: 20_000 })],
      ago(session.age),
    );
  }
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(path.join(DATA_DIR, 'session-favorites.json'), JSON.stringify(Object.fromEntries(favoritePast.map((session) => [session.id, true]))));
  await writeFile(path.join(DATA_DIR, 'session-names.json'), JSON.stringify(Object.fromEntries(namedPast)));
  await writeFile(path.join(DATA_DIR, 'project-marks.json'), JSON.stringify({ favorites: [SHOP_API, DOCS_SITE] }));
}

// ---------------------------------------------------------------------------------------------------------------
// The backend

let server: ChildProcess | undefined;
const helpers: ChildProcess[] = [];

/** True when nothing accepts connections on the port: it is tried with a real listen, not with a request. */
function portIsFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)));
  });
}

async function startServer(): Promise<void> {
  if (!(await portIsFree(PORT))) throw new Error(`Port ${PORT} is busy: something else is listening. Nothing was started.`);
  await mkdir(BIN_DIR, { recursive: true });
  const cli = path.join(BIN_DIR, 'claude');
  const demoCli = fileURLToPath(new URL('./demo-claude.mjs', import.meta.url));
  await writeFile(cli, `#!/bin/sh\nexec ${process.execPath} ${demoCli} "$@"\n`);
  await chmod(cli, 0o755);
  if (!path.resolve(cli).startsWith(`${WORLD}/`)) throw new Error('The demo command must be inside the demo world');
  const child = spawn(path.join(repoRoot, 'node_modules/.bin/tsx'), ['src/server/main.ts'], {
    cwd: repoRoot,
    stdio: 'ignore',
    // Built from scratch. PATH has the node directory and the system folders only, so no real `claude` is found.
    env: {
      PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`,
      // HOME is the home folder of the demo user: the new-session popup starts there.
      HOME: HOME_REAL,
      TZ: 'UTC',
      NODE_ENV: 'production',
      PORT: String(PORT),
      CLAUDE_CONFIG_DIR: CLAUDE_DIR,
      AI_CLIENT_DATA_DIR: DATA_DIR,
      AI_CLIENT_CLAUDE_CLI: cli,
      // Port 9 refuses: the demo server never asks GitHub for releases.
      AI_CLIENT_RELEASE_SOURCE_URL: 'http://127.0.0.1:9/releases/latest',
    },
  });
  server = child;
  let exited = false;
  child.once('exit', () => {
    exited = true;
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (exited) throw new Error('The demo server exited early: nothing was captured');
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) {
        // An answer is only trusted while the child still runs: a child that lost the port exits within a moment.
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (exited || child.exitCode !== null) throw new Error('The demo server exited early: something else answers on the port');
        // A fresh demo server has no session. Anything else means this is not our server.
        const sessions = (await (await fetch(`${BASE}/api/sessions`)).json()) as unknown[];
        if (sessions.length !== 0) throw new Error('The server on the port already has sessions: it is not the demo server');
        return;
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('The ')) throw error;
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('The demo server did not start');
}

async function api<T = unknown>(method: string, url: string, body?: unknown): Promise<T> {
  const response = await fetch(`${BASE}${url}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!response.ok) throw new Error(`${method} ${url} answered ${response.status}`);
  return (response.status === 204 ? undefined : await response.json()) as T;
}

const hook = (id: string, event: Record<string, string>) => api('POST', `/api/sessions/${id}/hook-events`, event);

/** A Claude Code process in another terminal, as the app sees it: a live pid and a file in `sessions/`. */
async function externalSession(folder: string, status: 'busy' | 'idle' | 'waiting', age: number, prompt: string, extra: object[] = []): Promise<void> {
  const claudeId = randomUUID();
  await writeTranscript(folder, claudeId, [userEntry(prompt, folder), assistantEntry({ input: 3_000, output: 1_500, cacheWrite: 9_000, cacheRead: 120_000 }), ...extra], ago(age));
  const helper = spawn('sleep', ['3600'], { stdio: 'ignore' });
  helpers.push(helper);
  const sessionsDir = path.join(CLAUDE_DIR, 'sessions');
  await mkdir(sessionsDir, { recursive: true });
  await writeFile(
    path.join(sessionsDir, `${helper.pid}.json`),
    JSON.stringify({ pid: helper.pid, sessionId: claudeId, cwd: folder, kind: 'interactive', status, updatedAt: Date.now() - age }),
  );
}

async function startSessions(): Promise<{ shopApi: string }> {
  const shopClaude = randomUUID();
  const { id: shopApi } = await api<{ id: string }>('POST', '/api/sessions', { path: SHOP_API, name: 'Webhook idempotency' });
  await hook(shopApi, { hook_event_name: 'UserPromptSubmit', prompt: 'Add idempotency keys to the payment webhook', session_id: shopClaude });
  const shopFile = await writeTranscript(SHOP_API, shopClaude, [
    userEntry('Add idempotency keys to the payment webhook so a retried event is not applied twice', SHOP_API),
    assistantEntry({ input: 12_000, output: 9_000, cacheWrite: 80_000, cacheRead: 900_000 }),
    assistantEntry({ input: 6_000, output: 11_000, cacheWrite: 30_000, cacheRead: 2_100_000 }),
    assistantEntry({ input: 4_000, output: 6_000, cacheWrite: 10_000, cacheRead: 410_000 }),
  ]);
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await appendFile(shopFile, `${JSON.stringify(toolUse('Bash', { command: 'npm test -- --run payments', description: 'Run the payment tests' }))}\n`);

  const { id: docs } = await api<{ id: string }>('POST', '/api/sessions', { path: DOCS_SITE });
  const docsClaude = randomUUID();
  await hook(docs, { hook_event_name: 'UserPromptSubmit', prompt: 'Rebuild the search index and publish the preview', session_id: docsClaude });
  await writeTranscript(DOCS_SITE, docsClaude, [
    userEntry('Rebuild the search index and publish the preview', DOCS_SITE),
    assistantEntry({ input: 5_000, output: 3_000, cacheWrite: 20_000, cacheRead: 140_000 }),
  ]);
  await hook(docs, { hook_event_name: 'PermissionRequest', tool_name: 'Bash', session_id: docsClaude });

  const { id: mobile } = await api<{ id: string }>('POST', '/api/sessions', { path: MOBILE_APP });
  const mobileClaude = randomUUID();
  await hook(mobile, { hook_event_name: 'UserPromptSubmit', prompt: 'Fix the crash when the cart is empty on the checkout screen', session_id: mobileClaude });
  await writeTranscript(MOBILE_APP, mobileClaude, [
    userEntry('Fix the crash when the cart is empty on the checkout screen', MOBILE_APP),
    assistantEntry({ input: 4_000, output: 2_500, cacheWrite: 14_000, cacheRead: 60_000 }),
  ]);
  await hook(mobile, { hook_event_name: 'Stop', session_id: mobileClaude });

  const { id: pipeline } = await api<{ id: string }>('POST', '/api/sessions', { path: DATA_PIPELINE });
  await hook(pipeline, { hook_event_name: 'UserPromptSubmit', prompt: 'Why is the nightly import slower since Monday?', session_id: randomUUID() });

  await externalSession(BILLING, 'busy', 7 * MINUTE, 'Render invoices as PDF with the company logo in the header', [
    toolUse('Read', { file_path: 'src/invoices/render.ts' }),
  ]);
  return { shopApi };
}

// ---------------------------------------------------------------------------------------------------------------
// The browser

type Theme = 'light' | 'dark' | 'dark-blue';

/**
 * Replaces the folder of the demo world by the folder it stands for, in the text and the tooltips of the page.
 * It is a string: a function would be changed by the TypeScript transform before it reaches the browser.
 */
const showHomeScript = (pairs: [string, string][]) => `(() => {
  const pairs = ${JSON.stringify(pairs)};
  const real = pairs[pairs.length - 1][0];
  const fix = (value) => pairs.reduce((text, [from, to]) => text.split(from).join(to), value);
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.data.includes(real)) node.data = fix(node.data);
    } else if (node instanceof Element) {
      for (const name of ['title', 'aria-label']) {
        const value = node.getAttribute(name);
        if (value && value.includes(real)) node.setAttribute(name, fix(value));
      }
      if (node instanceof HTMLInputElement && node.value.includes(real)) node.value = fix(node.value);
      node.childNodes.forEach(walk);
    }
  };
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData' || record.type === 'attributes') walk(record.target);
      record.addedNodes.forEach(walk);
    }
  }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
})();`;

const planUsage = {
  status: 'ok',
  limits: [
    { label: 'Current session', percent: 38, resetsAt: new Date(Date.now() + 2 * HOUR + 14 * MINUTE).toISOString() },
    { label: 'Current week (all models)', percent: 21, resetsAt: new Date(Date.now() + 4 * DAY + 3 * HOUR).toISOString() },
    { label: 'Current week (Opus)', percent: 12, resetsAt: new Date(Date.now() + 4 * DAY + 3 * HOUR).toISOString() },
  ],
};

async function newPage(browser: import('@playwright/test').Browser, theme: Theme): Promise<{ page: Page; context: BrowserContext }> {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: theme === 'light' ? 'light' : 'dark',
    locale: 'en-GB',
    timezoneId: 'UTC',
  });
  await context.addInitScript(
    ({ theme: value }) => {
      try {
        window.localStorage.setItem('ai-client.theme', value);
        window.localStorage.setItem('ai-client.look', 'vexel');
      } catch {
        // The page then starts with its own theme.
      }
    },
    { theme },
  );
  await context.addInitScript({ content: showHomeScript(HOME_PAIRS) });
  await context.route((url) => url.pathname === '/api/plan-usage', (route) => route.fulfill({ status: 200, json: planUsage }));
  const page = await context.newPage();
  await page.goto(BASE);
  // The terminal cursor of a window without focus is an outline box: it is not part of the picture.
  await page.addStyleTag({
    content: '.xterm-cursor-outline, .xterm-cursor-block, .xterm-cursor-bar, .xterm-cursor-underline { outline: none !important; background: transparent !important; box-shadow: none !important; color: inherit !important; }',
  });
  await page.getByRole('region', { name: 'Session List' }).locator('.session-entry').first().waitFor();
  return { page, context };
}

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const nav = (page: Page) => page.getByRole('navigation', { name: 'Main Navigation' });

/** Opens a session of the list and waits until its terminal shows the demo screen. */
async function openSession(page: Page, folderName: string): Promise<void> {
  await list(page).getByTitle(folderName.replace(HOME_REAL, HOME_SHOWN), { exact: true }).first().click();
  try {
    await page.locator('.main-view:not(.is-leaving) .xterm-rows').getByText('? for shortcuts').first().waitFor({ timeout: 15_000 });
  } catch (error) {
    await mkdir(OUT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(OUT_DIR, '_failed.png') });
    throw error;
  }
}

/** The page at rest: no animation plays, the pointer is away and no element has the focus. */
async function rest(page: Page): Promise<void> {
  await page.mouse.move(1439, 899);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await pageSettled(page);
  await page.waitForTimeout(800);
  await pageSettled(page);
  // The endless animations (progress bars, state dots) stop at the same moment in every shot.
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      if (animation.effect?.getComputedTiming().endTime === Infinity) {
        animation.pause();
        animation.currentTime = 700;
      }
    }
  });
  await page.waitForTimeout(150);
}

const LIMIT_BYTES = 400 * 1024;

/** A PNG over 400 KB gets a palette of 256 colours: the interface is flat, so it looks the same. Needs python3 with Pillow, else it stays as it is. */
function shrink(file: string): void {
  if (statSync(file).size <= LIMIT_BYTES) return;
  try {
    execFileSync(
      'python3',
      ['-c', "import sys\nfrom PIL import Image\nf = sys.argv[1]\nImage.open(f).convert('RGB').quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(f, optimize=True)", file],
      { stdio: 'ignore' },
    );
  } catch {
    console.warn(`${path.basename(file)} is over 400 KB and could not be shrunk (python3 with Pillow is missing)`);
  }
}

async function save(page: Page, name: string): Promise<void> {
  await rest(page);
  await mkdir(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file });
  shrink(file);
  console.log(`captured ${name}.png (${Math.round(statSync(file).size / 1024)} KB)`);
}

interface Shared {
  shopApiFolder: string;
}

type Shot = (browser: import('@playwright/test').Browser, shared: Shared) => Promise<void>;

async function mainWindow(browser: import('@playwright/test').Browser, theme: Theme, name: string, folder = SHOP_API): Promise<void> {
  const { page, context } = await newPage(browser, theme);
  await openSession(page, folder);
  await save(page, name);
  await context.close();
}

async function openExplorer(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Git Explorer', exact: true }).click();
  await page.getByRole('region', { name: 'Git Explorer', exact: true }).waitFor();
}

const SHOTS: Record<string, Shot> = {
  'session-dark': (browser) => mainWindow(browser, 'dark', 'session-dark'),
  'session-dark-blue': (browser) => mainWindow(browser, 'dark-blue', 'session-dark-blue', DOCS_SITE),
  'git-explorer-dark': async (browser) => {
    const { page, context } = await newPage(browser, 'dark');
    await openSession(page, SHOP_API);
    await openExplorer(page);
    await page.getByRole('tab', { name: 'History' }).click();
    await page.getByText('Verify webhook signatures', { exact: true }).waitFor();
    await save(page, 'git-explorer-dark');
    await context.close();
  },
  'git-changes-dark': async (browser) => {
    const { page, context } = await newPage(browser, 'dark');
    await openSession(page, SHOP_API);
    await openExplorer(page);
    await page.getByRole('tab', { name: 'Changes' }).click();
    await page.getByText('src/payments/webhook.ts', { exact: true }).click();
    await page.locator('.git-explorer-tabpanel').getByText('markProcessed').first().waitFor();
    await save(page, 'git-changes-dark');
    await context.close();
  },
  'resume-dark': async (browser) => {
    const { page, context } = await newPage(browser, 'dark');
    await openSession(page, SHOP_API);
    await nav(page).getByRole('button', { name: 'Resume', exact: true }).click();
    await page.getByRole('dialog', { name: 'Resume Session' }).locator('.past-session-group').first().waitFor();
    await save(page, 'resume-dark');
    await context.close();
  },
  'new-session-dark': async (browser) => {
    const { page, context } = await newPage(browser, 'dark');
    await openSession(page, SHOP_API);
    await nav(page).getByRole('button', { name: 'New Claude Code Session', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'New Claude Code Session' });
    await dialog.waitFor();
    await dialog.getByText('maya', { exact: false }).first().waitFor();
    // The path field shows the demo user's home folder like the rest of the page.
    await dialog.getByRole('textbox').first().evaluate((input: HTMLInputElement) => (input.value = '/home/maya'));
    await save(page, 'new-session-dark');
    await context.close();
  },
  'settings-light': async (browser) => {
    const { page, context } = await newPage(browser, 'light');
    await openSession(page, SHOP_API);
    await nav(page).getByRole('button', { name: 'Settings', exact: true }).click();
    const popup = page.getByRole('dialog', { name: 'Settings', exact: true });
    await popup.waitFor();
    await popup.getByRole('tab', { name: 'Appearance', exact: true }).click();
    await save(page, 'settings-light');
    await context.close();
  },
};

async function main(): Promise<void> {
  const wanted = process.argv.slice(2);
  for (const name of wanted) if (!SHOTS[name]) throw new Error(`Unknown shot "${name}". Shots: ${Object.keys(SHOTS).join(', ')}`);
  const names = wanted.length > 0 ? wanted : Object.keys(SHOTS);
  await rm(WORLD, { recursive: true, force: true });
  await mkdir(WORLD, { recursive: true });
  let failed: unknown;
  try {
    await seedShopApi();
    await seedPlainFolder(DOCS_SITE, 'package.json');
    await seedPlainFolder(MOBILE_APP, 'package.json');
    await seedPlainFolder(DATA_PIPELINE);
    await seedPlainFolder(BILLING);
    await seedClaudeWorld();
    await startServer();
    const { shopApi } = await startSessions();
    // The scanner reads the sessions folder every 2 seconds, the usage monitor every second.
    await new Promise((resolve) => setTimeout(resolve, 4500));
    const browser = await chromium.launch();
    try {
      for (const name of names) await SHOTS[name]!(browser, { shopApiFolder: shopApi });
    } finally {
      await browser.close();
    }
  } catch (error) {
    failed = error;
  } finally {
    server?.kill();
    for (const helper of helpers) helper.kill('SIGKILL');
    await new Promise((resolve) => setTimeout(resolve, 500));
    await rm(WORLD, { recursive: true, force: true });
  }
  if (failed) {
    console.error(failed);
    process.exitCode = 1;
  }
}

await main();
