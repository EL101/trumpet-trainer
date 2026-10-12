// src/hooks/usePersistedState.ts
import { useState, useEffect } from "react";

/**
 * State kept in localStorage under `key`, so it survives reloads. Where storage is
 * blocked or full (some private windows, disabled site data), it starts from
 * `defaultValue` and simply isn't kept.
 */
export function usePersistedState<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? defaultValue : (JSON.parse(stored) as T);
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage is unavailable: the value lasts until the page closes.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
