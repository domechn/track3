import { documentDir } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { isIOS } from "@/utils/platform";

export async function chooseBackupLocation(kind: "auto" | "import" = "auto"): Promise<string | null> {
  if (isIOS()) return invoke<string | null>("ios_pick_backup_folder", { kind });
  const selected = await open({ multiple: false, directory: true });
  return typeof selected === "string" ? selected : null;
}

export async function documentsBackupLocation(): Promise<string> {
  return documentDir();
}
