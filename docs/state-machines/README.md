# State machines

One file per domain. Each machine in a file has a mermaid `stateDiagram-v2`, a short events table (event, from, to), the single place in the code that changes the state, and the `data-*` attributes a test can read instead of sleeping.

- [Sync](sync.md): scheduler, runtime mode, badge, recovery unlock, config conflict
