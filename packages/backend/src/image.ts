import { inflateSync } from "node:zlib";
import { LIMITS } from "@alloo/shared/policy";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";

function validatePng(input: Buffer) {
  if (
    input.length < 33 ||
    input.readUInt32BE(8) !== 13 ||
    input.toString("ascii", 12, 16) !== "IHDR"
  )
    throw new Error("INVALID_IMAGE");
  const width = input.readUInt32BE(16),
    height = input.readUInt32BE(20);
  if (!width || !height || width * height > LIMITS.avatarPixels)
    throw new Error("INVALID_IMAGE_DIMENSIONS");
  // Browser avatar normalization emits non-interlaced PNGs. Reject Adam7 before inflate.
  if (input[28] !== 0) throw new Error("INVALID_IMAGE_FORMAT");
  const data: Buffer[] = [];
  let offset = 33;
  while (offset + 12 <= input.length) {
    const length = input.readUInt32BE(offset),
      end = offset + 12 + length;
    if (end > input.length) throw new Error("INVALID_IMAGE");
    const type = input.toString("ascii", offset + 4, offset + 8);
    if (type === "IHDR") throw new Error("INVALID_IMAGE");
    if (type === "IDAT") data.push(input.subarray(offset + 8, end - 4));
    if (type === "IEND") {
      if (length !== 0 || end !== input.length || !data.length) throw new Error("INVALID_IMAGE");
      // At most RGBA16 plus one filter byte per row. Enforce before the third-party decoder.
      inflateSync(Buffer.concat(data), { maxOutputLength: width * height * 8 + height });
      return;
    }
    offset = end;
  }
  throw new Error("INVALID_IMAGE");
}
/** Decode and re-encode pixels, dropping original metadata and trailing payloads. */
export function sanitizeImage(bytes: ArrayBuffer) {
  if (!bytes.byteLength || bytes.byteLength > LIMITS.avatarBytes)
    throw new Error("INVALID_IMAGE_SIZE");
  const input = Buffer.from(bytes);
  let image: { width: number; height: number; data: Uint8Array };
  if (input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    validatePng(input);
    image = PNG.sync.read(input, { checkCRC: true });
  } else if (input[0] === 255 && input[1] === 216) {
    image = jpeg.decode(input, {
      useTArray: true,
      maxResolutionInMP: 1,
      maxMemoryUsageInMB: 32,
      tolerantDecoding: false,
    });
  } else throw new Error("INVALID_IMAGE_FORMAT");
  if (image.width * image.height > LIMITS.avatarPixels) throw new Error("INVALID_IMAGE_DIMENSIONS");
  const output = new PNG({ width: image.width, height: image.height });
  output.data = Buffer.from(image.data);
  return PNG.sync.write(output);
}
