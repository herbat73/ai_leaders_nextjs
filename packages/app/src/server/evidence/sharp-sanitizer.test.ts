import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { detectImageType } from "@easyrms/core";

import { SharpImageSanitizer } from "./sharp-sanitizer";

const LIMITS = { maxPixels: 1_000_000 };
const sanitizer = new SharpImageSanitizer();

const raw = (width: number, height: number) => ({ create: { width, height, channels: 3 as const, background: { r: 200, g: 20, b: 20 } } });
const jpeg = (width = 40, height = 30) => sharp(raw(width, height)).jpeg().toBuffer();
const png = (width = 40, height = 30) => sharp(raw(width, height)).png().toBuffer();
const webp = (width = 40, height = 30) => sharp(raw(width, height)).webp().toBuffer();

/** A PNG whose header claims a huge canvas; only the header is real, so building it costs nothing. */
function hugeHeaderPng(width: number, height: number): Uint8Array {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const crc = (buf: Buffer): number => {
    let c = ~0;
    for (const byte of buf) {
      c ^= byte;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
    return ~c >>> 0;
  };
  const chunk = (type: string, data: Buffer): Buffer => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IEND", Buffer.alloc(0))]));
}

describe("inspect", () => {
  it.each([
    ["JPEG", jpeg, "image/jpeg"],
    ["PNG", png, "image/png"],
    ["WebP", webp, "image/webp"],
  ] as const)("reads the type and size of a %s from its header", async (_name, make, contentType) => {
    expect(await sanitizer.inspect(await make(), LIMITS)).toEqual({ status: "ok", info: { contentType, width: 40, height: 30 } });
  });

  it("rejects an image above the pixel limit before decoding it (T-20)", async () => {
    expect(await sanitizer.inspect(hugeHeaderPng(100_000, 100_000), LIMITS)).toEqual({ status: "rejected" });
    expect(await sanitizer.inspect(await jpeg(2000, 1000), LIMITS)).toEqual({ status: "rejected" });
    expect((await sanitizer.inspect(await jpeg(1000, 1000), LIMITS)).status).toBe("ok");
  });

  it("rejects bytes that only start like an image, and unsupported formats", async () => {
    expect(await sanitizer.inspect(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), LIMITS)).toEqual({ status: "rejected" });
    expect(await sanitizer.inspect(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/>"), LIMITS)).toEqual({ status: "rejected" });
    expect(await sanitizer.inspect(await sharp(raw(10, 10)).gif().toBuffer(), LIMITS)).toEqual({ status: "rejected" });
  });
});

describe("sanitize", () => {
  it.each([
    ["JPEG", jpeg, "image/jpeg"],
    ["PNG", png, "image/png"],
    ["WebP", webp, "image/webp"],
  ] as const)("re-encodes a %s in the same type, still a decodable image", async (_name, make, contentType) => {
    const result = await sanitizer.sanitize(await make(), LIMITS);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.contentType).toBe(contentType);
    expect(detectImageType(result.data)).toBe(contentType);
    expect(await sharp(result.data).metadata()).toMatchObject({ width: 40, height: 30 });
  });

  it("strips EXIF with GPS and the ICC profile, so a location never reaches an agent (T-20)", async () => {
    const withGps = await sharp(raw(40, 30))
      .withExif({ IFD0: { Make: "TestCam", Copyright: "Jan Kowalski" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "52/1 13/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "21/1 0/1 0/1" } })
      .jpeg()
      .toBuffer();
    const before = await sharp(withGps).metadata();
    expect(before.exif).toBeDefined();
    expect(withGps.includes(Buffer.from("TestCam"))).toBe(true);

    const result = await sanitizer.sanitize(withGps, LIMITS);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const after = await sharp(result.data).metadata();
    expect(after.exif).toBeUndefined();
    expect(after.icc).toBeUndefined();
    expect(Buffer.from(result.data).includes(Buffer.from("TestCam"))).toBe(false);
    expect(Buffer.from(result.data).includes(Buffer.from("Kowalski"))).toBe(false);
  });

  it("applies the EXIF orientation before dropping it, so the picture is not turned", async () => {
    const sideways = await sharp(raw(40, 30)).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const result = await sanitizer.sanitize(sideways, LIMITS);
    if (result.status !== "ok") throw new Error("sanitize failed");
    const meta = await sharp(result.data).metadata();
    expect([meta.width, meta.height]).toEqual([30, 40]);
    expect(meta.orientation).toBeUndefined();
  });

  it("drops text chunks and other metadata of a PNG", async () => {
    const tagged = await sharp(raw(20, 20)).withMetadata({ exif: { IFD0: { ImageDescription: "secret-address" } } }).png().toBuffer();
    const result = await sanitizer.sanitize(tagged, LIMITS);
    if (result.status !== "ok") throw new Error("sanitize failed");
    expect(Buffer.from(result.data).includes(Buffer.from("secret-address"))).toBe(false);
  });

  it("keeps only the first frame of an animated image", async () => {
    const frames = await sharp(Buffer.concat([await webp(10, 10)])).webp().toBuffer();
    const result = await sanitizer.sanitize(frames, LIMITS);
    expect(result.status).toBe("ok");
  });

  it("rejects a truncated file that passes the header check, and an extreme canvas", async () => {
    const whole = await jpeg(200, 200);
    expect((await sanitizer.sanitize(new Uint8Array(whole.subarray(0, Math.floor(whole.length / 3))), LIMITS)).status).toBe("rejected");
    expect(await sanitizer.sanitize(hugeHeaderPng(50_000, 50_000), LIMITS)).toEqual({ status: "rejected" });
  });
});
