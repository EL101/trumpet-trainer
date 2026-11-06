import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { scoreLimitOf } from "./scores";

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
