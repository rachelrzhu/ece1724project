import "server-only";

import sharp from "sharp";

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 16_000_000;

export class ImageValidationError extends Error {
  constructor(message = "Upload a valid, non-animated JPEG, PNG, or WebP image.") {
    super(message);
    this.name = "ImageValidationError";
  }
}

// The PNG decoder reads the default frame of an APNG without reporting its frame count.
function hasPngAnimation(bytes: Buffer) {
  for (let offset = 8; offset + 12 <= bytes.length; offset += 12 + bytes.readUInt32BE(offset)) {
    const chunk = bytes.toString("ascii", offset + 4, offset + 8);
    if (chunk === "acTL") return true;
    if (chunk === "IDAT") break;
  }
  return false;
}

export async function inspectRecipeImage(input: Uint8Array) {
  if (input.byteLength === 0 || input.byteLength > MAX_IMAGE_BYTES) {
    throw new ImageValidationError("Images must be nonempty and at most 3 MiB.");
  }
  const bytes = Buffer.from(input);
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  // Reject other formats before invoking a decoder, including SVG and remote references.
  if (!png && !jpeg && !webp) throw new ImageValidationError();
  if (png && hasPngAnimation(bytes)) throw new ImageValidationError();

  try {
    const image = sharp(bytes, { failOn: "warning", limitInputPixels: MAX_IMAGE_PIXELS }).timeout({ seconds: 5 });
    const metadata = await image.metadata();
    const formats = {
      png: { contentType: "image/png", extension: "png" },
      jpeg: { contentType: "image/jpeg", extension: "jpg" },
      webp: { contentType: "image/webp", extension: "webp" },
    } as const;
    if (!metadata.format || !(metadata.format in formats) || !metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) {
      throw new ImageValidationError();
    }
    // Decode pixels as well as headers so truncated or corrupt image bodies are rejected.
    await image.stats();
    return {
      bytes,
      size: bytes.byteLength,
      width: metadata.width,
      height: metadata.height,
      ...formats[metadata.format as keyof typeof formats],
    };
  } catch {
    throw new ImageValidationError();
  }
}
