import { documentDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { isIOS } from "@/utils/platform";

export async function chooseBackupLocation(): Promise<string | null> {
  if (isIOS()) return documentDir();
  const selected = await open({ multiple: false, directory: true });
  return typeof selected === "string" ? selected : null;
}
