import sharp from "sharp";
import type { EvidenceContentType, EvidenceLimits, ImageSanitizerPort, InspectOutcome, SanitizeOutcome } from "@easyrms/core";

const FORMATS: Record<string, EvidenceContentType> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Image work is cut off after this long; a timeout means the image is not worth the CPU, so the upload is refused. */
const WORK_TIMEOUT_MS = 10_000;

function withTimeout<T>(work: Promise<T>): Promise<T | "timeout"> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), WORK_TIMEOUT_MS);
  });
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}

/**
 * Image checks and re-encoding with sharp (libvips). `inspect` reads only the header and rejects an image above the
 * pixel limit before any full decode (T-20); `sanitize` decodes under `limitInputPixels`, applies the EXIF
 * orientation, then re-encodes in the same type without metadata, so GPS, device and author fields never reach a
 * stored file. Only the first frame of an animated image is kept. A decode error is a rejected file, not an outage;
 * only a timeout or an unexpected failure is `unavailable`.
 */
export class SharpImageSanitizer implements ImageSanitizerPort {
  async inspect(data: Uint8Array, limits: Pick<EvidenceLimits, "maxPixels">): Promise<InspectOutcome> {
    try {
      const metadata = await withTimeout(sharp(data, { limitInputPixels: limits.maxPixels, failOn: "error" }).metadata());
      if (metadata === "timeout") return { status: "unavailable" };
      const contentType = metadata.format ? FORMATS[metadata.format] : undefined;
      const { width, height } = metadata;
      if (!contentType || !width || !height || width * height > limits.maxPixels) return { status: "rejected" };
      return { status: "ok", info: { contentType, width, height } };
    } catch {
      return { status: "rejected" };
    }
  }

  async sanitize(data: Uint8Array, limits: Pick<EvidenceLimits, "maxPixels">): Promise<SanitizeOutcome> {
    try {
      const probe = await this.inspect(data, limits);
      if (probe.status !== "ok") return probe;
      const base = sharp(data, { limitInputPixels: limits.maxPixels, failOn: "error", pages: 1 }).rotate();
      // No `withMetadata` / `keepMetadata`: libvips drops EXIF, XMP, IPTC and the ICC profile of the input.
      const encoded =
        probe.info.contentType === "image/jpeg"
          ? base.jpeg({ quality: 85, mozjpeg: false })
          : probe.info.contentType === "image/png"
            ? base.png({ compressionLevel: 9 })
            : base.webp({ quality: 85 });
      const buffer = await withTimeout(encoded.toBuffer());
      if (buffer === "timeout") return { status: "unavailable" };
      return { status: "ok", contentType: probe.info.contentType, data: new Uint8Array(buffer) };
    } catch {
      return { status: "rejected" };
    }
  }
}
