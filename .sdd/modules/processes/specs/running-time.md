---
module: processes
component: runningTimeText
type: frontend function
---

# runningTimeText

**Purpose** → the running time of a process as short text.

## Contract

- `runningTimeText(startedAt, now) → string` → both in epoch ms. Elapsed time below 0 counts as 0.

```
s = whole seconds elapsed
s < 60          → "<s>s"            e.g. "42s"
s < 3600        → "<m>m"            e.g. "5m"
s < 86400       → "<h>h <mm>m"      e.g. "2h 05m"  (minutes on two digits)
otherwise       → "<d>d <h>h"       e.g. "3d 4h"
```

## Requirements served

- `plan-app_processes/REQ-13`
