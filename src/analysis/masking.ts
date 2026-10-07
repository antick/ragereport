export interface TextRange {
  start: number;
  end: number;
}
export function maskCode(text: string): string {
  return text.replace(/(?:```|~~~)[\s\S]*?(?:(?:```|~~~)|$)|`[^`\n]*`/gu, (match) =>
    match.replace(/[^\n]+/gu, (line) => " ".repeat(line.length)),
  );
}
export function insideRange(start: number, end: number, ranges: TextRange[]): boolean {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const range = ranges[middle]!;
    if (range.start > start) high = middle - 1;
    else if (range.end < start) low = middle + 1;
    else return end <= range.end;
  }
  return false;
}
export function hostRanges(text: string): TextRange[] {
  const ranges: TextRange[] = [];
  for (const match of text.matchAll(/\S+/gu)) {
    if (!match[0].includes(".")) continue;
    const prefix = /^[<([{'"`]+/u.exec(match[0])?.[0].length ?? 0;
    const token = match[0].slice(prefix).replace(/[>)}\]'"`,;:!?.]+$/u, "");
    const scheme =
      /^[a-z][a-z\d+.-]*:\/\//iu.exec(token)?.[0].length ?? (token.startsWith("//") ? 2 : 0);
    const authority = token.slice(scheme).split(/[/?#]/u)[0] ?? "";
    const start = authority.lastIndexOf("@") + 1;
    const host = authority.slice(start).replace(/:\d+$/u, "");
    const labels = host.split(".");
    const tld = labels.at(-1) ?? "";
    if (
      labels.length < 2 ||
      !/^(?:[a-z]{2,63}|xn--[a-z\d-]{2,59})$/iu.test(tld) ||
      !labels.every((label) => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/iu.test(label))
    )
      continue;
    const absolute = match.index + prefix + scheme + start;
    ranges.push({ start: absolute, end: absolute + host.length });
  }
  return ranges;
}
