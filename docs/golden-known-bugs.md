# Golden test known bugs

## Import requires two clicks

The Settings data import flow shows “No data to import” after the first
Import click even when a file was selected. A second click imports that file.
`tests/e2e/format-golden.spec.ts` records the current 0.9.4 behavior. When
the import flow is fixed, update that test to expect success after one click.

## 0.9.4 transaction ID collision in the legacy import shortcut

`tests/e2e/import-preview.spec.ts` has a `known-bug:` test that reproduces this
with the committed 0.9.4 export. Seed a local transaction with `id = 1` in
`snapshot-old`, then use Settings → Import twice and let the legacy Ignore
import read the file. The file's `snapshot-000001` transaction also has
`id = 1`. The imported assets appear, but `INSERT OR IGNORE` drops that
transaction. Legacy Replace can overwrite the unrelated local transaction.

Phase P5 leaves the legacy shortcut unchanged; `format-golden.spec.ts` records
its 0.9.4 flow. The new per-snapshot review warns about local transaction ID
collisions and imports through the ID-remapping sync command.
