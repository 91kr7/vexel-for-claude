# Vexel for Claude

**One window for all your Claude Code sessions.** Run several interactive [Claude Code](https://code.claude.com) sessions side by side, see at a glance which ones are working, which need your input, and what each one costs.

[![CI](https://github.com/91kr7/vexel-for-claude/actions/workflows/ci.yml/badge.svg)](https://github.com/91kr7/vexel-for-claude/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Platform: Linux](https://img.shields.io/badge/platform-Linux-lightgrey)
![Node >= 22](https://img.shields.io/badge/node-%3E%3D22-339933)

<!-- TODO: add a screenshot or a short GIF here, e.g. docs/screenshot.png -->

> **Not affiliated with Anthropic.** Vexel for Claude is an independent, community project that drives the official `claude` command-line tool. "Claude" and "Claude Code" are trademarks of Anthropic, PBC.

## Why

Claude Code is a terminal tool. When you work on several tasks at once you end up with a pile of terminal tabs and no idea which one is waiting for you. Vexel puts them in one place and tells you when one needs attention.

## Features

- **Hosted sessions** – start Claude Code sessions inside the app, each in a real pseudo-terminal rendered with xterm.js.
- **External sessions** – see and read sessions you started elsewhere, and resume past ones, from Claude Code's own history.
- **Session states** – working, needs input, idle, ended. A badge counts the sessions waiting for you.
- **Notifications** – desktop notifications and a tray icon when a session needs your input.
- **Context, tokens and cost** – context window occupancy, tokens consumed and an estimated cost for every session, subagents included.
- **Plan usage** – your Claude plan limits and when they reset.
- **Git explorer** – changes, diffs and commit history of the session's folder, refreshed at the end of each turn.
- **Terminal comforts** – search, font zoom, clickable links, drag and drop files into the terminal.
- **Organise** – rename, favourite, reorder and dismiss sessions; history search.
- **Keyboard first** – a shortcut for navigation and for the main session actions (press the keyboard button in the top bar to see them all).
- **Light and dark themes.**

## Requirements

- **Linux** (macOS and Windows are not supported yet)
- **Node.js 22 or newer**
- The [`claude` CLI](https://code.claude.com/docs/en/setup) installed and logged in
- Build tools for the native `node-pty` module (`build-essential` and `python3` on Debian/Ubuntu)

## Install and run

```bash
git clone https://github.com/91kr7/vexel-for-claude.git
cd vexel-for-claude
npm install
npm run build
```

Then pick how you want to use it:

```bash
# Desktop window with tray icon (Electron). Starts the backend for you.
npm run desktop

# Add a "Vexel for Claude" entry to your Linux application menu
npm run desktop:install

# Or in a browser, at http://127.0.0.1:4001
npm start
```

Closing the desktop window does not stop your sessions: they keep running in the background and the tray icon brings the window back. Quit from the tray icon to stop them.

### Development

```bash
npm run dev          # backend + Vite dev server with hot reload
npm run build        # type-check and build the web client
npm test             # unit tests (run `npm run build` once first)
npm run test:e2e     # browser end-to-end tests (use a fake Claude CLI, never the real one)
```

### Configuration

| Variable | Purpose |
|----------|---------|
| `PORT` | Backend port (default `3000`; `npm start` uses `4001`) |
| `CLAUDE_CONFIG_DIR` | Claude Code's config folder (default `~/.claude`) |
| `AI_CLIENT_CLAUDE_CLI` | Path of the `claude` executable to launch |
| `AI_CLIENT_DATA_DIR` | Where Vexel stores its own data (session names, favourites) |

## Privacy and security

Please read this before you install.

- **Local only.** The backend listens on `127.0.0.1` and rejects requests whose `Host` or `Origin` is not local, so other websites and other machines cannot reach your sessions.
- **It reads your Claude Code files.** To list sessions and compute usage it reads the transcripts under `~/.claude` (read-only).
- **It reads your Claude login token (for plan usage only).** The "Plan usage" view reads `claudeAiOauth.accessToken` from `~/.claude/.credentials.json` and sends it to `https://api.anthropic.com/api/oauth/usage`, the same endpoint Claude Code's `/usage` uses. This is the **only** outbound network request the app makes. The token never reaches the browser page and is never stored. That endpoint is undocumented, so it may change or stop working at any time, and you should decide for yourself whether you are comfortable with this use of your token.
- **Hooks.** To know when a session needs input, Vexel starts the sessions it hosts with a temporary settings file that registers Claude Code hooks pointing at its own local backend. Your own `~/.claude/settings.json` is not modified.
- **Session content is sensitive.** Terminals, transcripts and git diffs can contain secrets. Be careful with screen sharing.

Found a vulnerability? See [SECURITY.md](SECURITY.md).

## Project layout

```
src/server/   Fastify backend: sessions, PTYs over WebSocket, git, history, usage
src/web/      React + Vite client
src/desktop/  Electron shell: window, tray, notifications
e2e/          Playwright end-to-end tests
.sdd/         Specs, plans and analyses the app was built from
.claude/      The spec-driven development workflow (agents, commands, conventions) used to build it
```

The project was developed with a spec-driven workflow: every feature has a written analysis, a plan and component specs under `.sdd/`, and the code is derived from them. They double as documentation of why things work the way they do.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first, and please open an issue before starting a large change.

## Third-party software

See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) (Roboto fonts, Lucide icons).

## License

[MIT](LICENSE) © 2026 91kr7
