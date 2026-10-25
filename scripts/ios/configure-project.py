#!/usr/bin/env python3
"""Keep the committed iOS project in sync with Tauri config and data protection."""

from pathlib import Path
import json
import plistlib
import re

apple = Path("src-tauri/gen/apple")
project = apple / "project.yml"
text = project.read_text()
version = json.loads(Path("src-tauri/tauri.conf.json").read_text())["version"]
for key in ("MARKETING_VERSION", "CURRENT_PROJECT_VERSION"):
    line = f"      {key}: {version}"
    if re.search(rf"(?m)^      {key}: .*", text):
        text = re.sub(rf"(?m)^      {key}: .*", line, text)
    else:
        text = text.replace("      PRODUCT_NAME: Track3\n", f"      PRODUCT_NAME: Track3\n{line}\n", 1)
text = re.sub(
    r"(?m)^        CFBundleShortVersionString: .*",
    "        CFBundleShortVersionString: $(MARKETING_VERSION)",
    text,
)
text = re.sub(
    r"(?m)^        CFBundleVersion: .*",
    "        CFBundleVersion: $(CURRENT_PROJECT_VERSION)",
    text,
)
entry = re.search(r"(?m)^    entitlements:\n      path: ([^\n]+)\n", text)
if entry is None:
    raise SystemExit("generated iOS entitlements path missing")

protection = "NSFileProtectionCompleteUntilFirstUserAuthentication"
protection_key = "com.apple.developer.default-data-protection"
if protection_key not in text:
    text = text[:entry.end()] + f"      properties:\n        {protection_key}: {protection}\n" + text[entry.end():]
project.write_text(text)

info = apple / "track3_iOS/Info.plist"
info_text = info.read_text()
for key, variable in (
    ("CFBundleShortVersionString", "MARKETING_VERSION"),
    ("CFBundleVersion", "CURRENT_PROJECT_VERSION"),
):
    info_text = re.sub(
        rf"(<key>{key}</key>\s*<string>)[^<]*(</string>)",
        rf"\g<1>$({variable})\g<2>",
        info_text,
        count=1,
    )
info.write_text(info_text.rstrip("\n") + "\n")

pbxproj = apple / "track3.xcodeproj/project.pbxproj"
if pbxproj.exists():
    pbx_text = pbxproj.read_text()
    for version_key in ("MARKETING_VERSION", "CURRENT_PROJECT_VERSION"):
        setting = f"{version_key} = {version};"
        if f"{version_key} = " in pbx_text:
            pbx_text = re.sub(
                rf"(?m)^(\s*){version_key} = [^;]+;",
                rf"\g<1>{setting}",
                pbx_text,
            )
        else:
            pbx_text = pbx_text.replace(
                "INFOPLIST_FILE = track3_iOS/Info.plist;",
                f"INFOPLIST_FILE = track3_iOS/Info.plist;\n\t\t\t\t{setting}",
            )
    pbx_text = re.sub(r'(?m)^(\s*)PRODUCT_NAME = "?Track3"?;', r'\g<1>PRODUCT_NAME = "Track3";', pbx_text)
    pbxproj.write_text(pbx_text)

entitlements = apple / entry.group(1)
if entitlements.exists():
    with entitlements.open("rb") as file:
        data = plistlib.load(file)
else:
    entitlements.parent.mkdir(parents=True, exist_ok=True)
    data = {}
data[protection_key] = protection
with entitlements.open("wb") as file:
    plistlib.dump(data, file)
