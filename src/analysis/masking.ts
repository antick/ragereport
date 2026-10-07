export interface TextRange {
  start: number;
  end: number;
}
export function maskCode(text: string): string {
  const blank = (value: string) => value.replace(/[^\n]+/gu, (line) => " ".repeat(line.length));
  const pieces: string[] = [];
  let start = 0;
  let fence: { index: number; marker: string } | undefined;
  for (const match of text.matchAll(/`{3,}|~{3,}/gu)) {
    if (!fence) fence = { index: match.index, marker: match[0] };
    else if (
      match[0][0] === fence.marker[0] &&
      match[0].length >= fence.marker.length &&
      /^[ \t]{0,3}$/u.test(text.slice(text.lastIndexOf("\n", match.index - 1) + 1, match.index))
    ) {
      const end = match.index + match[0].length;
      pieces.push(text.slice(start, fence.index), blank(text.slice(fence.index, end)));
      start = end;
      fence = undefined;
    }
  }
  pieces.push(
    fence ? text.slice(start, fence.index) + blank(text.slice(fence.index)) : text.slice(start),
  );
  return pieces.join("").replace(/(`+)(?!`)[^\n]*?\1(?!`)/gu, blank);
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
