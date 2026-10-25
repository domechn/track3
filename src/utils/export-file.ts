import { appCacheDir, documentDir } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";
import { copyFile, exists, remove } from "@tauri-apps/plugin-fs";
import { isIOS } from "@/utils/platform";

export async function exportFile(
  filename: string,
  extensions: string[],
  write: (path: string) => Promise<void>,
  filterName = filename.replace(/\.[^.]+$/, ""),
): Promise<boolean> {
  const options = {
    defaultPath: filename,
    filters: [{ name: filterName, extensions }],
  };
  if (!isIOS()) {
    const path = await save(options);
    if (!path) return false;
    await write(path);
    return true;
  }

  // The iOS picker creates its own empty Documents file; keep sensitive data in cache.
  const stagingName = filename.replace(/(\.[^.]+)$/, `-${crypto.randomUUID()}$1`);
  const source = `${(await appCacheDir()).replace(/\/+$/, "")}/${stagingName}`;
  const pickerSource = `${(await documentDir()).replace(/\/+$/, "")}/${stagingName}`;
  let selected: string | null = null;
  let copied = false;
  try {
    await write(source);
    selected = await save({ ...options, defaultPath: stagingName });
    if (selected) {
      await copyFile(source, selected);
      copied = true;
    }
    return !!selected;
  } finally {
    if (await exists(source)) {
      await remove(source);
    }
    const selectedPath = selected?.startsWith("file:")
      ? decodeURIComponent(new URL(selected).pathname)
      : selected;
    const normalizeIOSPath = (path: string) => path.replace(/^\/private(?=\/)/, "");
    if ((!copied || !selectedPath || normalizeIOSPath(selectedPath) !== normalizeIOSPath(pickerSource)) &&
        await exists(pickerSource)) {
      await remove(pickerSource);
    }
  }
}
