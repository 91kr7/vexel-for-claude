---
module: sessions
component: ResponseLedger
type: backend service
---

# ResponseLedger

**Purpose** → the responses of one session, one record per response, with the sums of their tokens.

## Contract

- `new ResponseLedger()` → no response.
- `add(response)` → `response` is a ModelResponse (modelResponseOf), from any file of the session.
- `totals() → TokenTotals | undefined` → `{ input, output, cacheWrite, cacheRead }`: the sums over the records. `undefined` when the ledger has no record, never zeros.

A response with a key already in the ledger:

```
new output >  recorded output → the new response replaces the record
new output =  recorded output → the new response replaces the record (the later line wins)
new output <  recorded output → no change
```

## Rules and invariants

- One record per `key`: a response counts once, whatever the number of its lines or files.
- A replaced record takes its counts out of the sums and the new record puts its own in. The sums never go back over every record.
- `totals()` gives a copy: changing it does not change the ledger.
- It counts every response it gets, main conversation and subagents alike.

## Dependencies

- modelResponseOf (type ModelResponse)

## Requirements served

- `plan-session_usage/REQ-14`, `plan-session_usage/REQ-15`, `plan-session_usage/REQ-21`
