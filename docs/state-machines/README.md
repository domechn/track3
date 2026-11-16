# State machines

One file per domain. Each machine has a mermaid `stateDiagram-v2`, a short events table, the DOM marker that exposes its state, and the tests that pin it.

Conventions:

- The element that owns a phase carries `data-state="<state>"` (or a named variant such as `data-boot-state`), using the literal state names from the doc.
- Write the characterization test first; a defect test must fail before the fix.
- Desktop and phone copies of a machine change together.

Domains (one line each, append only):

- [Assistant, phone shell, comparison, goals](assistant.md)
