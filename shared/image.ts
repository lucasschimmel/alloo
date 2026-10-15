import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import { LIMITS } from "./policy";
/** Decode and re-encode pixels, dropping original metadata and trailing payloads. */
export function sanitizeImage(bytes: ArrayBuffer) {
  if (!bytes.byteLength || bytes.byteLength > LIMITS.avatarBytes)
    throw new Error("INVALID_IMAGE_SIZE");
  const input = Buffer.from(bytes);
  let image: { width: number; height: number; data: Uint8Array };
  if (input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    if (input.length < 24) throw new Error("INVALID_IMAGE");
    const width = input.readUInt32BE(16),
      height = input.readUInt32BE(20);
    if (!width || !height || width * height > LIMITS.avatarPixels)
      throw new Error("INVALID_IMAGE_DIMENSIONS");
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
