// e2e of plan-session_activity (batch workflow-subagents) and plan-subagent_panel. The tests write the transcripts, workflow run folders, journals and metadata that Claude Code would write.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { appendFile, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';
import { expectJoined, expectNoMark, expectOneBelowTheOther, expectRowPlace } from './subagent-rows';

type Line = Record<string, unknown>;

const SESSIONS_DIR = path.join(E2E_CLAUDE_DIR, 'sessions');
// The external scanner reads the sessions folder every 2 seconds.
const SCAN = { timeout: 20_000 };
// The REQs ask for 2 s: under the load of the complete run the e2e checks that it happens, not how fast (the unit tests time it).
const PROMPTLY = { timeout: 15_000 };
const MIN = 60_000;
const TYPE = 'workflow-subagent';

let projectsRoot: string;
const createdIds: string[] = [];
const cleanup: { process?: ChildProcess; files: string[] }[] = [];

test.beforeAll(async () => {
  projectsRoot = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-workflow-subagents-')));
  await mkdir(SESSIONS_DIR, { recursive: true });
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  for (const { process, files } of cleanup.splice(0)) {
    process?.kill('SIGKILL');
    for (const file of files) await rm(file, { recursive: true, force: true });
  }
});

test.afterAll(async () => {
  await rm(projectsRoot, { recursive: true, force: true });
});

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).locator('.session-entry').filter({ has: page.getByTitle(folder, { exact: true }) });
const latestLine = (target: Locator) => target.locator('.session-entry-latest');
const stallLine = (target: Locator) => target.locator('.session-entry-stall');
const mainArea = (page: Page) => page.getByRole('main');
const header = (page: Page) => mainArea(page).locator('.main-view:not(.is-leaving) .session-header');
const turnButton = (page: Page) => header(page).getByRole('button', { name: 'Turn Panel', exact: true });
const panel = (page: Page) => mainArea(page).getByRole('region', { name: 'Turn Panel', exact: true });
const subConversation = (page: Page) => panel(page).getByRole('region', { name: 'Subagent Conversation', exact: true });
const cards = (scope: Locator) => scope.getByRole('article', { name: `Subagent: ${TYPE}`, exact: true });
const card = (page: Page, label: string) => cards(panel(page)).filter({ has: page.getByText(label, { exact: true }) });
const treeArea = (page: Page) => panel(page).locator('[tabindex="0"]');

const iso = (ms: number) => new Date(ms).toISOString();
const uuid = () => crypto.randomUUID();
const userText = (text: string, timestamp: string, sidechain = false): Line => ({ type: 'user', isSidechain: sidechain, timestamp, origin: { kind: 'human' }, message: { role: 'user', content: text } });
const claudeSays = (content: string | object[], timestamp: string, sidechain = false, model?: string): Line => ({
  type: 'assistant',
  isSidechain: sidechain,
  timestamp,
  message: { role: 'assistant', content: typeof content === 'string' ? [{ type: 'text', text: content }] : content, ...(model && { model }) },
});
const toolUse = (id: string, name: string, input: object) => ({ type: 'tool_use', id, name, input });
const toolResult = (id: string, content: string, timestamp: string, sidechain = false, extra: Line = {}): Line => ({
  type: 'user',
  isSidechain: sidechain,
  timestamp,
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content }] },
  ...extra,
});
/** The result line of a Workflow call: it returns at once, with the task id and the run id. */
const launched = (callId: string, runId: string, taskId: string, timestamp: string) =>
  toolResult(callId, `Task ID: ${taskId}\nThe workflow runs in the background.\nRun ID: ${runId}`, timestamp, false, { toolUseResult: { status: 'async_launched', taskId, runId } });
const notification = (taskId: string, status: string, timestamp: string): Line => ({
  type: 'user',
  isSidechain: false,
  timestamp,
  origin: { kind: 'task-notification' },
  promptSource: 'system',
  message: { role: 'user', content: `<task-notification>\n<task-id>${taskId}</task-id>\n<tool-use-id>wf</tool-use-id>\n<status>${status}</status>\n</task-notification>` },
});

const newFolder = (name: string) => mkdtemp(path.join(projectsRoot, `${name}-`));
const projectDir = (folder: string) => path.join(E2E_CLAUDE_DIR, 'projects', folder.replace(/[^A-Za-z0-9]/g, '-'));

const writeLines = async (file: string, entries: Line[]) => {
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, entries.map((line) => `${JSON.stringify(line)}\n`).join(''));
};

/** The files of one Claude Code session: its main transcript and its workflow runs, as Claude Code writes them. */
function claudeSession(folder: string, claudeSessionId: string) {
  const main = path.join(projectDir(folder), `${claudeSessionId}.jsonl`);
  const runDir = (runId: string) => path.join(projectDir(folder), claudeSessionId, 'subagents', 'workflows', runId);
  cleanup.push({ files: [projectDir(folder)] });
  return {
    write: (...entries: Line[]) => writeLines(main, entries),
    subagent: (agentId: string) => {
      const file = path.join(projectDir(folder), claudeSessionId, 'subagents', `agent-${agentId}.jsonl`);
      return {
        write: (...entries: Line[]) => writeLines(file, entries),
        meta: (meta: object) => writeFile(file.replace(/\.jsonl$/, '.meta.json'), JSON.stringify(meta)),
      };
    },
    journal: (runId: string, ...entries: Line[]) => writeLines(path.join(runDir(runId), 'journal.jsonl'), entries),
    agent: (runId: string, agentId: string) => {
      const file = path.join(runDir(runId), `agent-${agentId}.jsonl`);
      return {
        write: (...entries: Line[]) => writeLines(file, entries),
        meta: async (meta: object) => {
          await mkdir(path.dirname(file), { recursive: true });
          await writeFile(file.replace(/\.jsonl$/, '.meta.json'), JSON.stringify(meta));
        },
      };
    },
  };
}

type Session = ReturnType<typeof claudeSession>;

const AGENTS = [
  { id: 'a1', label: 'review:git', model: 'claude-sonnet-5', command: 'git log --oneline' },
  { id: 'a2', label: 'review:docs', model: 'claude-haiku-5', command: 'cat README.md' },
  { id: 'a3', label: 'review:build', model: 'claude-sonnet-5', command: 'mvn dependency:tree' },
  { id: 'a4', label: 'review:tests', model: 'claude-opus-5-5', command: 'npm test' },
] as const;

/** A turn that launches run `runId` (task `task-<runId>`) at step 1; its 4 agents start at `t0 - 45 s`, write a text and run Bash. */
async function workflowOfFour(files: Session, runId: string, t0: number): Promise<void> {
  await files.write(
    userText('Review the batch', iso(t0 - 60_000)),
    claudeSays('I launch the review workflow', iso(t0 - 55_000)),
    claudeSays([toolUse('wf', 'Workflow', { workflow: 'review' })], iso(t0 - 50_000)),
    launched('wf', runId, `task-${runId}`, iso(t0 - 49_000)),
    claudeSays('The review runs in the background', iso(t0 - 48_000)),
  );
  await files.journal(runId, { type: 'launched' }, ...AGENTS.map(({ id, label }) => ({ type: 'started', agentId: id, label, phase: 'review' })));
  for (const { id, label, model, command } of AGENTS) {
    const agent = files.agent(runId, id);
    await agent.meta({ agentType: TYPE, description: label, workflowPhase: 'review', pickedEffortModel: model });
    await agent.write(
      userText(`Review ${label}`, iso(t0 - 45_000), true),
      claudeSays(`Reading ${label}`, iso(t0 - 40_000), true, model),
      claudeSays([toolUse(`bash-${id}`, 'Bash', { command })], iso(t0 - 35_000), true, model),
    );
  }
}

async function postHook(request: APIRequestContext, id: string, event: Record<string, string>): Promise<void> {
  expect((await request.post(`/api/sessions/${id}/hook-events`, { data: event })).status()).toBe(204);
}

async function startWorkingHosted(request: APIRequestContext, folder: string, claudeSessionId: string): Promise<string> {
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  createdIds.push(id);
  await postHook(request, id, { hook_event_name: 'UserPromptSubmit', prompt: 'Review the batch', session_id: claudeSessionId });
  return id;
}

/** Simulates Claude Code at work in another terminal: a live process, its `sessions/<pid>.json` and the `<pid>.<hash>.key` FIFO. */
async function runInTerminal(sessionId: string, folder: string): Promise<void> {
  const process = spawn('sleep', ['300'], { stdio: 'ignore' });
  const pid = process.pid ?? 0;
  const key = path.join(SESSIONS_DIR, `${pid}.5a6b7c8d.key`);
  const file = path.join(SESSIONS_DIR, `${pid}.json`);
  cleanup.push({ process, files: [key, file] });
  execFileSync('mkfifo', [key]);
  await writeFile(file, JSON.stringify({ pid, sessionId, cwd: folder, kind: 'interactive', status: 'busy', updatedAt: Date.now() }));
}

const stateOf = async (request: APIRequestContext, id: string) =>
  ((await (await request.get('/api/sessions')).json()) as { id: string; state: string }[]).find((session) => session.id === id)?.state;

async function openSession(page: Page, folder: string, external = false): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await expect(entry(page, folder)).toBeVisible(external ? SCAN : undefined);
  await entry(page, folder).getByTitle(folder, { exact: true }).click();
  await expect(header(page).getByRole('heading', { level: 2 })).toHaveText(path.basename(folder));
}

async function openPanel(page: Page): Promise<void> {
  await turnButton(page).click();
  await expect(turnButton(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(panel(page)).toBeVisible();
}

test.describe('Workflow subagents', () => {
  // plan-session_activity/REQ-56 — scenario "A running workflow keeps the session at work"
  test('an idle hosted session whose workflow runs shows the latest text of a workflow agent with its type', async ({ page, request }) => {
    const folder = await newFolder('keeps');
    const claudeSessionId = uuid();
    const files = claudeSession(folder, claudeSessionId);
    const id = await startWorkingHosted(request, folder, claudeSessionId);
    const t0 = Math.floor(Date.now() / 1000) * 1000;
    await workflowOfFour(files, 'wf_keeps', t0);
    await postHook(request, id, { hook_event_name: 'Stop', session_id: claudeSessionId });
    await page.clock.setFixedTime(t0);
    await page.goto('/');
    const row = entry(page, folder);
    await expect(row).toBeVisible();
    await expect(latestLine(row)).toContainText(`${TYPE}: Reading review:`, PROMPTLY);

    await files.agent('wf_keeps', 'a3').write(claudeSays('Checking the Maven resolution', iso(t0), true));
    await expect(latestLine(row)).toHaveText(`${TYPE}: Checking the Maven resolution · 0 s`, PROMPTLY);
    expect(await stateOf(request, id), 'the entry stays idle').toBe('idle');
  });

  // plan-session_activity/REQ-57 — scenario "A silent workflow agent shows in the stall signal"
  test('a silent external session shows the tool its workflow agent runs in the stall signal, until the agent goes on', async ({ page }) => {
    const folder = await newFolder('silent');
    const sessionId = uuid();
    const files = claudeSession(folder, sessionId);
    const t0 = Math.floor(Date.now() / 1000) * 1000;
    const last = t0 - 6 * MIN;
    await files.write(
      userText('Run the tests of the server', iso(last - 60_000)),
      claudeSays([toolUse('wf', 'Workflow', { workflow: 'test' })], iso(last - 50_000)),
      launched('wf', 'wf_silent', 'task-silent', iso(last - 49_000)),
    );
    await files.journal('wf_silent', { type: 'launched' }, { type: 'started', agentId: 'mvn', label: 'test:maven', phase: 'test' });
    const agent = files.agent('wf_silent', 'mvn');
    await agent.meta({ agentType: TYPE, description: 'test:maven', pickedEffortModel: 'claude-sonnet-5' });
    await agent.write(userText('Run the Maven tests', iso(last - 40_000), true), claudeSays([toolUse('mvn-1', 'Bash', { command: 'mvn test' })], iso(last), true));
    await runInTerminal(sessionId, folder);
    await page.clock.setFixedTime(t0);
    await page.goto('/');
    const row = entry(page, folder);
    await expect(row).toBeVisible(SCAN);
    await expect(stallLine(row)).toHaveText(`No activity for 6 min · ${TYPE}: mvn test running`, PROMPTLY);

    await agent.write(toolResult('mvn-1', 'BUILD SUCCESS', iso(t0), true));
    await expect(stallLine(row), 'the signal goes at the next activity of the agent').toHaveCount(0, PROMPTLY);
  });

  // plan-session_activity/REQ-58, plan-subagent_panel/REQ-1, REQ-8, REQ-10 — scenario "The turn panel shows the agents of a workflow"
  test('the turn panel shows the 4 agents of a workflow as one group of rows joined by a line, each with its fields, and no step', async ({ page }) => {
    const folder = await newFolder('panel');
    const sessionId = uuid();
    const files = claudeSession(folder, sessionId);
    const t0 = Math.floor(Date.now() / 1000) * 1000;
    await workflowOfFour(files, 'wf_panel', t0);
    await runInTerminal(sessionId, folder);
    await page.clock.setFixedTime(t0);
    await openSession(page, folder, true);
    await openPanel(page);

    await expect(cards(panel(page))).toHaveCount(4, PROMPTLY);
    for (const { label, model, command } of AGENTS) {
      const agent = card(page, label);
      await expect(agent, label).toHaveCount(1);
      await expect(agent.getByText(TYPE, { exact: true })).toBeVisible();
      await expect(agent.getByText(model, { exact: true })).toBeVisible();
      await expect(agent.getByText('Running', { exact: true })).toBeVisible();
      await expect(agent.locator('time'), `${label}: the duration since its start`).toHaveText('45 s');
      await expect(agent.getByText(`Reading ${label}`, { exact: true })).toBeVisible();
      await expect(agent).toContainText(`Bash: ${command}`);
    }
    for (const text of ['I launch the review workflow', 'The review runs in the background', 'Review the batch']) {
      await expect(panel(page), `no message of the main conversation: ${text}`).not.toContainText(text);
    }

    const rows = await cards(panel(page)).all();
    await expectOneBelowTheOther(rows);
    for (const [i, each] of rows.entries()) await expectRowPlace(treeArea(page), each, 0, `row ${i}`);
    await expectJoined(treeArea(page), rows);
  });

  // plan-subagent_panel/REQ-2, REQ-3, REQ-10, REQ-12 — scenario "A workflow sits at the start of its first agent"
  test('puts a subagent started before the first agent of a workflow above the workflow group, launched earlier', async ({ page }) => {
    const folder = await newFolder('order');
    const sessionId = uuid();
    const files = claudeSession(folder, sessionId);
    const t0 = Math.floor(Date.now() / 1000) * 1000;
    await files.write(
      userText('Review and test the batch', iso(t0 - 90_000)),
      claudeSays([toolUse('wf', 'Workflow', { workflow: 'review' })], iso(t0 - 80_000)),
      launched('wf', 'wf_order', 'task-order', iso(t0 - 79_000)),
      claudeSays('The review runs, now the tests', iso(t0 - 70_000)),
      claudeSays([toolUse('tester-call', 'Agent', { description: 'Run the tests', prompt: 'Test', subagent_type: 'sdd-tester' })], iso(t0 - 60_000)),
    );
    const tester = files.subagent('tester');
    await tester.write(userText('Run the tests', iso(t0 - 50_000), true), claudeSays('Running the suite', iso(t0 - 45_000), true));
    await tester.meta({ agentType: 'sdd-tester', description: 'Run the tests', toolUseId: 'tester-call' });
    await files.journal('wf_order', { type: 'launched' }, ...AGENTS.slice(0, 2).map(({ id, label }) => ({ type: 'started', agentId: id, label, phase: 'review' })));
    for (const { id, label } of AGENTS.slice(0, 2)) {
      const agent = files.agent('wf_order', id);
      await agent.meta({ agentType: TYPE, description: label, workflowPhase: 'review' });
      await agent.write(userText(`Review ${label}`, iso(t0 - 40_000), true), claudeSays(`Reading ${label}`, iso(t0 - 35_000), true));
    }
    await runInTerminal(sessionId, folder);
    await openSession(page, folder, true);
    await openPanel(page);

    const testerCard = panel(page).getByRole('article', { name: 'Subagent: sdd-tester', exact: true });
    await expect(testerCard).toBeVisible(PROMPTLY);
    await expect(cards(panel(page))).toHaveCount(2, PROMPTLY);
    const agents = [cards(panel(page)).nth(0), cards(panel(page)).nth(1)];
    await expectOneBelowTheOther([testerCard, ...agents]);
    await expectJoined(treeArea(page), agents);
    await expectNoMark(treeArea(page), testerCard, 'the sdd-tester row');
    await expect(panel(page)).not.toContainText('The review runs, now the tests');
  });

  // plan-session_activity/REQ-59 — scenario "The conversation of a workflow agent"
  test('a click on the card of a workflow agent shows its conversation from its task to its latest step, live', async ({ page, request }) => {
    const folder = await newFolder('talk');
    const claudeSessionId = uuid();
    const files = claudeSession(folder, claudeSessionId);
    await startWorkingHosted(request, folder, claudeSessionId);
    const t0 = Math.floor(Date.now() / 1000) * 1000;
    await workflowOfFour(files, 'wf_talk', t0);
    await openSession(page, folder);
    await openPanel(page);
    const docs = card(page, 'review:docs');
    await expect(docs).toHaveCount(1, PROMPTLY);
    await docs.getByRole('button', { name: `Open Conversation: ${TYPE}`, exact: true }).click();

    const view = subConversation(page);
    await expect(view).toBeVisible();
    await expect(view.getByText(TYPE, { exact: true })).toBeVisible();
    await expect(view.getByTitle('review:docs', { exact: true }).first()).toBeVisible();
    await expect(view.getByText('Running', { exact: true })).toBeVisible();
    const task = view.getByRole('article', { name: 'Task', exact: true });
    await expect(task).toHaveCount(1, PROMPTLY);
    await expect(task).toContainText('Review review:docs');
    await expect(view.locator('[aria-label="Tool: Bash"]').filter({ hasText: 'cat README.md' })).toBeVisible(PROMPTLY);
    const labels = await view.locator('article').evaluateAll((els) => els.map((el) => `${el.getAttribute('aria-label')}: ${el.textContent}`));
    expect(labels[0], 'the task first').toMatch(/^Task: .*Review review:docs/);
    expect(labels.join(' | '), 'only the steps of this agent').not.toContain('review:git');

    await files.agent('wf_talk', 'a2').write(claudeSays('The docs are consistent', iso(Date.now()), true));
    await expect(view.getByText('The docs are consistent', { exact: true }), 'the new step shows').toBeVisible(PROMPTLY);
    await expect(view.locator('article').last()).toContainText('The docs are consistent');
  });

  // plan-session_activity/REQ-60 — scenario "An ended workflow stops keeping the session at work"
  test('once the workflow ends, the panel shows 2 agents finished and 2 stopped, and the idle entry loses its latest-text line', async ({ page, request }) => {
    const folder = await newFolder('ends');
    const claudeSessionId = uuid();
    const files = claudeSession(folder, claudeSessionId);
    const id = await startWorkingHosted(request, folder, claudeSessionId);
    const t0 = Math.floor(Date.now() / 1000) * 1000;
    await workflowOfFour(files, 'wf_ends', t0);
    await postHook(request, id, { hook_event_name: 'Stop', session_id: claudeSessionId });
    await openSession(page, folder);
    await openPanel(page);
    const row = entry(page, folder);
    await expect(cards(panel(page)).getByText('Running', { exact: true })).toHaveCount(4, PROMPTLY);
    await expect(latestLine(row), 'the idle entry is at work').toBeVisible(PROMPTLY);

    await files.journal('wf_ends', { type: 'result', agentId: 'a1', label: 'review:git' }, { type: 'result', agentId: 'a2', label: 'review:docs' });
    await files.write(notification('task-wf_ends', 'stopped', iso(Date.now())));
    for (const [label, pill] of [
      ['review:git', 'Finished'],
      ['review:docs', 'Finished'],
      ['review:build', 'Stopped'],
      ['review:tests', 'Stopped'],
    ] as const) {
      await expect(card(page, label).getByText(pill, { exact: true }), `${label}: ${pill}`).toBeVisible(PROMPTLY);
    }
    await expect(cards(panel(page)).getByText('Running', { exact: true })).toHaveCount(0);
    await expect(panel(page).getByText('Ended', { exact: true }), 'the turn shows as ended').toBeVisible();
    await expect(latestLine(row), 'the entry no longer shows the latest-text line').toHaveCount(0, PROMPTLY);
    expect(await stateOf(request, id)).toBe('idle');
  });
});
