// Synthetic files for the evidence upload scenarios (EVD-*). Usage: node evidence-fixtures.mjs <dir>
// Writes: ok.jpg (JPEG with GPS EXIF and a camera name), ok.png, ok.webp, fake.png (SVG with script under a PNG name),
// page.html, bigdims.png (header claims 100000x100000), oversize.jpg (6 MB), eicar.txt (the standard AV test string),
// tiny.txt (junk used to spend rate-limit budget), names: a file name with path separators and control characters.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const dir = resolve(process.argv[2] ?? ".");
mkdirSync(dir, { recursive: true });
const require = createRequire(resolve(import.meta.dirname, "../../../packages/app/package.json"));
const sharp = require("sharp");

const canvas = { create: { width: 64, height: 48, channels: 3, background: { r: 30, g: 120, b: 200 } } };
const gps = { GPSLatitudeRef: "N", GPSLatitude: "52/1 13/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "21/1 0/1 0/1" };
writeFileSync(join(dir, "ok.jpg"), await sharp(canvas).withExif({ IFD0: { Make: "QaCam", Copyright: "Jan Kowalski" }, IFD3: gps }).jpeg().toBuffer());
writeFileSync(join(dir, "ok.png"), await sharp(canvas).png().toBuffer());
writeFileSync(join(dir, "ok.webp"), await sharp(canvas).webp().toBuffer());
writeFileSync(join(dir, "fake.png"), "<svg xmlns='http://www.w3.org/2000/svg'><script>alert(document.cookie)</script></svg>");
writeFileSync(join(dir, "page.html"), "<html><script>alert(1)</script></html>");
writeFileSync(join(dir, "tiny.txt"), "not an image");
writeFileSync(join(dir, "eicar.txt"), "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*");
writeFileSync(join(dir, "oversize.jpg"), Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(6 * 1024 * 1024, 7)]));

const crc = (buf) => {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
};
const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc(body));
  return Buffer.concat([length, body, sum]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(100000, 0);
ihdr.writeUInt32BE(100000, 4);
ihdr[8] = 8;
ihdr[9] = 2;
writeFileSync(join(dir, "bigdims.png"), Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IEND", Buffer.alloc(0))]));
console.log("fixtures written to " + dir);
