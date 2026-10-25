import { appCacheDir } from "@tauri-apps/api/path";
import { mkdir, remove } from "@tauri-apps/plugin-fs";
import { shareIOSFile } from "./ios-native";

export async function shareExport(write: (path: string) => Promise<void>): Promise<void> {
  const folder = `${(await appCacheDir()).replace(/\/+$/, "")}/${crypto.randomUUID()}`;
  const path = `${folder}/track3-export-data.json`;
  try {
    await mkdir(folder);
    await write(path);
    await shareIOSFile(path);
  } finally {
    await remove(folder, { recursive: true }).catch(() => {});
  }
}
