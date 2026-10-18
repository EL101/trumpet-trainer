import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ETUDE_MODEL } from "./claude.js";
import {
  allowedDurations,
  difficultyProblems,
  findProblems,
  pitchesInRange,
  type EtudeOptions,
  type NoteEvent,
} from "./music.js";
import { fixMessage, SYSTEM_PROMPT, userMessage } from "./prompt.js";

/** Tokens spent on one etude, across every attempt. */
export type TokenUsage = { inputTokens: number; outputTokens: number };

/**
 * Why an etude couldn't be written. `unavailable` is on Anthropic's side and
 * worth trying again later; `bad_output` means Claude answered but the etude
 * wasn't usable. Either way, `usage` is what was already spent.
 */
export class EtudeFailure extends Error {
  constructor(
    readonly kind: "unavailable" | "bad_output" | "unexpected",
    message: string,
    readonly usage: TokenUsage,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

/**
 * The reply's shape, as sent to the API. Pitches and note values are enums
 * built from the request, so the API itself won't let Claude pick a note
 * outside the range or a value the difficulty doesn't allow. Bar totals can't
 * be expressed in a schema and are checked afterwards.
 *
 * Written by hand rather than with the SDK's zodOutputFormat, which turns
 * `enum` into a description the model is free to ignore.
 */
export function outputSchema(options: EtudeOptions) {
  const note = {
    type: "object",
    properties: {
      pitch: {
        anyOf: [{ type: "string", enum: pitchesInRange(options.noteRange) }, { type: "null" }],
      },
      quarters: { type: "number", enum: allowedDurations(options.difficulty, options.timeSig) },
    },
    required: ["pitch", "quarters"],
    additionalProperties: false,
  };
  return {
    type: "object",
    properties: { bars: { type: "array", items: { type: "array", items: note } } },
    required: ["bars"],
    additionalProperties: false,
  };
}

/** The same shape, for checking the reply on our side. */
const ReplySchema = z.object({
  bars: z.array(z.array(z.object({ pitch: z.string().nullable(), quarters: z.number() }))),
});

/** First attempt, plus one more that's told what was wrong with the first. */
const MAX_ATTEMPTS = 2;

/** Harder etudes get more thought: meeting their targets while staying musical takes it. */
const EFFORT = { LOW: "low", MED: "low", HIGH: "medium" } as const;

/**
 * Ask Claude for an etude and check it. Returns bars that pass every check in
 * `findProblems`, or throws an EtudeFailure saying what went wrong and what it
 * cost. Falling short of the difficulty's targets (`difficultyProblems`) also
 * earns a retry, but an etude still short of them after it is kept: a playable
 * etude a little easier than asked beats none. `focus` passes straight through
 * to the prompt.
 */
export async function writeEtude(
  client: Anthropic,
  options: EtudeOptions,
  focus: readonly string[] = [],
): Promise<{ bars: NoteEvent[][]; usage: TokenUsage }> {
  const schema = outputSchema(options);
  const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage(options, focus) },
  ];
  let problems: string[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response: Anthropic.Message;
    try {
      // create, not parse: parse throws on a reply that fails the schema, and
      // that would lose the usage of a call that's already been paid for.
      response = await client.messages.create({
        model: ETUDE_MODEL,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages,
        output_config: {
          effort: EFFORT[options.difficulty],
          format: { type: "json_schema", schema },
        },
      });
    } catch (err) {
      throw apiFailure(err, usage);
    }

    const u = response.usage;
    usage.inputTokens +=
      u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
    usage.outputTokens += u.output_tokens;

    if (response.stop_reason === "refusal") {
      throw new EtudeFailure("bad_output", "Claude declined to write this etude", usage);
    }
    if (response.stop_reason === "max_tokens") {
      throw new EtudeFailure("bad_output", "The etude ran past max_tokens", usage);
    }

    const bars = parseBars(response);
    problems = bars ? findProblems(bars, options) : ["The reply wasn't in the required format."];
    const tooEasy = bars ? difficultyProblems(bars, options) : [];
    if (problems.length === 0 && (tooEasy.length === 0 || attempt === MAX_ATTEMPTS)) {
      return { bars: bars!, usage };
    }

    messages.push(
      { role: "assistant", content: response.content },
      { role: "user", content: fixMessage([...problems, ...tooEasy]) },
    );
  }

  throw new EtudeFailure(
    "bad_output",
    `The etude failed its checks ${MAX_ATTEMPTS} times: ${problems.join(" ")}`,
    usage,
  );
}

/** The reply's bars, or null if it isn't JSON of the right shape. `findProblems` checks the music. */
function parseBars(response: Anthropic.Message): NoteEvent[][] | null {
  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) return null;
  try {
    const parsed = ReplySchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data.bars : null;
  } catch {
    return null;
  }
}

function apiFailure(err: unknown, usage: TokenUsage): EtudeFailure {
  // Overloaded, rate limited, down, unreachable, or our key is refused: nothing
  // the user did, and a later try may work once it's sorted out.
  if (
    err instanceof Anthropic.RateLimitError ||
    err instanceof Anthropic.InternalServerError ||
    err instanceof Anthropic.APIConnectionError ||
    err instanceof Anthropic.AuthenticationError ||
    err instanceof Anthropic.PermissionDeniedError
  ) {
    return new EtudeFailure("unavailable", `Anthropic API unavailable: ${String(err)}`, usage, {
      cause: err,
    });
  }
  // A 400 or anything else means the request itself is wrong: a bug on our side.
  return new EtudeFailure("unexpected", `Anthropic API call failed: ${String(err)}`, usage, {
    cause: err,
  });
}
