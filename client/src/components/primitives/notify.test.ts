import { afterEach, describe, expect, it } from "vitest";
import { notify, toaster } from "./notify";

describe("notify", () => {
  afterEach(() => toaster.remove());

  it("gives a notice without an id one of its own", () => {
    // A toast with no id throws while rendering, blanking the page.
    notify({ tone: "error", title: "Not saved" });
    const [shown] = toaster.getVisibleToasts();
    expect(shown.id).toEqual(expect.any(String));
    expect(shown.id).not.toBe("");
  });

  it("replaces a notice still up when given its id", () => {
    notify({ id: "hint", tone: "info", title: "First" });
    notify({ id: "hint", tone: "info", title: "Second" });
    const shown = toaster.getVisibleToasts();
    expect(shown).toHaveLength(1);
    expect(shown[0].title).toBe("Second");
  });
});
