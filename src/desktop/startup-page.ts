import { createHash } from 'node:crypto';

export type StartupState = { kind: 'loading' } | { kind: 'error'; outputLines: readonly string[] };

const STYLE = `
  :root { color-scheme: light; }
  html, body { height: 100%; margin: 0; }
  body {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;
    padding: 80px 32px 32px; box-sizing: border-box;
    background: #f4f1ea; color: #1c1917;
    font: 14px/20px 'Roboto Flex', Roboto, system-ui, sans-serif;
  }
  .title-bar {
    position: fixed; top: 0; left: 0; right: 0; height: 48px; box-sizing: border-box;
    background: #efeae0; border-bottom: 1px solid rgba(28, 25, 23, 0.08);
    -webkit-app-region: drag;
  }
  .window-buttons {
    position: absolute; top: 18px; left: 14px; display: flex; gap: 8px;
    -webkit-app-region: no-drag;
  }
  .window-button {
    display: flex; align-items: center; justify-content: center;
    width: 12px; height: 12px; padding: 0; border: 0; border-radius: 50%;
    color: rgba(0, 0, 0, 0.52); cursor: pointer;
  }
  .window-button:focus-visible { outline: 2px solid #0065ae; outline-offset: 2px; }
  .window-close { background: #ff5f57; }
  .window-minimize { background: #febc2e; }
  .window-maximize { background: #28c840; }
  .window-button svg {
    width: 8px; height: 8px; fill: none; stroke: currentColor; stroke-width: 3;
    stroke-linecap: round; stroke-linejoin: round; visibility: hidden;
  }
  .window-buttons:hover svg { visibility: visible; }
  .window-maximize.maximized .maximize-symbol, .window-maximize:not(.maximized) .restore-symbol { display: none; }
  .spinner {
    width: 24px; height: 24px; border-radius: 50%;
    border: 3px solid #e4ded2; border-top-color: #0065ae;
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .message { margin: 0; color: #57534e; }
  .error { margin: 0; color: #9f1239; font-weight: 600; }
  .output {
    margin: 0; max-width: min(960px, 100%); max-height: 60vh; overflow: auto;
    padding: 12px 16px; border: 1px solid #e4ded2; border-radius: 8px; background: #fcfaf5;
    color: #67625c; font: 12px/18px 'Roboto Mono', ui-monospace, monospace; white-space: pre-wrap;
  }
`;

const SVG_OPEN = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"';

// Symbols copied from the Lucide icons x, minus, maximize-2 and minimize-2 of IconSet.
const WINDOW_BUTTONS = `<div class="window-buttons">\
<button type="button" class="window-button window-close" id="window-close" aria-label="Close">${SVG_OPEN}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>\
<button type="button" class="window-button window-minimize" id="window-minimize" aria-label="Minimize">${SVG_OPEN}><path d="M5 12h14"/></svg></button>\
<button type="button" class="window-button window-maximize" id="window-maximize" aria-label="Maximize">\
${SVG_OPEN} class="maximize-symbol"><path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/><path d="M9 21H3v-6"/></svg>\
${SVG_OPEN} class="restore-symbol"><path d="m14 10 7-7"/><path d="M20 10h-6V4"/><path d="m3 21 7-7"/><path d="M4 14h6v6"/></svg>\
</button></div>`;

const SCRIPT = `
const bridge = window.desktopBridge;
const maximize = document.getElementById('window-maximize');
const showMaximized = (maximized) => {
  maximize.classList.toggle('maximized', maximized);
  maximize.setAttribute('aria-label', maximized ? 'Restore' : 'Maximize');
};
if (bridge) {
  document.getElementById('window-close').addEventListener('click', () => bridge.closeWindow());
  document.getElementById('window-minimize').addEventListener('click', () => bridge.minimizeWindow());
  maximize.addEventListener('click', () => bridge.toggleMaximizeWindow());
  bridge.onWindowMaximizedChange(showMaximized);
  bridge.isWindowMaximized().then(showMaximized);
}
`;
const SCRIPT_HASH = createHash('sha256').update(SCRIPT).digest('base64');

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function body(state: StartupState): string {
  if (state.kind === 'loading') {
    return '<div class="spinner" aria-hidden="true"></div><p class="message" role="status">Starting the backend…</p>';
  }
  const output = state.outputLines.map(escapeHtml).join('\n');
  return `<p class="error" role="alert">The backend could not start.</p><pre class="output">${output}</pre>`;
}

export function startupPageHtml(state: StartupState): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'sha256-${SCRIPT_HASH}'">
<title>Vexel for Claude</title>
<style>${STYLE}</style>
</head>
<body><div class="title-bar">${WINDOW_BUTTONS}</div>${body(state)}<script>${SCRIPT}</script></body>
</html>
`;
}

export function startupPageUrl(state: StartupState): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(startupPageHtml(state))}`;
}
