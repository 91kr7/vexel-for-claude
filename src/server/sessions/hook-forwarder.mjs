// Claude Code command hook: posts the hook input to the client server. It prints nothing and always exits 0.
const [serverUrl] = process.argv.slice(2);
const sessionId = process.env.AI_CLIENT_SESSION_ID;
const TIMEOUT_MS = 3000;

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);

if (serverUrl && sessionId) {
  try {
    await fetch(`${serverUrl}/api/sessions/${encodeURIComponent(sessionId)}/hook-events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: Buffer.concat(chunks),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // An unreachable server must never block or fail the Claude turn.
  }
}
process.exit(0);
