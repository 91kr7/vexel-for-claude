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
<body><div class="title-bar"></div>${body(state)}</body>
</html>
`;
}

export function startupPageUrl(state: StartupState): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(startupPageHtml(state))}`;
}
