/** A non-negative number from the environment, or `fallback` when it's unset or invalid. */
export function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = Number(raw);
  return raw && Number.isFinite(value) && value >= 0 ? value : fallback;
}
