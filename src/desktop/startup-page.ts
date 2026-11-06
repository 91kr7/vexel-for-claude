export type StartupState = { kind: 'loading' } | { kind: 'error'; outputLines: readonly string[] };

const STYLE = `
  :root { color-scheme: dark; }
  html, body { height: 100%; margin: 0; }
  body {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;
    padding: 32px; box-sizing: border-box;
    background: #0b0b0e; color: #f3f2ee;
    font: 14px/20px 'Roboto Flex', Roboto, system-ui, sans-serif;
  }
  .spinner {
    width: 24px; height: 24px; border-radius: 50%;
    border: 3px solid #21212b; border-top-color: #8ccfff;
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .message { margin: 0; color: #a1a0ab; }
  .error { margin: 0; color: #fb7185; font-weight: 600; }
  .output {
    margin: 0; max-width: min(960px, 100%); max-height: 60vh; overflow: auto;
    padding: 12px 16px; border: 1px solid #21212b; border-radius: 8px; background: #121216;
    color: #898894; font: 12px/18px 'Roboto Mono', ui-monospace, monospace; white-space: pre-wrap;
  }
`;

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
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>Vexel for Claude</title>
<style>${STYLE}</style>
</head>
<body>${body(state)}</body>
</html>
`;
}

export function startupPageUrl(state: StartupState): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(startupPageHtml(state))}`;
}
