interface MatchRange {
  index: number;
  end: number;
}

// Prefer the longest expression, then its earliest position. Coordinate-indexed
// prefix counts detect overlaps without comparing every pair of matches.
export function selectMatches<T extends MatchRange>(candidates: T[]): T[] {
  const positions = [...new Set(candidates.flatMap(({ index, end }) => [index, end]))].sort(
    (a, b) => a - b,
  );
  const ranks = new Map(positions.map((position, index) => [position, index + 1]));
  const starts = new Uint32Array(positions.length + 1);
  const ends = new Uint32Array(positions.length + 1);
  const total = (tree: Uint32Array, position: number) => {
    let count = 0;
    for (let index = position; index > 0; index -= index & -index) count += tree[index]!;
    return count;
  };
  const add = (tree: Uint32Array, position: number) => {
    for (let index = position; index < tree.length; index += index & -index) tree[index]!++;
  };
  const selected: T[] = [];
  for (const candidate of [...candidates].sort(
    (a, b) => b.end - b.index - (a.end - a.index) || a.index - b.index,
  )) {
    const start = ranks.get(candidate.index)!;
    const end = ranks.get(candidate.end)!;
    if (total(starts, end - 1) - total(ends, start) > 0) continue;
    selected.push(candidate);
    add(starts, start);
    add(ends, end);
  }
  return selected.sort((a, b) => a.index - b.index);
}
