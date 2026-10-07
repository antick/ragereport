import { isAbsolute, relative, sep } from "node:path";

export function isWithinDirectory(directory: string, path: string): boolean {
  const child = relative(directory, path);
  return !!child && child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}
