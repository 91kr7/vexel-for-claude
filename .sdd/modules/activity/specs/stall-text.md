---
module: activity
component: stallText
type: frontend function
---

# stallText

**Purpose** → the text of the stall signal of a list entry.

## Contract

- `stallText(silenceMs, waitingFor?) → string`
  - `silenceMs` → the time since the last activity.
  - `waitingFor` → the `waitingFor` of the live activity (waitingForOf, server side).

```
text = "No activity for " + shortDuration(silenceMs)
waitingFor absent     → text
waitingFor "response" → text + " · waiting for Claude's response"
waitingFor a tool     → text + " · " + type + tool + "running" + others
    type   = "<subagentType>: "  when subagentType is not empty, else ""
    tool   = "<argument> "       when argument is not empty
             "<name> "           else, when name is not empty
             ""                  else
    others = " +<others>"        when others > 0, else ""
```

Examples:
- "No activity for 8 min · mvn test running"
- "No activity for 8 min · sdd-tester: mvn test running +2"
- "No activity for 6 min · WebSearch running"
- "No activity for 8 min · waiting for Claude's response"

## Dependencies

- shortDuration

## Requirements served

- `plan-session_activity/REQ-16`, `plan-session_activity/REQ-18`, `plan-session_activity/REQ-19`, `plan-session_activity/REQ-20`, `plan-session_activity/REQ-26`
