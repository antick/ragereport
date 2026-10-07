import type { WordCount } from "../types.js";

export function addWord(list: WordCount[], group: string, variant: string, count = 1): void {
  let entry = list.find((word) => word.group === group);
  if (!entry) {
    entry = { group, count: 0, variants: {} };
    list.push(entry);
  }
  entry.count += count;
  Object.defineProperty(entry.variants, variant, {
    value: (Object.hasOwn(entry.variants, variant) ? entry.variants[variant]! : 0) + count,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

export function mergeWords(target: WordCount[], words: WordCount[]): void {
  for (const word of words)
    for (const [variant, count] of Object.entries(word.variants))
      addWord(target, word.group, variant, count);
  target.sort((a, b) => b.count - a.count || a.group.localeCompare(b.group));
}
