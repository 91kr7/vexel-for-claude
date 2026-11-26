// @vitest-environment jsdom
// Unit tests of SubagentCard as the button that opens the subagent conversation, batch subagent-conversation.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, run, unmountAll } from '../settings/settings-test-support';
import { SubagentCard, SubagentStatePill } from './SubagentCard';
import type { TurnSubagent } from './turn-store';

const subagent = (fields: Partial<TurnSubagent> = {}): TurnSubagent => ({ id: 'agent-a', type: 'Explore', description: 'Find the routes', state: 'running', groups: [], ...fields });
const opener = (host: Element, name: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);

afterEach(() => {
  unmountAll();
});

describe('SubagentCard, opening the conversation', () => {
  // plan-session_activity/REQ-49: the fields of the card are one button "Open Conversation: <type>" inside the article
  it('holds its fields in one button "Open Conversation: <type>", inside the article "Subagent: <type>"', () => {
    const host = mount(<SubagentCard subagent={subagent()} />);
    const card = host.querySelector('article[aria-label="Subagent: Explore"]')!;
    const button = opener(card, 'Open Conversation: Explore');
    expect(button).not.toBeNull();
    expect(button!.textContent).toContain('Find the routes');
    expect(button!.textContent).toContain('Running');
    expect(card.querySelectorAll('button'), 'the button is the only action').toHaveLength(1);
  });

  // subagent-card spec: no type → "Open Conversation"
  it('names the button "Open Conversation" for a subagent with no type', () => {
    const host = mount(<SubagentCard subagent={subagent({ type: undefined })} />);
    expect(opener(host, 'Open Conversation')).not.toBeNull();
  });

  // plan-session_activity/REQ-49, REQ-55: a click calls onOpen with the subagent and the button; a native button takes Enter and Space
  it('calls onOpen with the subagent and the button on a click, from a native button', () => {
    const onOpen = vi.fn();
    const shown = subagent();
    const host = mount(<SubagentCard subagent={shown} onOpen={onOpen} />);
    const button = opener(host, 'Open Conversation: Explore')!;
    expect(button.tagName).toBe('BUTTON');
    expect(button.disabled).toBe(false);
    run(() => button.click());
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(shown, button);
  });

  // subagent-card spec: a click inside the children does not call the card's onOpen
  it('does not call its onOpen for a click inside its children', () => {
    const onOpen = vi.fn();
    const host = mount(
      <SubagentCard subagent={subagent()} onOpen={onOpen}>
        <button type="button">Inner</button>
      </SubagentCard>,
    );
    run(() => [...host.querySelectorAll('button')].find((button) => button.textContent === 'Inner')!.click());
    expect(onOpen).not.toHaveBeenCalled();
  });

  // subagent-card spec: SubagentStatePill shows the state pill on its own
  it('exports the state pill: "Running", "Finished", "Stopped"', () => {
    for (const [state, text] of [
      ['running', 'Running'],
      ['finished', 'Finished'],
      ['stopped', 'Stopped'],
    ] as const) {
      const host = mount(<SubagentStatePill state={state} />);
      expect(host.textContent?.trim()).toBe(text);
    }
  });
});
