# Security Policy

Vexel for Claude reads your Claude Code files, hosts terminals, and (for the plan usage view) uses your Claude login token, so security reports are taken seriously.

## Threat model: this is a local client

Vexel for Claude is a **local, single-user client**. It is meant to run on your own machine, for you alone, and it trusts everything that already runs there as you.

- The backend listens on `127.0.0.1` only, so other machines on the network cannot reach it. It also rejects requests whose `Host` or `Origin` is not local, which blocks other websites (including DNS rebinding).
- **It does not authenticate local callers.** Any process, and any other user account, on the same machine can connect to the backend port. A request without an `Origin` header (a script, `curl`) is accepted. Such a caller can start a Claude Code session in any folder and type into its terminal, so it can do whatever Claude Code can do as your user.
- Because of this, **do not run Vexel on a shared or multi-user machine**, and do not expose its port with a tunnel, a port forward or a container port mapping.
- Local callers are therefore **out of scope** for vulnerability reports. Reports about a website, or a machine on the network, reaching the backend are in scope (see below).

Local authentication, for example a random token for each launch, is a possible future improvement.

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
