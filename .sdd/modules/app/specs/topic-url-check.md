---
module: app
component: checkTopicUrl
type: frontend function
---

# checkTopicUrl

**Purpose** → tells whether a text is a valid ntfy topic URL, or why it is not.

## Contract

- `checkTopicUrl(value: string) → { status: 'empty' } | { status: 'valid' } | { status: 'invalid', reason: string }`

```
if value has only spaces or nothing          → empty
if URL cannot parse value
   or the scheme is not http: or https:
   or the host is empty                       → invalid, "Enter an http or https address."
topic = the last segment of the path (after the last "/")
if topic is empty                             → invalid, "Add the topic name at the end of the address."
if topic is not 1 to 64 of A-Z a-z 0-9 - _    → invalid, "The topic name may use only letters, digits, - and _."
otherwise                                     → valid
```

- examples:
  - `https://ntfy.sh/my-topic` → valid.
  - `https://ntfy.example.com/ntfy/my_topic` → valid: a sub-path before the topic is allowed.
  - `http://192.168.1.10:8080/alerts` → valid.
  - `ftp://ntfy.sh/my-topic`, `ntfy.sh/my-topic` → "Enter an http or https address."
  - `https://ntfy.sh`, `https://ntfy.sh/`, `https://ntfy.sh/my-topic/` → "Add the topic name at the end of the address."
  - `https://ntfy.sh/my topic`, `https://ntfy.sh/my.topic`, a topic of 65 characters → "The topic name may use only letters, digits, - and _."

## Rules and invariants

- The path is read as the URL parser gives it, so a space or another encoded character in the topic is a bad character.
- The query and the fragment do not count: only the path holds the topic.

## Requirements served

- `plan-remote_notifications/REQ-6`, `plan-remote_notifications/REQ-9`
