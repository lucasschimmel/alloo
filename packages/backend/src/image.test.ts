import { PNG } from "pngjs";
import { expect, it, vi } from "vitest";
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
  const header = PNG.sync.write(new PNG({ width: 1, height: 1 }));
  header.writeUInt32BE(65535, 16);
  header.writeUInt32BE(65535, 20);
  expect(() => sanitizeImage(bytes(header))).toThrow("INVALID_IMAGE_DIMENSIONS");
});

it("T-PROD-UPLOAD rejects duplicate headers before invoking the decoder", () => {
  const small = PNG.sync.write(new PNG({ width: 1, height: 1 }));
  const larger = PNG.sync.write(new PNG({ width: 32, height: 32 }));
  const read = vi.spyOn(PNG.sync, "read");
  try {
    expect(() =>
      sanitizeImage(bytes(Buffer.concat([small.subarray(0, 33), larger.subarray(8)]))),
    ).toThrow();
    expect(read).not.toHaveBeenCalled();
  } finally {
    read.mockRestore();
  }
});
it("T-PROD-UPLOAD rejects interlacing before invoking unbounded inflate", () => {
  const input = PNG.sync.write(new PNG({ width: 1, height: 1 }));
  input[28] = 1;
  const read = vi.spyOn(PNG.sync, "read");
  try {
    expect(() => sanitizeImage(bytes(input))).toThrow();
    expect(read).not.toHaveBeenCalled();
  } finally {
    read.mockRestore();
  }
});
it("T-PROD-UPLOAD bounds decompression even when the single header lies", () => {
  const small = PNG.sync.write(new PNG({ width: 1, height: 1 }));
  const larger = PNG.sync.write(new PNG({ width: 64, height: 64 }));
  const read = vi.spyOn(PNG.sync, "read");
  try {
    expect(() =>
      sanitizeImage(bytes(Buffer.concat([small.subarray(0, 33), larger.subarray(33)]))),
    ).toThrow();
    expect(read).not.toHaveBeenCalled();
  } finally {
    read.mockRestore();
  }
});
