import type { EvidenceContentType } from "./types";

const startsWith = (data: Uint8Array, bytes: readonly number[], offset = 0): boolean =>
  data.length >= offset + bytes.length && bytes.every((byte, index) => data[offset + index] === byte);

/**
 * The type of an image by its leading bytes (magic numbers), never by the client's declared type or file name (T-15).
 * `null` for anything that is not JPEG, PNG or WebP, including SVG, HTML, PDF and video.
 */
export function detectImageType(data: Uint8Array): EvidenceContentType | null {
  if (startsWith(data, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // RIFF....WEBP
  if (startsWith(data, [0x52, 0x49, 0x46, 0x46]) && startsWith(data, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

const MAX_LABEL_LENGTH = 120;
export const DEFAULT_LABEL = "zdjęcie";

/**
 * A display-only label from a client file name (T-19): the last path segment, no control characters, quotes or
 * separators, at most 120 characters. The label is never used in a path or header unencoded.
 */
export function sanitizeLabel(name: string | null | undefined): string {
  const lastSegment = (name ?? "").split(/[\\/]/).pop() ?? "";
  const cleaned = Array.from(lastSegment)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      const control = code <= 0x1f || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029;
      return !control && !`"<>:*?|`.includes(char);
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_LABEL_LENGTH)
    .trim();
  return cleaned === "" || /^\.+$/.test(cleaned) ? DEFAULT_LABEL : cleaned;
}
