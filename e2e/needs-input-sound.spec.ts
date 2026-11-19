// e2e of plan-input_sound, batch needs-input-sound: the page side of the sound, in the browser. The desktop window itself is in desktop-sound.spec.ts.
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Page, expect, test } from '@playwright/test';
import { currentView } from './motion';

let projectsRoot: string;
const createdIds: string[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-sound-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const header = (page: Page) => currentView(page).locator('.session-header');

async function startSession(request: APIRequestContext, name: string): Promise<{ id: string; folder: string }> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder, { recursive: true });
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  createdIds.push(id);
  return { id, folder };
}

type SoundProbe = { plays: string[]; listeners: number; requestSound(): void };

/** Records each play of an audio element, without playing it. */
async function recordPlays(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const plays: string[] = [];
    Object.assign(window, { e2eSound: { plays, listeners: 0, requestSound: () => {} } });
    HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement) {
      plays.push(this.src);
      return Promise.resolve();
    };
  });
}

/** Plays the DesktopBridge preload with `onPlaySound`: the test sends the sound requests. */
async function installFakeBridge(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const listeners = new Set<() => void>();
    const probe = (window as unknown as { e2eSound: SoundProbe }).e2eSound;
    probe.requestSound = () => listeners.forEach((listener) => listener());
    Object.assign(window, {
      desktopBridge: {
        reportOpenSession: () => {},
        onOpenSession: () => () => {},
        getPathForFile: () => '',
        onPlaySound: (listener: () => void) => {
          listeners.add(listener);
          probe.listeners = listeners.size;
          return () => {
            listeners.delete(listener);
            probe.listeners = listeners.size;
          };
        },
      },
    });
  });
}

const probe = (page: Page) => page.evaluate(() => {
  const { plays, listeners } = (window as unknown as { e2eSound: SoundProbe }).e2eSound;
  return { plays: [...plays], listeners };
});
const requestSound = (page: Page) => page.evaluate(() => (window as unknown as { e2eSound: SoundProbe }).e2eSound.requestSound());

// plan-input_sound/REQ-1, REQ-9; scenario "A sound plays when Claude asks for a permission" (page side)
test('in the desktop page, each sound request plays the chime once and the page keeps reacting to clicks', async ({ page, request }) => {
  const target = await startSession(request, 'sound-request');
  await recordPlays(page);
  await installFakeBridge(page);
  await page.goto('/');
  await expect(entry(page, target.folder)).toBeVisible();
  // AppLayout mounts the player once: one listener, so one play per request.
  await expect.poll(async () => (await probe(page)).listeners).toBe(1);
  expect((await probe(page)).plays).toEqual([]);

  await requestSound(page);
  await entry(page, target.folder).getByTitle(target.folder, { exact: true }).click();
  await expect(header(page).getByRole('heading', { level: 2 })).toHaveText('sound-request', { timeout: 2000 });

  await requestSound(page);
  const { plays } = await probe(page);
  expect(plays).toHaveLength(2);
  expect(plays[0]).toMatch(/needs-input-chime.*\.wav$/);
  expect(plays[1]).toBe(plays[0]);

  // NeedsInputChime: the web build serves it as a page asset.
  const chime = await request.get(plays[0]!);
  expect(chime.status()).toBe(200);
  expect((await chime.body()).subarray(0, 4).toString('ascii')).toBe('RIFF');
});

// plan-input_sound constraint "only the desktop app plays the sound": a browser has no bridge
test('in a browser, a session that enters needs input plays no sound', async ({ page, request }) => {
  const target = await startSession(request, 'sound-browser');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await recordPlays(page);
  await page.goto('/');
  await expect(entry(page, target.folder)).toBeVisible();

  await request.post(`/api/sessions/${target.id}/hook-events`, { data: { hook_event_name: 'UserPromptSubmit', prompt: 'Fix the cart' } });
  await request.post(`/api/sessions/${target.id}/hook-events`, { data: { hook_event_name: 'PermissionRequest', tool_name: 'Bash' } });
  await expect(entry(page, target.folder)).toContainText('Needs Input');
  await page.waitForTimeout(1500);

  expect((await probe(page)).plays).toEqual([]);
  expect(errors).toEqual([]);
});
