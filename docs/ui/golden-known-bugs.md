# Golden test known bugs

## Import requires two clicks

The Settings data import flow shows “No data to import” after the first Import click even when a file was selected. A second click imports that file. `tests/e2e/format-golden.spec.ts` records the current 0.9.4 behavior. When the import flow is fixed, update that test to expect success after one click.
