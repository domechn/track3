import { appCacheDir } from "@tauri-apps/api/path";
import { mkdir, remove } from "@tauri-apps/plugin-fs";
import { shareIOSFile } from "./ios-native";

export async function shareExport(write: (path: string) => Promise<void>, filename = "track3-export-data.json"): Promise<void> {
  const folder = `${(await appCacheDir()).replace(/\/+$/, "")}/${crypto.randomUUID()}`;
  if (!/^[A-Za-z0-9._-]+$/.test(filename)) throw new Error("Invalid export filename");
  const path = `${folder}/${filename}`;
  try {
    await mkdir(folder);
    await write(path);
    await shareIOSFile(path);
  } finally {
    await remove(folder, { recursive: true }).catch(() => {});
  }
}
