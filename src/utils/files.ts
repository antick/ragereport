import { mkdir, mkdtemp, open, rename, rmdir, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { FILE_ACCESS } from "../config/constants.js";

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
    await rename(temporary, path);
  } finally {
    // Remove only our file, never a pre-existing path or an arbitrary directory tree.
    if (created)
      await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    await rmdir(directory);
  }
}
