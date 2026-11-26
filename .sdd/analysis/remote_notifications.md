---
request_slug: remote_notifications
date: 2026-11-26
type: evolution
size: ordinary
reference: .sdd/analysis/input_sound.md
---

# Analysis — Remote notification to the phone through ntfy

## Request

> voglio poter configurare all'interno delle impostazioni uno URL di https://ntfy.sh/ al fine di poter inviare una notifica al mio smartphone quando Claude richiede un input.
> Di conseguenza ti proporrei di rinominare l'impostazione audio in notifications e in questo modo all'interno possiamo decidere se riprodurre un audio quando arriva una notifica e se mandare una notifica remota tramite il link che ti ho mandato sopra. Ti direi che all'interno delle impostazioni notifiche va messo come penultimo menu. L'ultimo deve essere sempre quello relativo all'update. Vedi te cosa scrivere nella notifica remota che mandi. Fai in modo comunque che chi la riceve abbia tutte le informazioni per capire cosa sta chiedendo Claude. Secondo te è possibile inoltre creare un canale di comunicazione tramite NTFY? Quindi Claude manderà notifica, se io rispondo alla notifica nello stesso chat, Claude legge la risposta e procede con il workflow.

## Reference

[input_sound.md](input_sound.md) → the desktop app plays a sound when a hosted or external session enters "needs input". An on/off switch in the settings popup controls it. The needs-input detection and the notifications come from [session_notifications.md](session_notifications.md). The settings popup and its sections come from [settings_dialog.md](settings_dialog.md).

Changes:
- The settings section of the sound becomes "Notifications". It holds the sound switch and the new remote notification settings.
- The desktop app sends a notification to an ntfy topic when a session has needed input for 60 seconds. The human decided this on 2026-11-26.
- Every other requirement of the reference stays true.

## Summary

The user sets an ntfy topic URL in the settings. When a Claude session still needs input after 60 seconds, the desktop app posts a notification to that topic. The notification tells the user on the phone what Claude is asking.

## Requirements

### Functional

When to send
- The desktop app must send a remote notification when a hosted or external session has stayed in "needs input" for 60 seconds without a break. The human decided this.
- A session that leaves "needs input" within 60 seconds must send no remote notification. The human decided this.
- A session must send at most one remote notification while it keeps needing input.
- A session that leaves "needs input" and enters it again must start a new 60-second count.
- State changes that happened before the desktop app started must not send a remote notification.
- A turn end and a session end must not send a remote notification.
- The remote notification must not depend on the window focus.

Content
- The remote notification must name the session by its project folder and its label, as the list does.
- For a permission request, it must name the tool and show what the tool will do, for example the command or the file path.
- For a question from Claude, it must show the question and its options.
- When the client does not know what is needed, it must say that the session needs input.
- It must say how long the session has been waiting.
- It must use the high priority of ntfy, so the phone shows it in front.
- A text too long for one notification must be shortened, and the notification must say that it was shortened.
- Every text must be in English, like the rest of the UI.

Settings
- The settings section of the sound must be renamed "Notifications".
- "Notifications" must be the second-to-last section of the settings popup.
- "Updates" must always be the last section. The human said this in the request.
- The section must keep the sound switch, with its behaviour of [input_sound.md](input_sound.md).
- The section must have an on/off switch for the remote notification, off by default.
- The section must have a field for the topic URL. It accepts ntfy.sh or another ntfy server.
- The section must have an optional field for an access token. The human decided this.
- The token field must hide its value, like a password field.
- The client must reject a URL that is not an http or https address with a topic, and say why.
- The remote switch must not turn on while the URL is empty or invalid.
- The section must have a "Send test notification" button. The human decided this.
- The test button must send a short test message to the topic, with the token when there is one.
- The test button must show whether the message was sent, or a short error with the reason, for example a refused token.
- Every change must apply at once, and the desktop app must remember it across restarts.
- The sound switch and the remote switch must work independently of each other.

Failures
- A failed remote notification must not delay or block the system notifications, the sound or the tray.
- A failed remote notification must not show an error to the user, except after the test button.

### Non-functional

- The remote notification must leave the desktop app within 5 seconds of the end of the 60 seconds.
- The token must not appear in logs or in error messages.

## Assumptions

- This is an evolution of [input_sound.md](input_sound.md), not a fix. The request adds a function and corrects no wrong behaviour. The gatekeeper decided this.
- Only "needs input" sends a remote notification. The request says "quando Claude richiede un input". The gatekeeper decided this.
- Only the desktop app shows these settings and sends the notification, like the sound. The gatekeeper decided this.
- The remote message carries the full detail of the request, as the human asked. The gatekeeper accepted the privacy risk below.
- A failed send does not show an error and is not repeated. The local alerts stay the main signal. The gatekeeper decided this.
- Each session sends its own remote notification, with no grouping. Each message must carry its own full detail.
- A tap on the phone notification does nothing beyond what the ntfy app does by default.

## Market trends

- Open-source tools already send Claude Code permission requests through ntfy, with Allow/Deny buttons ([claude-remote-approver](https://github.com/yuuichieguchi/claude-remote-approver), [claude-push](https://github.com/coa00/claude-push), [claude-ntfy-hook](https://adrian-gomez.github.io/claude-ntfy-hook/)).
- Anthropic offers Remote Control: it continues a local session from the Claude mobile app, with push notifications ([Remote Control](https://code.claude.com/docs/en/remote-control)).
- ntfy supports a title, a priority from 1 to 5, tags and up to three action buttons. A message over 4,096 bytes becomes an attachment ([ntfy publish](https://docs.ntfy.sh/publish/)).

## Risks

- On ntfy.sh, anyone who knows the topic name can read the messages. Commands, file paths and question text then leave the machine and pass through a third party.
- Claude Code does not hide every secret in a command. A token in a command can reach the phone and the ntfy server.
- A short or obvious topic name is easy to guess. The app does not check how strong the name is.
- No remote notification leaves while the desktop app is not running, or while the machine is offline.
- A silent failure, for example an expired token, stops the remote notifications without any sign. Only the test button shows it.
- The public ntfy.sh server limits the number of messages. Many waiting sessions can hit that limit.
- The 60-second wait delays every remote alert by one minute.

## Scope

In scope:
- The remote notification for "needs input" after 60 seconds, for hosted and external sessions, from the desktop app.
- The "Notifications" section: sound switch, remote switch, topic URL, optional access token, test button.
- The order of the settings sections: "Notifications" second-to-last, "Updates" last.

Out of scope:
- The reply channel: answering Claude from the phone through ntfy. The human decided this is a separate request. Its limits: ntfy has no inline reply, a notification has at most three buttons, only hosted sessions could receive the answer, and the topic must be protected.
- Remote notifications for turn end or session end.
- Remote notifications from the client open in a browser.
- Other push services than ntfy.
- Creating the topic or an ntfy account from the app.
- Repeated remote reminders for a session that keeps waiting.
- Any change to the sound, the system notifications or the tray.
