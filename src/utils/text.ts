export function singleLineText(value: unknown): string {
  return (
    String(value)
      .replace(/[\r\n\t\u2028\u2029]+/gu, " ")
      // eslint-disable-next-line no-control-regex -- Remove untrusted display controls deliberately.
      .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu, "")
  );
}
