// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProcessRow } from './processes-client';
import { TerminateProcessDialog } from './TerminateProcessDialog';
import { keydown, mount, run, unmountAll } from './settings-test-support';

// Unit tests of the TerminateProcessDialog spec, plan-app_processes/REQ-24 to REQ-27, REQ-33.
const OWN: ProcessRow = { kind: 'test-server', pid: 101, startedAt: 1000, port: 3100, thisInstance: true, hosted: false, hanging: false };
const OTHER: ProcessRow = { kind: 'app-server', pid: 102, startedAt: 1000, port: 3200, thisInstance: false, hosted: false, hanging: false };
const TEST_SERVER: ProcessRow = { kind: 'test-server', pid: 105, startedAt: 1000, port: 3300, thisInstance: false, hosted: false, hanging: true };
const SESSION: ProcessRow = {
  kind: 'claude-session',
  pid: 103,
  startedAt: 1000,
  folder: '/home/me/project',
  label: 'Fix the bug',
  thisInstance: false,
  hosted: true,
  hanging: false,
};
const FAKE: ProcessRow = { kind: 'fake-claude', pid: 104, startedAt: 1000, thisInstance: false, hosted: false, hanging: true };

const OWN_TEXT = 'This is the instance you are using. Terminating it closes the app and ends every session it hosts.';
const HOSTS_TEXT = 'The sessions it hosts end too.';

afterEach(unmountAll);

function open(row: ProcessRow) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  mount(<TerminateProcessDialog row={row} onConfirm={onConfirm} onCancel={onCancel} />);
  const dialog = document.querySelector<HTMLElement>('[role="alertdialog"]');
  expect(dialog).not.toBeNull();
  return { dialog: dialog!, onConfirm, onCancel };
}

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const button = (dialog: HTMLElement, name: string) =>
  [...dialog.querySelectorAll('button')].find((candidate) => text(candidate) === name) as HTMLButtonElement | undefined;
const boldTexts = (dialog: HTMLElement) => [...dialog.querySelectorAll('strong, b')].map(text);

describe('TerminateProcessDialog', () => {
  // plan-app_processes/REQ-24: the style of the session stop confirmation, "Cancel" focused first
  it('is a rose warning dialog titled "Terminate the Process?" with "Cancel" focused and the primary "Terminate"', () => {
    const { dialog } = open(OTHER);
    expect(text(document.getElementById(dialog.getAttribute('aria-labelledby') ?? ''))).toBe('Terminate the Process?');
    expect(document.activeElement).toBe(button(dialog, 'Cancel'));
    expect(button(dialog, 'Terminate')?.classList.contains('button-danger')).toBe(true);
  });

  // plan-app_processes/REQ-25, REQ-27
  it('names another app server with its kind, PID and port, and says its sessions end too', () => {
    const { dialog } = open(OTHER);
    expect(boldTexts(dialog)).toContain('App server · PID 102');
    expect(text(dialog)).toContain('App server · PID 102 · port 3200');
    expect(text(dialog)).toContain(HOSTS_TEXT);
    expect(text(dialog)).not.toContain(OWN_TEXT);
  });

  // plan-app_processes/REQ-25, REQ-26
  it('warns that terminating the current instance closes the app and ends every session it hosts', () => {
    const { dialog } = open(OWN);
    expect(boldTexts(dialog)).toContain('Test server · PID 101');
    expect(text(dialog)).toContain('Test server · PID 101 · port 3100');
    expect(text(dialog)).toContain(OWN_TEXT);
    expect(text(dialog)).not.toContain(HOSTS_TEXT);
  });

  it('says that the sessions of another test server end too', () => {
    const { dialog } = open(TEST_SERVER);
    expect(text(dialog)).toContain('Test server · PID 105 · port 3300');
    expect(text(dialog)).toContain(HOSTS_TEXT);
  });

  // plan-app_processes/REQ-25: the session label when there is no port
  it('names a Claude session with its label and adds no warning text', () => {
    const { dialog } = open(SESSION);
    expect(boldTexts(dialog)).toContain('Claude session · PID 103');
    expect(text(dialog)).toContain('Claude session · PID 103 · Fix the bug');
    expect(text(dialog)).not.toContain(HOSTS_TEXT);
    expect(text(dialog)).not.toContain(OWN_TEXT);
  });

  it('names a fake Claude with no port and no label by its kind and PID only', () => {
    const { dialog } = open(FAKE);
    expect(boldTexts(dialog)).toContain('Fake Claude · PID 104');
    expect(text(dialog)).not.toMatch(/PID 104 ·/);
    expect(text(dialog)).not.toContain('undefined');
    expect(text(dialog)).not.toContain(HOSTS_TEXT);
  });

  it('prefers the port over the label when the row has both', () => {
    const { dialog } = open({ ...OTHER, label: 'Some label' });
    expect(text(dialog)).toContain('App server · PID 102 · port 3200');
    expect(text(dialog)).not.toContain('Some label');
  });

  it('"Terminate" confirms', () => {
    const { dialog, onConfirm, onCancel } = open(FAKE);
    run(() => button(dialog, 'Terminate')?.click());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('"Cancel" cancels', () => {
    const { dialog, onConfirm, onCancel } = open(FAKE);
    run(() => button(dialog, 'Cancel')?.click());
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // plan-app_processes/REQ-33
  it('Esc cancels', () => {
    const { dialog, onConfirm, onCancel } = open(FAKE);
    run(() => keydown(document.activeElement ?? dialog, 'Escape'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('"[Esc]" cancels', () => {
    const { dialog, onCancel } = open(FAKE);
    run(() => button(dialog, '[Esc]')?.click());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
