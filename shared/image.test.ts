import { PNG } from "pngjs";
import { expect, it } from "vitest";
import { sanitizeImage } from "./image";

function bytes(buffer: Buffer) {
  return new Uint8Array(buffer).buffer;
}
it("T-PROFILE decodes valid pixels and rejects trailing payload", () => {
  const original = new PNG({ width: 2, height: 2 });
  original.data.fill(255);
  const encoded = PNG.sync.write(original);
  const sanitized = sanitizeImage(bytes(encoded));
  expect(PNG.sync.read(sanitized).width).toBe(2);
  expect(() => sanitizeImage(bytes(Buffer.concat([encoded, Buffer.from("payload")])))).toThrow();
});
it("T-PROFILE rejects signature-only and active files", () => {
  expect(() => sanitizeImage(bytes(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))).toThrow();
  expect(() => sanitizeImage(bytes(Buffer.from("<svg onload='evil()'/>")))).toThrow(
    "INVALID_IMAGE_FORMAT",
  );
});
it("T-PROFILE rejects a pixel bomb before decoding", () => {
  const header = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(header);
  header.writeUInt32BE(65535, 16);
  header.writeUInt32BE(65535, 20);
  expect(() => sanitizeImage(bytes(header))).toThrow("INVALID_IMAGE_DIMENSIONS");
});
