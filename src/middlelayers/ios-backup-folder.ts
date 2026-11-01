import { invoke } from "@tauri-apps/api/core";
import { documentDir } from "@tauri-apps/api/path";
import { getAutoBackupDirectory, saveAutoBackupDirectory } from "./configuration";
import { isIOS } from "@/utils/platform";
import { chooseBackupLocation } from "@/utils/backup-location";

export type IOSBackupFolderStatus = { path: string | null; failure: string | null };
export const backupFolderStatusEvent = "track3:backup-folder-status";
export const backupFolderPreparationEvent = "track3:backup-folder-preparation";
export const iosDocumentsBackupMarker = "track3:ios-documents";
let activePreparations = 0;
let autoChoiceInFlight = false;
let autoChoiceVersion = 0;

export function isICloudDrivePath(path: string): boolean {
  return path.includes("/Mobile Documents/") || path.includes("/CloudDocs/");
}

export function isIOSDocumentsBackupChoice(configured: string, documents: string): boolean {
  return configured === iosDocumentsBackupMarker || configured === documents
    || /\/Containers\/Data\/Application\/[0-9a-f-]{36}\/Documents$/i.test(configured);
}

export async function loadAutoBackupFolder(): Promise<{ directory: string | undefined; failure: string | null; bookmarkUnavailable: boolean }> {
  const version = autoChoiceVersion;
  const configured = await getAutoBackupDirectory();
  if (!isIOS()) return { directory: configured, failure: null, bookmarkUnavailable: false };
  const status = await invoke<IOSBackupFolderStatus>("ios_backup_folder_status");
  const { path } = status;
  const documents = await documentDir();
  const bookmarkUnavailable = !!configured && !isIOSDocumentsBackupChoice(configured, documents)
    && !path && !!status.failure?.includes("Choose the folder again");
  if (autoChoiceInFlight || version !== autoChoiceVersion) {
    return { directory: configured === iosDocumentsBackupMarker ? documents : configured, failure: status.failure, bookmarkUnavailable };
  }
  if (!configured && path) {
    await invoke("ios_clear_backup_folder", { kind: "auto" });
    status.failure = null;
  }
  if (!configured) return { directory: undefined, failure: status.failure, bookmarkUnavailable };
  if (isIOSDocumentsBackupChoice(configured, documents)
    && (configured === iosDocumentsBackupMarker || configured === documents || path !== configured)) {
    if (path || status.failure?.includes("Choose the folder again")) {
      await invoke("ios_clear_backup_folder", { kind: "auto" });
      status.failure = null;
    }
    if (configured !== iosDocumentsBackupMarker) await saveAutoBackupDirectory(iosDocumentsBackupMarker);
    return { directory: documents, failure: status.failure, bookmarkUnavailable };
  }
  if (path && path !== configured) {
    await saveAutoBackupDirectory(path);
    return { directory: path, failure: status.failure, bookmarkUnavailable };
  }
  return { directory: configured, failure: status.failure, bookmarkUnavailable };
}

export async function getAutoBackupPath(): Promise<string | undefined> {
  return (await loadAutoBackupFolder()).directory;
}

export async function chooseAndSaveAutoBackupFolder(): Promise<string | null> {
  autoChoiceVersion += 1;
  autoChoiceInFlight = true;
  try {
    const path = await chooseBackupLocation();
    if (path) await saveAutoBackupDirectory(path);
    return path;
  } finally {
    autoChoiceInFlight = false;
    autoChoiceVersion += 1;
  }
}

export async function prepareAutoBackupPath(path: string): Promise<void> {
  if (!isIOS()) return;
  const fromCloud = isICloudDrivePath(path);
  if (fromCloud) {
    activePreparations += 1;
    window.dispatchEvent(new CustomEvent(backupFolderPreparationEvent, { detail: true }));
  }
  try {
    await invoke("ios_prepare_backup_folder", { path, kind: "auto" });
  } finally {
    if (fromCloud) {
      activePreparations -= 1;
      window.dispatchEvent(new CustomEvent(backupFolderPreparationEvent, { detail: activePreparations > 0 }));
    }
    window.dispatchEvent(new Event(backupFolderStatusEvent));
  }
}

export async function prepareRestoreBackupPath(path: string): Promise<void> {
  if (isIOS()) await invoke("ios_prepare_backup_folder", { path, kind: "auto" });
}
