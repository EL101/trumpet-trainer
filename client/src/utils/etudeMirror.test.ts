import { describe, expect, it } from "vitest";
import { DIFFICULTIES, PITCH_CLASSES, RANGES } from "@/schema";
import { ETUDE_MEASURE_LIMITS, keyChoices, TIME_SIGNATURES } from "@/lib/generatorOptions";
import { RANGE_NOTES } from "@/utils/generateMusic";
import { barLength, notate, type NoteEvent } from "./notate";
// The server's etude rules keep a copy of the client's vocabulary, since the two
// packages share no code. That file has no imports, so it loads here as it is.
import * as server from "../../../server/src/etudes/music";

describe("the server's copy of the generator's vocabulary", () => {
  it("has the same pitch classes, ranges, difficulties and time signatures", () => {
    expect(server.PITCH_CLASSES).toEqual(PITCH_CLASSES);
    expect(server.RANGES).toEqual(RANGES);
    expect(server.DIFFICULTIES).toEqual(DIFFICULTIES);
    expect(server.TIME_SIGNATURES).toEqual(TIME_SIGNATURES);
  });

  it("has the same written range for each range", () => {
    expect(server.RANGE_NOTES).toEqual(RANGE_NOTES);
  });

  it("accepts every key the page offers", () => {
    for (const key of keyChoices(true)) expect(key).toMatch(server.KEY_PATTERN);
  });

  it("allows the same etude lengths as the page", () => {
    expect({ min: server.ETUDE_MEASURES.min, max: server.ETUDE_MEASURES.max }).toEqual(
      ETUDE_MEASURE_LIMITS,
    );
  });

  it("measures bars the same way", () => {
    for (const timeSig of TIME_SIGNATURES) {
      expect(server.barLength(timeSig)).toBe(barLength(timeSig));
    }
  });

  it("writes notes and rests of every value as notate() does", () => {
    const n = (pitch: string | null, quarters: number): NoteEvent => ({ pitch, quarters });
    // Bars of 4/4 using every value an etude can, as notes and as rests, dotted or not.
    const bars = [
      [n("C4", 4)],
      [n("D4", 3), n(null, 1)],
      [n(null, 2), n("E4", 1.5), n("F4", 0.5)],
      [n("G4", 0.75), n("A4", 0.25), n(null, 1.5), n("Bb4", 1.5)],
      [n(null, 3), n(null, 0.75), n("C5", 0.25)],
      [n(null, 0.5), n(null, 0.25), n("D5", 0.25), n("Eb5", 1), n("F#5", 2)],
      [n(null, 4)],
    ];
    expect(server.etudeNotes(bars)).toBe(notate(bars.flat(), "4/4"));
  });
});
