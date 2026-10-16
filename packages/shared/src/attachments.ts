import { LIMITS } from "./policy";
export const ATTACHMENT_ACCEPT =
  ".png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.csv,.zip,.docx,.xlsx,.pptx,.mp3,.mp4,.webm,.ogg,.wav";
export function attachmentName(input: string) {
  const name = input
    .normalize("NFC")
    .split(/[\\/]/)
    .at(-1)
    // biome-ignore lint/suspicious/noControlCharactersInRegex: Remove controls and bidi spoofing from download filenames.
    ?.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "")
    .trim();
  if (
    !name ||
    name.length > 180 ||
    !ATTACHMENT_ACCEPT.split(",").some((ext) => name.toLowerCase().endsWith(ext))
  )
    throw new Error("INVALID_ATTACHMENT");
  return name;
}
export async function boundedUpload(request: Request) {
  const declared = Number(request.headers.get("content-length"));
  if (declared > LIMITS.attachmentBytes) throw new Error("ATTACHMENT_TOO_LARGE");
  if (!request.body) throw new Error("INVALID_ATTACHMENT");
  const reader = request.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void reader.cancel().catch(() => undefined);
  }, LIMITS.attachmentUploadMs);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (timedOut) throw new Error("UPLOAD_TIMEOUT");
      if (done) break;
      size += value.byteLength;
      if (size > LIMITS.attachmentBytes) {
        await reader.cancel();
        throw new Error("ATTACHMENT_TOO_LARGE");
      }
      chunks.push(new Uint8Array(value));
    }
    if (!size) throw new Error("INVALID_ATTACHMENT");
    return new Blob(chunks, { type: "application/octet-stream" });
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}
