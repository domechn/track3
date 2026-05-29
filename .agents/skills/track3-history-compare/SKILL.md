---
name: track3-history-compare
description: Use when the user asks to compare Track3 historical snapshots, compare two dates, find portfolio deltas, new positions, removed positions, or export comparison data.
---

# Track3 Snapshot Compare

Use the shared Track3 history CLI:

```bash
node .claude/skills/track3-history/bin/track3-history.mjs <command> [options]
```

Prefer these commands:

- `dates` to discover available snapshot UUIDs and timestamps
- `compare --left-uuid <uuid> --right-uuid <uuid>` for exact snapshot comparison
- `compare --left-date <iso> --right-date <iso>` when the user gives dates
- `export --query compare --format csv` when the user needs tabular output

Report total value delta first, then the largest asset-level movers, then new and removed positions.
