import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { scoreLimitOf, unsavedNotice } from "./scores";

describe("scoreLimitOf", () => {
  it("reads the limit a save was turned down for", () => {
    const body = { error: "Too many scored runs", limit: { max: 10, per: "minute" } };
    expect(scoreLimitOf(new ApiError("POST failed", 429, body))).toEqual({
      max: 10,
      per: "minute",
    });
  });

  it("is null for any other failure, or a 429 without a limit it knows", () => {
    expect(scoreLimitOf(new ApiError("POST failed", 500, null))).toBeNull();
    expect(scoreLimitOf(new ApiError("POST failed", 429, null))).toBeNull();
    expect(
      scoreLimitOf(new ApiError("POST failed", 429, { limit: { max: 10, per: "hour" } })),
    ).toBeNull();
    expect(scoreLimitOf(new TypeError("Failed to fetch"))).toBeNull();
  });
});

describe("unsavedNotice", () => {
  it("says which limit a run was turned down for, on the notice and the card", () => {
    const minute = unsavedNotice(new ApiError("", 429, { limit: { max: 10, per: "minute" } }));
    expect(minute.title).toBe("Score not saved: too many runs");
    expect(minute.card).toMatch(/10 runs a minute/);
    const day = unsavedNotice(new ApiError("", 429, { limit: { max: 300, per: "day" } }));
    expect(day.card).toMatch(/300 runs a day/);
  });

  it("says it couldn't be saved for any other failure", () => {
    const failed = unsavedNotice(new TypeError("Failed to fetch"));
    expect(failed.title).toBe("Couldn't save your score");
    expect(failed.card).toMatch(/won't be under Last feedback/);
  });
});
