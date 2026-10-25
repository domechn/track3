# iOS release and signing

## Release gate

Run `corepack yarn tsc --noEmit`, `corepack yarn vitest run`,
`corepack yarn tsc -p tests/e2e/tsconfig.json --noEmit`,
`corepack yarn playwright test --project=desktop`, and
`corepack yarn playwright test --project=mobile`. Run
`cargo test --locked -p track3-pure-tests --lib` from `src-tauri`.
The existing `test-on-pr` workflow tests desktop release behavior. The
`ios-foundation.yml` web and macOS iOS jobs must pass on the release commit.
It runs on `feat/ios-app*` pushes, relevant iOS path PRs, and manual dispatch.
Check that the simulator launch produced a rendered screenshot, the ready
marker, no crash report, and an unsigned device IPA. Previous CI runs in the
separate iOS repository do not verify this combined codebase. The unsigned
IPA needs Apple signing and provisioning before device installation.
The Xcode target currently supports iPhone only (`TARGETED_DEVICE_FAMILY=1`);
an iPad layout requires separate design and validation before enabling iPad.

Existing license-key entry unlocks paid Pro features on iOS while external
checkout is hidden. App Store Guideline 3.1.1 may still require in-app purchase
or an applicable entitlement or exception. Treat App Review acceptance as
unresolved: confirm a compliant purchase and license flow before submission.

## App Store privacy preparation

Before submitting a signed build, review the actual app and bundled SDK
network traffic, then complete the App Store Connect privacy labels.
Include Aptabase analytics: launch, refresh and license-action events send
a persistent client ID and session ID, platform and user agent, locale,
app and Tauri versions, and event details that can include failed or
partial source IDs. Review exchange, wallet, price, license, assistant
provider and optional S3 requests separately.

Prepare and include `PrivacyInfo.xcprivacy` in the iOS app bundle with
accurate collected-data, tracking and required-reason API declarations
for the release build and its bundled dependencies. Check the compiled
archive for the manifest and resolve Xcode's privacy report before
TestFlight submission. The manifest and App Store privacy labels remain
release tasks; the unsigned CI IPA does not establish their accuracy.

## Signed device checks before TestFlight

1. Install a signed build on an iPhone with a passcode. Check fresh launch,
   lock after backgrounding, Face ID or Touch ID fallback, and the privacy
   cover in the app switcher.
2. Add an exchange, wallet and IBKR Flex source; refresh and inspect the
   source status sheet, portfolio, history, profit, cost basis, and charts.
   Inspect chart points by touch and confirm pages scroll normally.
3. Create and acknowledge an alert. Check notification permission,
   foreground delivery and the app icon badge. iOS may defer delivery when
   Track3 is suspended.
4. Export, share and import a JSON file through Files. Check the filename,
   import confirmation and conflict choice. Check an automatic backup in
   Track3's Documents folder and a user-moved copy in iCloud Drive.
5. Set a known encryption key and save it separately, export configuration,
   rotate the key, then verify the app can reopen. Test recovery from an
   interrupted rotation. Restore to a second device with the known key;
   the original device-only Keychain item does not transfer.
6. Use the assistant chat with a configured provider and confirm that a
   proposed write requires approval. Check the composer above the keyboard
   and Back navigation through Settings and other tabs.

Record device, iOS version, signed build identifier, and results in the
release record. Background refresh, backup and sync execute while the app is
active; WKWebView may be suspended after backgrounding.

To distribute through TestFlight, open the committed project in
`src-tauri/gen/apple` on a Mac, select the Track3 iOS target, set the Apple
development team and the `dev.track3.ios` App ID, and enable the Data
Protection entitlement in its provisioning profile. Archive a release build
for a physical device, sign it with an Apple Distribution certificate, and
upload the archive through Xcode Organizer or App Store Connect. Verify the
signing profile contains the default Data Protection entitlement and test
database open, key rotation, import/export, and notifications on a device.
Before testing device restore, set and retain a known encryption key in
Security and export the configuration. The automatically generated iOS
Keychain item is device-only and cannot be recovered after a restore.

CI runs `corepack yarn tauri ios init --ci` only when the committed project
is absent. After configuration and icon generation, CI checks for drift from
the committed project. Run `python3 scripts/ios/configure-project.py` when
bumping the app version and commit the resulting Xcode project changes.

If artifact upload is unavailable, recover the screenshot printed in the run
log:

```bash
gh run view <run-id> --log > /tmp/track3-ios-run.log
rg -o 'Z TRACK3_SCREENSHOT_CHUNK:[A-Za-z0-9+/=]+' /tmp/track3-ios-run.log | cut -d: -f2 | tr -d '\n' | base64 -d > /tmp/track3-launch.png
```

If the ready gate fails, use `TRACK3_INITIAL_SCREENSHOT_CHUNK` in the same
pipeline to inspect the earlier screenshot.
