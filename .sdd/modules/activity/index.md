# Module activity

| Component | Type | Path | Responsibility | Spec |
|-----------|------|------|----------------|------|
| startsTurn | backend function | `src/server/activity/turn-rule.ts` | Whether a main transcript line starts a turn: a user message that is not an interrupt marker or a message added by Claude Code | `specs/turn-rule.md` |
| subagentStateOf | backend function | `src/server/activity/subagent-state.ts` | State of a subagent (running, finished, stopped), and the subagent stop notices of the main transcript | `specs/subagent-state.md` |
| TurnModel | backend service | `src/server/activity/turn-model.ts` | Current turn of one session from its transcript lines and subagent metadata: turn start, latest text of each conversation, state of each subagent | `specs/turn-model.md` |
| liveActivityOf | backend function | `src/server/activity/live-activity.ts` | Live activity of a session: at work, and the latest text of the main conversation or of a running subagent, plain and cut at 400 characters | `specs/live-activity.md` |
| ActivityMonitor | backend service | `src/server/activity/activity-monitor.ts` | Follows the main transcript, subagent files and metadata of every hosted and external session, in limited chunks, and notifies its live activity | `specs/activity-monitor.md` |
| shortDuration | frontend function | `src/web/activity/short-duration.ts` | Short text of a duration: "42 s", "3 min", "1 h 05 min" | `specs/short-duration.md` |
| ElapsedTime | UI component | `src/web/activity/ElapsedTime.tsx` | Time since a moment in the short form, refreshed every second by one shared timer of the page | `specs/elapsed-time.md` |
