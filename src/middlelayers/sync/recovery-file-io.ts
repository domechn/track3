import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile, stat, writeTextFile } from "@tauri-apps/plugin-fs";
import { exportFile } from "@/utils/export-file";
import { shareExport } from "@/utils/share-export";
import { isIOS } from "@/utils/platform";

export async function writeRecoveryFile(encrypted: string, bucket: string): Promise<boolean> {
  const hint = bucket.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "bucket";
  const filename = `${["track3", "sync", hint].join("-")}.t3key`;
  if (isIOS()) {
    if (!await invoke<boolean>("ios_authenticate")) throw new Error("Authentication was not completed");
    await shareExport((path) => writeTextFile(path, encrypted), filename);
    return true;
  }
  return exportFile(filename, ["t3key"], (path) => writeTextFile(path, encrypted));
}

export async function pickRecoveryFile(): Promise<string | undefined> {
  const path = await open({ multiple: false, filters: [{ name: "Track3 sync recovery", extensions: ["t3key"] }] });
  if (!path || typeof path !== "string") return undefined;
  if ((await stat(path)).size > 4096) throw new Error("Invalid recovery file");
  return readTextFile(path);
}
