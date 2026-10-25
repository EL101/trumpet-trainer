import { describe, expect, it } from "vitest";
import type { MusicInfo } from "@/schema";
import type { EtudeJob } from "@/utils/etudes";
import { etudeNotice } from "./etudeNotice";

const exercise: MusicInfo = {
  id: "row-1",
  exerciseId: "exercise-1",
  exerciseType: "ETUDES",
  notes: "Bb4/w",
  timeSig: "6/8",
  musicKey: "Bb major",
  noteRange: "MED",
  difficulty: "HIGH",
  generationNum: 3,
};

const job = (patch: Partial<EtudeJob>): EtudeJob => ({
  id: "etude-1",
  status: "SUCCEEDED",
  error: null,
  exercise,
  ...patch,
});

describe("etudeNotice", () => {
  it("says a written etude is ready, and what it's in", () => {
    expect(etudeNotice(job({}))).toEqual({
      tone: "success",
      title: "Your etude is ready",
      description: "B♭ major · 6/8 · High difficulty",
    });
  });

  it("passes on the server's reason when it failed", () => {
    expect(
      etudeNotice(
        job({ status: "FAILED", error: "Couldn't write a usable etude.", exercise: null }),
      ),
    ).toMatchObject({ tone: "error", description: "Couldn't write a usable etude." });
  });

  it("falls back to its own reason when the server gave none", () => {
    expect(etudeNotice(job({ status: "FAILED", exercise: null })).description).toMatch(/Try again/);
  });

  it("explains an etude that history was cleared of before it arrived", () => {
    expect(etudeNotice(job({ exercise: null }))).toMatchObject({
      tone: "info",
      title: "Your etude was cleared",
    });
  });
});
