import { describe, expect, it } from "vitest";
import { barLength, notate, spellLength } from "./notate";
import { splitNotes } from "./splitNotes";

describe("barLength", () => {
  it("measures a bar in quarter notes", () => {
    expect(barLength("4/4")).toBe(4);
    expect(barLength("2/2")).toBe(4);
    expect(barLength("3/4")).toBe(3);
    expect(barLength("6/8")).toBe(3);
    expect(barLength("9/8")).toBe(4.5);
    expect(barLength("3/8")).toBe(1.5);
  });
});

describe("spellLength", () => {
  it("uses one value when one fits exactly", () => {
    expect(spellLength(4)).toEqual(["w"]);
    expect(spellLength(1.5)).toEqual(["q."]);
  });

  it("splits any other length into values, longest first", () => {
    expect(spellLength(2.5)).toEqual(["h", "8"]);
    expect(spellLength(3.5)).toEqual(["h.", "8"]);
    expect(spellLength(0.625)).toEqual(["8", "32"]);
  });
});

describe("notate", () => {
  it("writes notes that fit their bars as they are", () => {
    const events = [
      { pitch: "C4", quarters: 2 },
      { pitch: "D4", quarters: 1 },
      { pitch: null, quarters: 1 },
    ];
    expect(notate(events, "4/4")).toBe("C4/h, D4/q, B4/q/r");
  });

  it("ties a note across a bar line", () => {
    const events = [
      { pitch: "C4", quarters: 3 },
      { pitch: "D4", quarters: 2 },
      { pitch: "E4", quarters: 3 },
    ];
    expect(notate(events, "4/4")).toBe("C4/h., D4/q~, D4/q, E4/h.");
  });

  it("ties a note no single value can show", () => {
    expect(notate([{ pitch: "C4", quarters: 2.5 }], "4/4")).toBe("C4/h~, C4/8, B4/q/r.");
  });

  it("holds a note over several bars", () => {
    expect(notate([{ pitch: "G4", quarters: 10 }], "4/4")).toBe("G4/w~, G4/w~, G4/h, B4/h/r");
  });

  it("splits a rest at the bar line without tying it", () => {
    const events = [
      { pitch: "C4", quarters: 3 },
      { pitch: null, quarters: 2 },
      { pitch: "D4", quarters: 3 },
    ];
    expect(notate(events, "4/4")).toBe("C4/h., B4/q/r, B4/q/r, D4/h.");
  });

  it("follows the bar length of compound meters", () => {
    expect(notate([{ pitch: "C5", quarters: 4 }], "6/8")).toBe("C5/h.~, C5/q, B4/h/r");
  });

  it("fills out the last bar with rests, even where splitNotes' padding can't", () => {
    const notes = notate([{ pitch: "C4", quarters: 0.625 }], "2/2");
    expect(notes).toBe("C4/8~, C4/32, B4/h/r., B4/16/r.");
    expect(splitNotes(notes, "2/2")).toHaveLength(1);
  });
});
