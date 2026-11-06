import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LIST_WIDTH,
  LIST_WIDTH_KEY,
  ListWidthStore,
  MAX_LIST_WIDTH,
  MIN_LIST_WIDTH,
  MIN_MAIN_AREA_WIDTH,
  listWidthLimit,
  pageListWidthStore,
  shownListWidth,
  useListWidth,
} from './list-width-store';

function memoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(LIST_WIDTH_KEY, initial);
  return {
    values,
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => void values.set(key, value)),
  };
}

const throwing = () => {
  throw new Error('storage blocked');
};

describe('ListWidthStore limits', () => {
  it('uses 180, 480 and 224 px for the list panel and 700 px for the main area', () => {
    expect([MIN_LIST_WIDTH, MAX_LIST_WIDTH, DEFAULT_LIST_WIDTH, MIN_MAIN_AREA_WIDTH]).toEqual([180, 480, 224, 700]);
    expect(LIST_WIDTH_KEY).toBe('ai-client.list-width');
  });
});

describe('ListWidthStore at creation', () => {
  // plan-session_list_width/REQ-8, REQ-9: the saved width is read synchronously at creation
  it.each(['180', '304', '480'])('starts from the saved width %s', (saved) => {
    expect(new ListWidthStore(memoryStorage(saved)).getSnapshot()).toBe(Number(saved));
  });

  // plan-session_list_width/REQ-7
  it.each([
    ['no saved value', undefined],
    ['text that is not a number', 'wide'],
    ['an empty text', ''],
    ['a value under 180', '179'],
    ['a value over 480', '481'],
    ['a value that is not whole', '250.5'],
  ])('starts at 224 px with %s', (_case, saved) => {
    expect(new ListWidthStore(memoryStorage(saved)).getSnapshot()).toBe(224);
  });

  it('starts at 224 px with no storage', () => {
    expect(new ListWidthStore().getSnapshot()).toBe(224);
  });

  it('starts at 224 px when reading the storage throws', () => {
    expect(new ListWidthStore({ getItem: throwing, setItem: vi.fn() }).getSnapshot()).toBe(224);
  });

  // plan-session_list_width/REQ-6: creating the store saves nothing
  it('reads the storage under its key and writes nothing', () => {
    const storage = memoryStorage('300');
    new ListWidthStore(storage);
    expect(storage.getItem).toHaveBeenCalledWith(LIST_WIDTH_KEY);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});

describe('ListWidthStore.preview', () => {
  // plan-session_list_width/REQ-6: a drag move changes the width without saving it
  it('changes the width and saves nothing', () => {
    const storage = memoryStorage();
    const store = new ListWidthStore(storage);
    store.preview(300);
    expect(store.getSnapshot()).toBe(300);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  // plan-session_list_width/REQ-3
  it.each([
    [100, 180],
    [179, 180],
    [481, 480],
    [5000, 480],
    [250.4, 250],
    [250.6, 251],
  ])('keeps %d as a whole number from 180 to 480 (%d)', (asked, expected) => {
    const store = new ListWidthStore(memoryStorage());
    store.preview(asked);
    expect(store.getSnapshot()).toBe(expected);
  });

  it('calls the listeners when the width changes', () => {
    const store = new ListWidthStore(memoryStorage());
    const listener = vi.fn();
    store.subscribe(listener);
    store.preview(300);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not call the listeners when the width stays the same', () => {
    const store = new ListWidthStore(memoryStorage('300'));
    const listener = vi.fn();
    store.subscribe(listener);
    store.preview(300);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('ListWidthStore.commit', () => {
  // plan-session_list_width/REQ-6, REQ-8
  it('changes the width and saves it as text under its key', () => {
    const storage = memoryStorage();
    const store = new ListWidthStore(storage);
    store.commit(304);
    expect(store.getSnapshot()).toBe(304);
    expect(storage.values.get(LIST_WIDTH_KEY)).toBe('304');
  });

  // plan-session_list_width/REQ-3
  it('saves the width kept within the limits', () => {
    const storage = memoryStorage();
    const store = new ListWidthStore(storage);
    store.commit(900);
    expect(storage.values.get(LIST_WIDTH_KEY)).toBe('480');
    store.commit(20);
    expect(storage.values.get(LIST_WIDTH_KEY)).toBe('180');
  });

  // plan-session_list_width/REQ-6: the end of a drag saves the previewed width
  it('saves the width also when it did not change', () => {
    const storage = memoryStorage();
    const store = new ListWidthStore(storage);
    store.preview(320);
    store.commit(320);
    expect(storage.setItem).toHaveBeenCalledWith(LIST_WIDTH_KEY, '320');
  });

  it('a new store reads the committed width back', () => {
    const storage = memoryStorage();
    new ListWidthStore(storage).commit(410);
    expect(new ListWidthStore(storage).getSnapshot()).toBe(410);
  });

  it('changes the width and calls the listeners when saving throws', () => {
    const store = new ListWidthStore({ getItem: () => null, setItem: throwing });
    const listener = vi.fn();
    store.subscribe(listener);
    expect(() => store.commit(350)).not.toThrow();
    expect(store.getSnapshot()).toBe(350);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('changes the width and calls the listeners with no storage', () => {
    const store = new ListWidthStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.commit(350);
    expect(store.getSnapshot()).toBe(350);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('ListWidthStore.subscribe', () => {
  it('stops calling a listener after unsubscribe', () => {
    const store = new ListWidthStore(memoryStorage());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.preview(300);
    unsubscribe();
    store.preview(310);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('listWidthLimit', () => {
  // plan-session_list_width/REQ-3, REQ-4: window - 52 px rail - 700 px main area, kept from 180 to 480
  it.each([
    [1440, 480],
    [1232, 480],
    [1231, 479],
    [1100, 348],
    [1000, 248],
    [932, 180],
    [900, 180],
    [400, 180],
  ])('at a %d px window is %d px', (windowWidth, expected) => {
    expect(listWidthLimit(windowWidth)).toBe(expected);
  });
});

describe('shownListWidth', () => {
  // plan-session_list_width/REQ-4, REQ-5
  it.each([
    [480, 1440, 480],
    [480, 1100, 348],
    [480, 900, 180],
    [224, 1100, 224],
    [300, 1000, 248],
  ])('width %d in a %d px window shows %d px', (width, windowWidth, expected) => {
    expect(shownListWidth(width, windowWidth)).toBe(expected);
  });

  // plan-session_list_width/REQ-5: a narrow window changes only the shown width
  it('leaves the stored width as it is', () => {
    const storage = memoryStorage('480');
    const store = new ListWidthStore(storage);
    shownListWidth(store.getSnapshot(), 1100);
    expect(store.getSnapshot()).toBe(480);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});

describe('useListWidth', () => {
  // plan-session_list_width/REQ-9: the first render already has the saved width
  it('gives the store width in a server render', () => {
    const store = new ListWidthStore(memoryStorage('333'));
    const Probe = () => createElement('span', null, String(useListWidth(store)));
    expect(renderToStaticMarkup(createElement(Probe))).toBe('<span>333</span>');
  });
});

describe('pageListWidthStore', () => {
  it('is one store for the page, which works without localStorage', () => {
    const store = pageListWidthStore();
    expect(pageListWidthStore()).toBe(store);
    expect(store.getSnapshot()).toBe(224);
    expect(() => store.commit(260)).not.toThrow();
    expect(store.getSnapshot()).toBe(260);
  });
});
