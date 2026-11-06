// e2e of plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search, batch history-search.
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

const QUERIES = ['login', 'ogi', 'zzqx', 'ventory-s', 'rotate', '10/2026'];
const FILLER_FOLDERS = 6;
const FILLER_PER_FOLDER = 50;

let projectsRoot: string;
let auth: string;
let shop: string;
let inventory: string;
let docs: string;
const startedIds: string[] = [];
const terminals: ChildProcess[] = [];

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Resume Session' });
const searchBar = (page: Page) => dialog(page).getByRole('textbox', { name: 'Search Past Sessions', exact: true });
const clearButton = (page: Page) => dialog(page).getByRole('button', { name: 'Clear Search', exact: true });
const pastSessions = (page: Page) => dialog(page).getByRole('radiogroup', { name: 'Past Sessions' });
const pastEntry = (page: Page, folder: string, label: string) =>
  dialog(page).getByRole('region', { name: folder }).getByRole('radio', { name: label, exact: true });
const resumeButton = (page: Page) => dialog(page).getByRole('button', { name: 'Resume', exact: true });
const warning = (page: Page) => page.getByRole('alertdialog', { name: 'Session Running in a Terminal' });
const terminal = (page: Page) => page.locator('.xterm-rows');
const isResumeRequest = (url: string, method: string) => /\/api\/past-sessions\/[^/]+\/resume$/.test(new URL(url).pathname) && method === 'POST';
const isListRequest = (url: string) => new URL(url).pathname.startsWith('/api/past-sessions');

async function pastSession(id: string, folder: string, firstMessage: string, modified: Date, reply = 'Done.'): Promise<void> {
  const dir = path.join(E2E_CLAUDE_DIR, 'projects', folder.replaceAll('/', '-'));
  await mkdir(dir, { recursive: true });
  const common = { cwd: folder, sessionId: id, isSidechain: false };
  const lines = [
    { ...common, type: 'user', message: { role: 'user', content: firstMessage } },
    { ...common, type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: reply }] } },
  ];
  const file = path.join(dir, `${id}.jsonl`);
  await writeFile(file, lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
  await utimes(file, modified, modified);
}

async function newFolder(name: string): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder);
  return folder;
}

const day = (n: number, hour = 10) => new Date(2026, 9, n, hour, 0, 0);
const README_FIRST_MESSAGE = `${'Update the README sections '.repeat(4)}and the login page`;

test.beforeAll(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
  await mkdir(path.join(E2E_CLAUDE_DIR, 'projects'), { recursive: true });
  do {
    if (projectsRoot) await rm(projectsRoot, { recursive: true, force: true });
    projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-search-'));
  } while (QUERIES.some((q) => projectsRoot.toLowerCase().includes(q)));

  auth = await newFolder('auth-portal');
  shop = await newFolder('web-shop');
  inventory = await newFolder('inventory-svc');
  docs = await newFolder('docs');

  await pastSession('e2e-search-auth-1', auth, 'Fix the Login form validation', day(28));
  await pastSession('e2e-search-auth-2', auth, 'Add OAuth provider', day(27));
  await pastSession('e2e-search-auth-3', auth, 'Refactor LOGIN redirect', day(20));
  await pastSession('e2e-search-auth-4', auth, 'Rotate the Login tokens', day(12));
  await pastSession('e2e-search-shop-1', shop, 'Cart totals', day(26));
  await pastSession('e2e-search-shop-2', shop, 'login button styling', day(22));
  await pastSession('e2e-search-inv-1', inventory, 'Stock sync job', day(25));
  await pastSession('e2e-search-inv-2', inventory, 'Warehouse report', day(15));
  await pastSession('e2e-search-login-id', docs, README_FIRST_MESSAGE, day(24), 'I updated the login docs.');
  for (let f = 0; f < FILLER_FOLDERS; f++) {
    const filler = await newFolder(`filler-${f}`);
    for (let s = 0; s < FILLER_PER_FOLDER; s++) {
      await pastSession(`e2e-search-filler-${f}-${s}`, filler, `Routine task ${f}-${s}`, day(1 + ((f * 7 + s) % 27), s % 24));
    }
  }
});

test.afterEach(async ({ request }) => {
  for (const id of startedIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  for (const process of terminals.splice(0)) process.kill('SIGKILL');
  await rm(path.join(E2E_CLAUDE_DIR, 'sessions'), { recursive: true, force: true });
});

test.afterAll(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
  await rm(projectsRoot, { recursive: true, force: true });
});

const README_LABEL = README_FIRST_MESSAGE.slice(0, 80);

/** The shown sessions as "folder > label", in the order of the list; empty when no radiogroup shows. */
async function shownList(page: Page): Promise<string[]> {
  if ((await pastSessions(page).count()) === 0) return [];
  const snapshot = await pastSessions(page).ariaSnapshot();
  const rows: string[] = [];
  let folder = '';
  for (const line of snapshot.split('\n')) {
    const region = /- region "(.*)"/.exec(line);
    if (region) folder = region[1] ?? '';
    const radio = /- radio "(.*?)"/.exec(line);
    if (radio) rows.push(`${folder} > ${radio[1]}`);
  }
  return rows;
}

const label = (row: string) => row.slice(row.indexOf(' > ') + 3);
const folderOf = (row: string) => row.slice(0, row.indexOf(' > '));
const matching = (rows: string[], text: string) =>
  rows.filter((row) => label(row).toLowerCase().includes(text.toLowerCase()) || folderOf(row).toLowerCase().includes(text.toLowerCase()));

async function openDialog(page: Page): Promise<void> {
  await page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).not.toContainText('Loading…');
}

async function fullList(page: Page): Promise<string[]> {
  const rows = await shownList(page);
  expect(rows.length, 'the full list shows every fixture session').toBeGreaterThanOrEqual(9 + FILLER_FOLDERS * FILLER_PER_FOLDER);
  return rows;
}

const resolvedColour = (page: Page, token: string) =>
  page.evaluate((name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  }, token);

const box = async (locator: Locator) => {
  const b = await locator.boundingBox();
  expect(b).not.toBeNull();
  return b!;
};

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-1, REQ-2, REQ-13: an empty, focused bar above the list
test('the dialog opens with an empty, focused search bar above the list', async ({ page }) => {
  await page.goto('/');
  await openDialog(page);

  await expect(searchBar(page)).toBeVisible();
  await expect(searchBar(page)).toBeFocused();
  await expect(searchBar(page)).toHaveValue('');
  await expect(searchBar(page)).toHaveAttribute('placeholder', 'Search by label or folder');
  await expect(clearButton(page)).toHaveCount(0);
  expect((await box(searchBar(page))).y + (await box(searchBar(page))).height).toBeLessThanOrEqual((await box(pastSessions(page))).y);
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-3, REQ-4, REQ-5, REQ-6, REQ-7 — scenario "The user finds past sessions by typing part of their label"
test('typing "login" without clicking keeps only the labels with "Login", in the order of the full list', async ({ page }) => {
  const listRequests: string[] = [];
  await page.goto('/');
  await openDialog(page);
  const full = await fullList(page);
  page.on('request', (r) => {
    if (isListRequest(r.url())) listRequests.push(r.url());
  });

  await page.keyboard.type('login');

  const expected = matching(full, 'login');
  expect(expected.map(label).sort()).toEqual(
    ['Fix the Login form validation', 'Refactor LOGIN redirect', 'Rotate the Login tokens', 'login button styling'].sort(),
  );
  await expect.poll(() => shownList(page)).toEqual(expected);
  await expect(dialog(page).getByRole('region')).toHaveCount(2);
  await expect(dialog(page).getByRole('region').getByRole('heading')).toHaveText([...new Set(expected.map(folderOf))]);
  await expect(pastEntry(page, auth, 'Fix the Login form validation')).toHaveAccessibleDescription('28/10/2026 10:00:00');
  expect(listRequests, 'the filter sends no request').toEqual([]);
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-5: the list updates at the first keystroke, with no button
test('the list updates at each keystroke', async ({ page }) => {
  await page.goto('/');
  await openDialog(page);
  const full = await fullList(page);

  expect(matching(full, 'lo').length).toBeLessThan(full.length);

  await searchBar(page).press('l');
  await expect.poll(() => shownList(page)).toEqual(matching(full, 'l'));
  await searchBar(page).press('o');
  await expect.poll(() => shownList(page)).toEqual(matching(full, 'lo'));
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-3, REQ-4: substring anywhere in the label, any case
test('the search matches a substring anywhere in the label, ignoring case', async ({ page }) => {
  await page.goto('/');
  await openDialog(page);
  const full = await fullList(page);
  const logins = matching(full, 'login');

  await searchBar(page).fill('LoGiN');
  await expect.poll(() => shownList(page)).toEqual(logins);
  await searchBar(page).fill('OGI');
  await expect.poll(() => shownList(page)).toEqual(logins);
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-3: only label and folder are searched, not the id, the date, the conversation or the text past the label
test('the id, the date, the conversation and the text cut from the label do not match', async ({ page }) => {
  await page.goto('/');
  await openDialog(page);
  await expect(pastEntry(page, docs, README_LABEL)).toBeVisible();

  await searchBar(page).fill('login');
  await expect(dialog(page).getByRole('region', { name: docs })).toHaveCount(0);

  await searchBar(page).fill('10/2026');
  await expect(pastSessions(page)).toHaveCount(0);
  await expect(dialog(page)).toContainText('No sessions match "10/2026".');
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-3, REQ-10 — scenario "The user finds the sessions of one project by its folder"
test('part of a folder path shows every session of that folder and no other folder', async ({ page }) => {
  await page.goto('/');
  await openDialog(page);
  const full = await fullList(page);

  await page.keyboard.type('ventory-s');

  await expect.poll(() => shownList(page)).toEqual(full.filter((row) => folderOf(row) === inventory));
  await expect(dialog(page).getByRole('region').getByRole('heading')).toHaveText([inventory]);
  await expect(dialog(page).getByRole('region', { name: inventory }).getByRole('radio')).toHaveCount(2);
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-8, REQ-13 — scenario "Nothing matches the search text"
test('when nothing matches, the dialog says so and the bar shows "Clear Search"', async ({ page }) => {
  await page.goto('/');
  await openDialog(page);

  await page.keyboard.type('zzqx');

  await expect(pastSessions(page)).toHaveCount(0);
  await expect(dialog(page).getByRole('radio')).toHaveCount(0);
  await expect(dialog(page).getByText('No sessions match "zzqx".', { exact: true })).toBeVisible();
  await expect(clearButton(page)).toBeVisible();
  await expect(clearButton(page)).toHaveAttribute('title', 'Clear Search');
  const bar = await box(searchBar(page));
  const clear = await box(clearButton(page));
  expect(clear.x, 'the clear button sits at the right end of the bar').toBeGreaterThan(bar.x + bar.width / 2);
  expect(clear.x + clear.width).toBeLessThanOrEqual(bar.x + bar.width);
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-9, REQ-10, REQ-13 — scenario "The user clears the search"
test('"Clear Search" empties the bar, keeps the focus there and brings the full list back', async ({ page }) => {
  await page.goto('/');
  await openDialog(page);
  const full = await fullList(page);
  await page.keyboard.type('zzqx');
  await expect(dialog(page)).toContainText('No sessions match "zzqx".');

  await clearButton(page).click();

  await expect(searchBar(page)).toHaveValue('');
  await expect(searchBar(page)).toBeFocused();
  await expect.poll(() => shownList(page)).toEqual(full);
  await expect(clearButton(page)).toHaveCount(0);
  await expect(dialog(page)).not.toContainText('No sessions match');
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-10: deleting the text by hand also brings the full list back
test('an emptied bar shows the full list', async ({ page }) => {
  await page.goto('/');
  await openDialog(page);
  const full = await fullList(page);
  await page.keyboard.type('login');
  await expect.poll(async () => (await shownList(page)).length).toBe(4);

  for (let i = 0; i < 'login'.length; i++) await page.keyboard.press('Backspace');

  await expect(searchBar(page)).toHaveValue('');
  await expect.poll(() => shownList(page)).toEqual(full);
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-12 — scenario "The user resumes a session from a filtered list"
test('a session chosen in a filtered list resumes as from the full list', async ({ page }) => {
  await page.goto('/');
  await openDialog(page);
  await page.keyboard.type('login');
  await pastEntry(page, auth, 'Fix the Login form validation').click();
  const resumed = page.waitForResponse((r) => isResumeRequest(r.url(), r.request().method()));

  await resumeButton(page).click();

  const response = await resumed;
  expect(response.status()).toBe(201);
  startedIds.push(((await response.json()) as { id: string }).id);
  await expect(dialog(page)).toBeHidden();
  await expect(terminal(page)).toContainText(`CWD:${auth}`);
  await expect(terminal(page)).toContainText('"--resume","e2e-search-auth-1"');
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-12, ResumeDialog: a filtered session running in a terminal goes through RunningElsewhereWarning
test('a filtered session running in a terminal still asks for confirmation before resuming', async ({ page }) => {
  const process = spawn('sleep', ['120'], { stdio: 'ignore' });
  terminals.push(process);
  await mkdir(path.join(E2E_CLAUDE_DIR, 'sessions'), { recursive: true });
  await writeFile(path.join(E2E_CLAUDE_DIR, 'sessions', `${process.pid}.json`), JSON.stringify({ pid: process.pid, sessionId: 'e2e-search-auth-4' }));
  const resumeRequests: string[] = [];
  page.on('request', (r) => {
    if (isResumeRequest(r.url(), r.method())) resumeRequests.push(r.url());
  });

  await page.goto('/');
  await openDialog(page);
  await page.keyboard.type('rotate');
  const entry = pastEntry(page, auth, 'Rotate the Login tokens');
  await expect(entry).toHaveAccessibleDescription(/Running in a terminal/);
  await entry.click();
  await resumeButton(page).click();

  await expect(warning(page)).toBeVisible();
  expect(resumeRequests).toEqual([]);
  await warning(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(warning(page)).toBeHidden();
  await expect(dialog(page)).toBeVisible();
  expect(resumeRequests).toEqual([]);
});

// ResumeDialog: the filter hides the selected session → no session is selected and "Resume" is disabled
test('hiding the selected session clears the selection and disables "Resume"', async ({ page }) => {
  await page.goto('/');
  await openDialog(page);
  await page.keyboard.type('login');
  await pastEntry(page, shop, 'login button styling').click();
  await expect(resumeButton(page)).toBeEnabled();

  await searchBar(page).fill('fix the');

  await expect(pastEntry(page, shop, 'login button styling')).toHaveCount(0);
  await expect(resumeButton(page)).toBeDisabled();
  await clearButton(page).click();
  await expect(pastEntry(page, shop, 'login button styling')).not.toBeChecked();
  await expect(dialog(page).getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(resumeButton(page)).toBeDisabled();
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-15 — scenario "Enter in the search bar resumes nothing"
test('Enter in the search bar resumes nothing and keeps the dialog and the list', async ({ page }) => {
  const resumeRequests: string[] = [];
  page.on('request', (r) => {
    if (isResumeRequest(r.url(), r.method())) resumeRequests.push(r.url());
  });
  await page.goto('/');
  await openDialog(page);
  await page.keyboard.type('login');
  await pastEntry(page, auth, 'Refactor LOGIN redirect').click();
  const filtered = await shownList(page);
  await searchBar(page).click();

  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  expect(resumeRequests).toEqual([]);
  await expect(dialog(page)).toBeVisible();
  await expect(searchBar(page)).toHaveValue('login');
  expect(await shownList(page)).toEqual(filtered);
  await expect(page.getByText('No open session.')).toBeVisible();
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-14 — scenario "Esc closes the dialog while searching"
test('Esc closes the dialog when the bar has the focus and contains text', async ({ page }) => {
  await page.goto('/');
  await openDialog(page);
  await page.keyboard.type('login');
  await expect(searchBar(page)).toBeFocused();

  await page.keyboard.press('Escape');

  await expect(dialog(page)).toBeHidden();
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-14: Esc with the empty, focused bar
test('Esc closes the dialog when the bar is empty and focused', async ({ page }) => {
  await page.goto('/');
  await openDialog(page);
  await expect(searchBar(page)).toBeFocused();

  await page.keyboard.press('Escape');

  await expect(dialog(page)).toBeHidden();
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-11 — scenario "The search starts empty at each opening"
test('the bar is empty and the full list shows at each opening', async ({ page }) => {
  await page.goto('/');
  await openDialog(page);
  const full = await fullList(page);
  await page.keyboard.type('login');
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();

  await openDialog(page);
  await expect(searchBar(page)).toHaveValue('');
  await expect(searchBar(page)).toBeFocused();
  await expect.poll(() => shownList(page)).toEqual(full);

  await page.keyboard.type('zzqx');
  await dialog(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await openDialog(page);
  await expect(searchBar(page)).toHaveValue('');
  await expect.poll(() => shownList(page)).toEqual(full);
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-16: with some hundreds of past sessions, each keystroke shows its result within 100 ms
test('with some hundreds of past sessions each keystroke updates the list with no visible delay', async ({ page }) => {
  await page.goto('/');
  await openDialog(page);
  const full = await fullList(page);
  await searchBar(page).evaluate((input) => {
    const w = window as unknown as { keyLatencies: number[] };
    w.keyLatencies = [];
    input.addEventListener('keydown', () => {
      const start = performance.now();
      requestAnimationFrame(() => setTimeout(() => w.keyLatencies.push(performance.now() - start), 0));
    });
  });

  await page.keyboard.type('login');
  await expect.poll(async () => (await shownList(page)).length).toBe(4);
  for (let i = 0; i < 'login'.length; i++) await page.keyboard.press('Backspace');
  await expect.poll(() => shownList(page)).toEqual(full);

  const latencies = await page.evaluate(() => (window as unknown as { keyLatencies: number[] }).keyLatencies);
  expect(latencies).toHaveLength(10);
  expect(Math.max(...latencies), `keystroke to painted frame, ms: ${latencies.map((l) => l.toFixed(0)).join(', ')}`).toBeLessThan(100);
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-17: the bar has the field look of the dialogs (WebEntry path field), with a muted search icon on the left
test('the search bar has the look of the dialog fields', async ({ page }) => {
  const look = (field: Locator) =>
    field.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        background: s.backgroundColor,
        border: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
        radius: s.borderTopLeftRadius,
        font: `${s.fontFamily} ${s.fontSize} ${s.lineHeight}`,
        colour: s.color,
        height: el.getBoundingClientRect().height,
      };
    });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('button', { name: 'New Claude Code Session', exact: true }).click();
  const pathField = page.getByRole('textbox', { name: 'Working Directory Path', exact: true });
  await expect(pathField).toBeFocused();
  const reference = await look(pathField);
  await page.keyboard.press('Escape');
  await expect(pathField).toBeHidden();

  await openDialog(page);
  await expect(searchBar(page)).toBeFocused();
  expect(await look(searchBar(page))).toEqual(reference);

  const muted = await resolvedColour(page, '--text-muted');
  expect(await searchBar(page).evaluate((el) => getComputedStyle(el, '::placeholder').color)).toBe(muted);
  const icon = searchBar(page).locator('xpath=..').locator('svg').first();
  const bar = await box(searchBar(page));
  const iconBox = await box(icon);
  expect(iconBox.y, 'the search icon sits inside the bar').toBeGreaterThanOrEqual(bar.y);
  expect(iconBox.y + iconBox.height).toBeLessThanOrEqual(bar.y + bar.height);
  expect(iconBox.x).toBeGreaterThanOrEqual(bar.x);
  expect(iconBox.x + iconBox.width, 'the search icon sits on the left').toBeLessThan(bar.x + bar.width / 2);
  expect(await icon.evaluate((el) => getComputedStyle(el).color)).toBe(muted);
});
