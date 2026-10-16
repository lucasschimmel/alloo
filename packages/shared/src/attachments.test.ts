import { expect, it } from "vitest";
import { attachmentName, boundedUpload } from "./attachments";
import { LIMITS } from "./policy";

it("T-MSG-FILE rejects oversized streams even without Content-Length", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(LIMITS.attachmentBytes));
      controller.enqueue(new Uint8Array(1));
      controller.close();
    },
  });
  const request = new Request("https://example.test", {
    method: "POST",
    body: stream,
    duplex: "half",
  } as RequestInit);
  await expect(boundedUpload(request)).rejects.toThrow("ATTACHMENT_TOO_LARGE");
});
it("T-MSG-FILE removes path and bidi controls and rejects executable/empty filenames", () => {
  expect(attachmentName("../../rapport\u202e.pdf")).toBe("rapport.pdf");
  expect(() => attachmentName("program.exe")).toThrow();
  expect(() => attachmentName("")).toThrow();
});
