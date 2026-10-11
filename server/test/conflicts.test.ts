import { describe, expect, it, vi } from "vitest";
import { Prisma } from "../src/generated/prisma/client.js";
import { retryOnConflict } from "../src/queries/conflicts.js";

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });

describe("retryOnConflict", () => {
  it("runs the write again after a unique violation", async () => {
    const write = vi.fn().mockRejectedValueOnce(uniqueViolation()).mockResolvedValueOnce("saved");

    expect(await retryOnConflict(write)).toBe("saved");
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("gives up after five attempts", async () => {
    const write = vi.fn().mockRejectedValue(uniqueViolation());

    await expect(retryOnConflict(write)).rejects.toThrow("Unique constraint failed");
    expect(write).toHaveBeenCalledTimes(5);
  });

  it("passes any other error straight through", async () => {
    const write = vi.fn().mockRejectedValue(new Error("connection lost"));

    await expect(retryOnConflict(write)).rejects.toThrow("connection lost");
    expect(write).toHaveBeenCalledTimes(1);
  });
});
