import { describe, expect, it } from "vitest";
import {
  AVATAR_MAX_BYTES,
  AvatarError,
  decodeAvatarDataUrl,
  sniffImageMime,
  toDataUrl,
} from "../src/avatar.js";
import { JPEG, PNG, WEBP, dataUrl } from "./helpers.js";

describe("sniffImageMime", () => {
  it.each([
    ["image/png", PNG],
    ["image/jpeg", JPEG],
    ["image/webp", WEBP],
  ])("recognises %s by its leading bytes", (mime, bytes) => {
    expect(sniffImageMime(bytes)).toBe(mime);
  });

  it("returns null for anything else", () => {
    expect(sniffImageMime(Buffer.from("GIF89a"))).toBeNull();
    expect(sniffImageMime(Buffer.from("<svg></svg>"))).toBeNull();
  });

  it("does not mistake a short RIFF header for WebP", () => {
    expect(sniffImageMime(Buffer.from("RIFF"))).toBeNull();
  });
});

describe("decodeAvatarDataUrl", () => {
  it("decodes a valid image", () => {
    const { mime, bytes } = decodeAvatarDataUrl(dataUrl(PNG));
    expect(mime).toBe("image/png");
    expect(bytes.equals(PNG)).toBe(true);
  });

  it("trusts the bytes over the declared media type", () => {
    expect(decodeAvatarDataUrl(dataUrl(JPEG, "image/png")).mime).toBe("image/jpeg");
  });

  it.each([
    ["not a data URL", "https://example.com/a.png"],
    ["not base64", "data:image/png,rawtext"],
    ["not an image type", `data:text/html;base64,${PNG.toString("base64")}`],
  ])("rejects %s", (_, input) => {
    expect(() => decodeAvatarDataUrl(input)).toThrow("Expected a base64 image data URL");
  });

  it("rejects a payload that decodes to nothing", () => {
    expect(() => decodeAvatarDataUrl("data:image/png;base64,=")).toThrow("Image is empty");
  });

  it("rejects an image whose bytes aren't PNG, JPEG or WebP", () => {
    const svg = dataUrl(Buffer.from("<svg onload=alert(1)></svg>"), "image/svg+xml");
    expect(() => decodeAvatarDataUrl(svg)).toThrow(AvatarError);
  });

  it("rejects images over the size limit", () => {
    const big = Buffer.concat([PNG, Buffer.alloc(AVATAR_MAX_BYTES)]);
    expect(() => decodeAvatarDataUrl(dataUrl(big))).toThrow(/larger than/);
  });

  it("accepts an image exactly at the size limit", () => {
    const exact = Buffer.concat([PNG, Buffer.alloc(AVATAR_MAX_BYTES - PNG.length)]);
    expect(decodeAvatarDataUrl(dataUrl(exact)).bytes.length).toBe(AVATAR_MAX_BYTES);
  });
});

describe("toDataUrl", () => {
  it("round-trips through decodeAvatarDataUrl", () => {
    const url = toDataUrl("image/webp", new Uint8Array(WEBP));
    expect(decodeAvatarDataUrl(url).bytes.equals(WEBP)).toBe(true);
  });
});
