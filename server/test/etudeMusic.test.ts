import { describe, expect, it } from "vitest";
import { costMicros } from "../src/etudes/claude.js";
import { outputSchema } from "../src/etudes/generate.js";
import {
  allowedDurations,
  difficultyProblems,
  etudeNotes,
  findProblems,
  measureEtude,
  pitchesInRange,
  type EtudeOptions,
  type NoteEvent,
} from "../src/etudes/music.js";
import { userMessage } from "../src/etudes/prompt.js";

const options: EtudeOptions = {
  musicKey: "Bb major",
  timeSig: "4/4",
  measures: 2,
  noteRange: "MED",
  difficulty: "MED",
};

const n = (pitch: string | null, quarters: number): NoteEvent => ({ pitch, quarters });

describe("pitchesInRange", () => {
  it("runs from the range's lowest note to its highest, both spellings of each black key", () => {
    const pitches = pitchesInRange("MED");
    expect(pitches[0]).toBe("C4");
    expect(pitches.at(-1)).toBe("C6");
    expect(pitches).toContain("A#4");
    expect(pitches).toContain("Bb4");
    expect(pitches).not.toContain("B3");
    expect(pitches).not.toContain("C#6");
  });
});

describe("allowedDurations", () => {
  it("adds shorter values as the difficulty rises", () => {
    expect(allowedDurations("LOW", "4/4")).toEqual([4, 3, 2, 1]);
    expect(allowedDurations("HIGH", "4/4")).toContain(0.25);
  });

  it("gives compound meters dotted quarters and eighths even at the easiest", () => {
    expect(allowedDurations("LOW", "6/8")).toEqual([3, 1.5, 1, 0.5]);
  });

  it("leaves out values longer than a bar", () => {
    expect(allowedDurations("LOW", "3/4")).toEqual([3, 2, 1]);
    expect(allowedDurations("MED", "2/4")).toEqual([2, 1.5, 1, 0.5]);
  });
});

describe("findProblems", () => {
  it("passes an etude that fits", () => {
    const bars = [[n("D4", 2), n("F4", 1), n(null, 1)], [n("Bb4", 4)]];
    expect(findProblems(bars, options)).toEqual([]);
  });

  it("names a bar that doesn't add up", () => {
    const bars = [[n("D4", 2), n("F4", 1)], [n("Bb4", 4)]];
    expect(findProblems(bars, options)).toEqual([
      "Bar 1 adds up to 3 quarter notes, but a bar of 4/4 is 4.",
    ]);
  });

  it("counts the bars", () => {
    expect(findProblems([[n("Bb4", 4)]], options)).toEqual([
      "It has 1 bars, but 2 were asked for.",
    ]);
  });

  it("catches notes out of range and values the difficulty doesn't allow", () => {
    const bars = [[n("G6", 2), n("F4", 0.25), n("F4", 1.75)], [n("Bb4", 4)]];
    const problems = findProblems(bars, options);
    expect(problems).toContain("Bar 1 has G6, outside the range C4 to C6.");
    expect(problems).toContain("Bar 1 uses a note of 0.25 quarter notes, which isn't allowed.");
  });

  it("wants it to end on the tonic, whatever the spelling or octave, rests after it aside", () => {
    expect(findProblems([[n("Bb4", 4)], [n("A#5", 2), n(null, 2)]], options)).toEqual([]);
    expect(findProblems([[n("Bb4", 4)], [n("F4", 4)]], options)).toEqual([
      "It ends on F4, but it should end on the tonic, Bb.",
    ]);
  });
});

describe("userMessage", () => {
  it("states the key, range, length and the values allowed", () => {
    const text = userMessage({ ...options, measures: 8, character: "lyrical" });
    expect(text).toContain("Key: Bb major");
    expect(text).toContain("Range: C4 to C6");
    expect(text).toContain("Length: 8 bars");
    expect(text).toContain("Allowed durations: 4, 3, 2, 1.5, 1, 0.5.");
    expect(text).toContain("Character: lyrical.");
    expect(text).not.toContain("Work on these");
  });

  it("lists things to work on when there are any", () => {
    const text = userMessage(options, ["Return to G5 often."]);
    expect(text).toContain(
      "Work on these, from the player's recent practice:\n- Return to G5 often.",
    );
  });
});

describe("outputSchema", () => {
  it("limits pitches and note values to the request's", () => {
    const schema = outputSchema({ ...options, noteRange: "LOW", difficulty: "LOW" });
    const note = schema.properties.bars.items.items.properties;
    expect(note.pitch.anyOf[0].enum).toEqual(pitchesInRange("LOW"));
    expect(note.quarters.enum).toEqual([4, 3, 2, 1]);
  });
});

describe("costMicros", () => {
  it("prices tokens per model, in millionths of a dollar", () => {
    // Haiku 5.5: $0.10 in and $0.50 out per million tokens.
    expect(costMicros("claude-haiku-5-5", 2_000, 3_000)).toBe(1_700);
    expect(costMicros("claude-sonnet-5-5", 2_000, 3_000)).toBe(34_000);
  });

  it("prices an unknown model like the dearest", () => {
    expect(costMicros("claude-new-model", 1_000, 1_000)).toBe(60_000);
  });
});

describe("measureEtude", () => {
  it("counts short notes, leaps, span and notes outside the key", () => {
    const bars = [
      [n("F4", 0.5), n("Bb4", 0.5), n("D5", 1), n("E5", 2)],
      [n("Bb4", 0.25), n("C5", 0.25), n("D5", 0.5), n(null, 1), n("F4", 2)],
    ];
    expect(measureEtude(bars, "Bb major")).toEqual({
      notes: 8,
      shortShare: 5 / 8,
      sixteenths: 2,
      leaps: 3, // F4 up to Bb4, E5 down to Bb4, D5 down to F4 across the rest
      wideLeaps: 1,
      largestLeap: 9,
      span: 11,
      chromatic: 1, // E natural
    });
  });

  it("counts the raised 6th and 7th of a minor key as in the key", () => {
    const bars = [[n("E5", 1), n("F#5", 1), n("G5", 2)]];
    expect(measureEtude(bars, "G minor").chromatic).toBe(0);
  });
});

describe("difficultyProblems", () => {
  const plain = [
    [n("Bb4", 2), n("C5", 2)],
    [n("D5", 2), n("Bb4", 2)],
  ];

  it("says how an etude falls short of advanced", () => {
    const problems = difficultyProblems(plain, { ...options, difficulty: "HIGH" });
    expect(problems).toContain(
      "Only 0% of the notes are eighths or shorter; this difficulty needs at least 40%.",
    );
    expect(problems).toContain("It only spans 4 semitones; use at least an 11th of the range.");
    expect(problems).toContain("It has 0 notes outside the key; this difficulty needs at least 2.");
  });

  it("asks nothing of a beginner etude but keeping leaps small and using a 5th", () => {
    expect(difficultyProblems(plain, { ...options, difficulty: "LOW" })).toEqual([
      "It only spans 4 semitones; use at least a 5th of the range.",
    ]);
    const leapy = [[n("Bb4", 2), n("Bb5", 2)], [n("Bb4", 4)]];
    expect(difficultyProblems(leapy, { ...options, difficulty: "LOW" })).toContain(
      "Its widest leap is an octave; keep leaps to a 5th or less.",
    );
  });

  it("only asks for sixteenths where the meter and difficulty allow them", () => {
    const problems = difficultyProblems(plain, { ...options, difficulty: "MED" });
    expect(problems.some((p) => p.includes("sixteenths"))).toBe(false);
  });
});

describe("userMessage targets", () => {
  it("lists advanced difficulty's targets", () => {
    const text = userMessage({ ...options, difficulty: "HIGH" });
    expect(text).toContain("Difficulty: advanced. Make it genuinely demanding");
    expect(text).toContain("- At least 4 sixteenths or dotted eighths, mostly in runs.");
    expect(text).toContain("- At least 6 leaps of a 4th or more, 3 of them a 5th or wider.");
    expect(text).toContain("- At least 2 notes outside the key (accidentals).");
  });

  it("asks a beginner etude only to keep leaps small and cover a 5th", () => {
    const text = userMessage({ ...options, difficulty: "LOW" });
    expect(text).toContain(
      "Targets:\n- No leap wider than a 5th.\n- The lowest and highest notes are at least a 5th apart.",
    );
  });
});

describe("etudeNotes", () => {
  it("writes bars as the client's notate() does, dotted values and rests included", () => {
    const bars = [
      [n("D4", 1.5), n("Eb4", 0.5), n(null, 2)],
      [n("F4", 0.75), n("G4", 0.25), n(null, 1.5), n("Bb4", 1)],
      [n("Bb4", 4)],
    ];
    expect(etudeNotes(bars)).toBe("D4/q., Eb4/8, B4/h/r, F4/8., G4/16, B4/q/r., Bb4/q, Bb4/w");
  });
});
