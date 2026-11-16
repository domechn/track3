# State machines

Track3 has state machines that are spread over statics, files, flags and component state. Each file in this directory describes one of them so that a change to a transition is a change to a table, not a hunt through the code.

Conventions for every file:

- One mermaid `stateDiagram-v2` and one transition table (event, from, to) per machine.
- The file and line of every mutation site. Line numbers are correct when the file is written; the function names next to them are what to search for later.
- The name of the test that pins the table, or a plain statement that nothing pins it.
- Known open defects, with what is needed to fix them.

Update the matching file in the same change that adds, removes or renames a state or transition.

Machines (one line per file, append only):

- [App startup (desktop and iOS)](startup.md)
- [Encryption key rotation journal and encrypt write gate](key-rotation.md)
- [iOS privacy lock](ios-privacy-lock.md)
- [iOS backup-folder access and folder picker](ios-backup-folder.md)
- [Live total](live-total.md)
- [Refresh flow](refresh-flow.md)
- [Automatic retry scheduler](refresh-retry-scheduler.md)
- [Source status](source-status.md)
- [IBKR Flex](ibkr-flex.md)
