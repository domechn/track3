---
name: track3-history-portfolio
description: Use when the user asks for a Track3 portfolio history overview, value timeline, latest allocation, snapshot dates, or top assets from local historical data.
---

# Track3 Portfolio History

Use the shared Track3 history CLI:

```bash
node .claude/skills/track3-history/bin/track3-history.mjs <command> [options]
```

Prefer these commands:

- `doctor` when the database location or schema is uncertain
- `dates` to find available historical coverage
- `timeline` for total portfolio value over time
- `latest` for current allocation
- `top` for highest-value assets

Keep responses concise: date range first, current/latest total, major changes, then caveats or truncation warnings.
