import { invoke } from "@tauri-apps/api/core";
import { documentDir } from "@tauri-apps/api/path";
import { getAutoBackupDirectory, saveAutoBackupDirectory } from "./configuration";
import { isIOS } from "@/utils/platform";

export type IOSBackupFolderStatus = { path: string | null; failure: string | null };
export const backupFolderStatusEvent = "track3:backup-folder-status";

export async function getAutoBackupPath(): Promise<string | undefined> {
  const configured = await getAutoBackupDirectory();
  if (!configured || !isIOS()) return configured;
  const { path } = await invoke<IOSBackupFolderStatus>("ios_backup_folder_status");
  if (path && path !== configured) {
    if (configured === await documentDir()) {
      await invoke("ios_clear_backup_folder", { kind: "auto" });
      return configured;
    }
    await saveAutoBackupDirectory(path);
    return path;
  }
  return configured;
}

export async function prepareAutoBackupPath(path: string): Promise<void> {
  if (!isIOS()) return;
  try {
    await invoke("ios_prepare_backup_folder", { path, kind: "auto" });
  } finally {
    window.dispatchEvent(new Event(backupFolderStatusEvent));
  }
}
