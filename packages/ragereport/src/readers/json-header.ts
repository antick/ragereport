// Stop at nested structures/partial strings: unusual key ordering uses the full parser.
export function headerField(
  text: string,
  name: string,
  start = 0,
): { value?: string; objectStart?: number } | undefined {
  let index = start;
  const space = () => {
    while (index < text.length && text.charCodeAt(index) <= 32) index++;
  };
  const quoted = () => {
    if (text[index++] !== '"') return undefined;
    const begin = index;
    while (index < text.length) {
      if (text[index] === "\\") {
        index += 2;
        continue;
      }
      if (text[index++] === '"') {
        const value = text.slice(begin, index - 1);
        if (!value.includes("\\")) return value;
        try {
          return JSON.parse(`"${value}"`) as string;
        } catch {
          return undefined;
        }
      }
    }
    return undefined;
  };
  space();
  if (text[index++] !== "{") return undefined;
  while (index < text.length) {
    space();
    const key = quoted();
    if (key === undefined) return undefined;
    space();
    if (text[index++] !== ":") return undefined;
    space();
    if (key === name && text[index] === "{") return { objectStart: index };
    if (text[index] === "{" || text[index] === "[") return undefined;
    let value: string | undefined;
    if (text[index] === '"') value = quoted();
    else {
      const begin = index;
      while (
        index < text.length &&
        text[index] !== "," &&
        text[index] !== "}" &&
        text.charCodeAt(index) > 32
      )
        index++;
      value = text.slice(begin, index);
    }
    if (value === undefined) return undefined;
    if (key === name) return { value };
    space();
    if (text[index++] !== ",") return undefined;
  }
  return undefined;
}
