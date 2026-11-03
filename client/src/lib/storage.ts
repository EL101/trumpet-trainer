/**
 * The value stored under `key` as JSON, or `fallback` when there's none, it isn't JSON,
 * or `accept` turns it down (a shape an older deploy wrote, say).
 */
export function readStored<T>(
  storage: Pick<Storage, "getItem">,
  key: string,
  fallback: T,
  accept?: (value: unknown) => value is T,
): T {
  try {
    const stored = storage.getItem(key);
    if (stored === null) return fallback;
    const value: unknown = JSON.parse(stored);
    return !accept || accept(value) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}
