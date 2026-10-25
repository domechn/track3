import { invoke } from "@tauri-apps/api/core";
import { documentDir } from "@tauri-apps/api/path";
import { getAutoBackupDirectory, saveAutoBackupDirectory } from "./configuration";
import { isIOS } from "@/utils/platform";

export type IOSBackupFolderStatus = { path: string | null; failure: string | null };
export const backupFolderStatusEvent = "track3:backup-folder-status";
export const backupFolderPreparationEvent = "track3:backup-folder-preparation";
export const iosDocumentsBackupMarker = "track3:ios-documents";
let activePreparations = 0;

export function isIOSDocumentsBackupChoice(configured: string, documents: string): boolean {
  return configured === iosDocumentsBackupMarker || configured === documents
    || /\/Containers\/Data\/Application\/[0-9a-f-]{36}\/Documents$/i.test(configured);
}

export async function getAutoBackupPath(): Promise<string | undefined> {
  const configured = await getAutoBackupDirectory();
  if (!configured || !isIOS()) return configured;
  const { path, failure } = await invoke<IOSBackupFolderStatus>("ios_backup_folder_status");
  const documents = await documentDir();
  if (isIOSDocumentsBackupChoice(configured, documents)
    && (configured === iosDocumentsBackupMarker || configured === documents || path !== configured)) {
    if (path || failure?.includes("Choose the folder again")) await invoke("ios_clear_backup_folder", { kind: "auto" });
    if (configured !== iosDocumentsBackupMarker) await saveAutoBackupDirectory(iosDocumentsBackupMarker);
    return documents;
  }
  if (path && path !== configured) {
    await saveAutoBackupDirectory(path);
    return path;
  }
  return configured;
}

export async function prepareAutoBackupPath(path: string): Promise<void> {
  if (!isIOS()) return;
  activePreparations += 1;
  window.dispatchEvent(new CustomEvent(backupFolderPreparationEvent, { detail: true }));
  try {
    await invoke("ios_prepare_backup_folder", { path, kind: "auto" });
  } finally {
    activePreparations -= 1;
    window.dispatchEvent(new CustomEvent(backupFolderPreparationEvent, { detail: activePreparations > 0 }));
    window.dispatchEvent(new Event(backupFolderStatusEvent));
  }
}
