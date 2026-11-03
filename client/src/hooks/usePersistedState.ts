// src/hooks/usePersistedState.ts
import { useState, useEffect } from "react";
import { readStored } from "@/lib/storage";

type PersistOptions<T> = {
  /** Keep it for this tab only (sessionStorage): it survives a reload, not a new tab. */
  session?: boolean;
  /** Checks a stored value; one it turns down is replaced by `defaultValue`. */
  accept?: (value: unknown) => value is T;
};

/**
 * State kept in localStorage under `key`, so it survives reloads. Where storage is
 * blocked or full (some private windows, disabled site data), it starts from
 * `defaultValue` and simply isn't kept. A new `key` (another user's, say) starts over
 * from what's stored under it.
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T,
  { session = false, accept }: PersistOptions<T> = {},
) {
  const read = () => {
    try {
      return readStored(session ? sessionStorage : localStorage, key, defaultValue, accept);
    } catch {
      return defaultValue;
    }
  };
  const [value, setValue] = useState<T>(read);
  // Read again when the key changes, before the old key's value can be saved under it.
  const [readKey, setReadKey] = useState(key);
  if (readKey !== key) {
    setReadKey(key);
    setValue(read());
  }

  useEffect(() => {
    try {
      (session ? sessionStorage : localStorage).setItem(key, JSON.stringify(value));
    } catch {
      // Storage is unavailable: the value lasts until the page closes.
    }
  }, [key, value, session]);

  return [value, setValue] as const;
}
