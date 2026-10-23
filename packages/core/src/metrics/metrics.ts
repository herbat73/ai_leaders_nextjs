export interface Interval {
  value: number;
  low: number;
  high: number;
}

const Z_95 = 1.96;

/** Share `numerator / denominator` with a Wilson 95% interval; `null` when the denominator is 0. */
export function share(numerator: number, denominator: number): Interval | null {
  if (denominator <= 0) return null;
  const p = numerator / denominator;
  const z2 = Z_95 * Z_95;
  const factor = 1 + z2 / denominator;
  const center = (p + z2 / (2 * denominator)) / factor;
  const margin = (Z_95 * Math.sqrt((p * (1 - p)) / denominator + z2 / (4 * denominator * denominator))) / factor;
  return { value: p, low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

/** Linear interpolation between the closest ranks; `p` in 0–1; `null` for an empty set. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(Math.max(p, 0), 1) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const low = sorted[lower] as number;
  const high = sorted[upper] as number;
  return low + (high - low) * (index - lower);
}

export function median(values: number[]): number | null {
  return percentile(values, 0.5);
}

/** Groups items by key, keeping first-seen key order. */
export function groupBy<T, K extends string>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const group = groups.get(k);
    if (group) group.push(item);
    else groups.set(k, [item]);
  }
  return groups;
}
