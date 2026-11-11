# Security Policy

Vexel for Claude reads your Claude Code files, hosts terminals, and (for the plan usage view) uses your Claude login token, so security reports are taken seriously.

## Supported versions

Only the latest release and the `main` branch receive fixes.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Use GitHub's private reporting: go to the **Security** tab of this repository and click **Report a vulnerability**. Include what you found, how to reproduce it and what it lets an attacker do.

You can expect a first reply within a few days. Fixes are released as soon as they are ready, and you will be credited unless you prefer otherwise.

## What is in scope

- Anything that lets a website or another machine reach the local backend (it must only accept local `Host` and `Origin`).
- Leaking the Claude OAuth token, or any file content, outside the local machine other than the documented call to `api.anthropic.com`.
- Command injection through folder names, dropped file paths or session names.

## Known and documented behaviour

These are intended, and described in the README: the app reads `~/.claude` (transcripts and `.credentials.json`), and sends the token to `https://api.anthropic.com/api/oauth/usage` to show plan limits.
