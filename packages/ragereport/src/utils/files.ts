import { mkdir, mkdtemp, open, rename, rmdir, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { FILE_ACCESS } from "../config/constants.js";

async function replaceFile(source: string, destination: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await rename(source, destination);
      return;
    } catch (error) {
      // Windows can briefly deny replacement while another writer holds the file.
      if (
        process.platform !== "win32" ||
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "EPERM" ||
        attempt >= FILE_ACCESS.renameAttempts
      )
        throw error;
      await setTimeout(FILE_ACCESS.renameRetryMs * attempt);
    }
  }
}

export async function writePrivateFile(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: FILE_ACCESS.directoryMode });
  // A private, unpredictable directory and exclusive creation prevent planted temp links.
  const directory = await mkdtemp(join(dirname(path), FILE_ACCESS.temporaryPrefix));
  const temporary = join(directory, FILE_ACCESS.temporaryName);
  let created = false;
  try {
    const file = await open(temporary, "wx", FILE_ACCESS.fileMode);
    created = true;
    try {
      await file.writeFile(value, "utf8");
    } finally {
      await file.close();
    }
    await replaceFile(temporary, path);
  } finally {
    // Remove only our file, never a pre-existing path or an arbitrary directory tree.
    if (created)
      await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    await rmdir(directory);
  }
}
