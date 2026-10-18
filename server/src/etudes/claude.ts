import Anthropic from "@anthropic-ai/sdk";

/** The model that writes etudes. Haiku held up as well as Sonnet in testing, at a twentieth of the price. */
export const ETUDE_MODEL = process.env.ETUDE_MODEL || "claude-haiku-5-5";

/**
 * Dollars per million tokens, as [input, output]. That's also millionths of a
 * dollar per token, which is what cost_micros counts.
 */
const PRICES: Record<string, readonly [number, number]> = {
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-sonnet-5-5": [2, 10],
  "claude-opus-5-5": [4, 20],
};
// An unknown model is priced like the dearest one, so the spend cap errs on the safe side.
const UNKNOWN_MODEL_PRICE = [10, 50] as const;

export function costMicros(model: string, inputTokens: number, outputTokens: number): number {
  const [input, output] = PRICES[model] ?? UNKNOWN_MODEL_PRICE;
  return Math.ceil(inputTokens * input + outputTokens * output);
}

let client: Anthropic | null | undefined;

/**
 * The shared client, or null when no credentials are set up, so the route can
 * say so instead of failing on every request. Etudes are requested from a
 * waiting browser, so a slow call gives up after a minute and is retried once.
 */
export function anthropic(): Anthropic | null {
  if (client === undefined) {
    try {
      client = new Anthropic({ timeout: 60_000, maxRetries: 1 });
    } catch (err) {
      console.error("Etude generation is off: no Anthropic credentials:", err);
      client = null;
    }
  }
  return client;
}
