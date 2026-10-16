import { attachmentName, boundedUpload } from "../shared/attachments";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";

function cors(request: Request) {
  const origin = request.headers.get("origin");
  const site = process.env.SITE_URL;
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  const allowed =
    !!origin &&
    (origin === site ||
      (process.env.ALLOO_DEV_AUTH === "true" && local.test(site ?? "") && local.test(origin)));
  return new Headers({
    ...(allowed ? { "Access-Control-Allow-Origin": origin } : {}),
    Vary: "Origin",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Expose-Headers": "Content-Disposition",
    "Content-Security-Policy": "sandbox; default-src 'none'",
  });
}
export const options = httpAction(
  async (_ctx, request) => new Response(null, { status: 204, headers: cors(request) }),
);
export const upload = httpAction(async (ctx, request) => {
  const headers = cors(request);
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("conversation") as Id<"conversations">;
    await ctx.runMutation(internal.attachmentRecords.reserve, { id });
    const name = attachmentName(url.searchParams.get("name") ?? "");
    const blob = await boundedUpload(request);
    const storageId = await ctx.storage.store(blob);
    try {
      const attachmentId = await ctx.runMutation(internal.attachmentRecords.commit, {
        id,
        storageId,
        name,
      });
      return Response.json({ id: attachmentId, name, size: blob.size }, { headers });
    } catch (error) {
      await ctx.storage.delete(storageId);
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code =
      ["ATTACHMENT_TOO_LARGE", "INVALID_ATTACHMENT", "RATE_LIMITED", "UPLOAD_TIMEOUT"].find(
        (code) => message.includes(code),
      ) ?? "FORBIDDEN";
    return Response.json(
      { error: code },
      {
        status: code === "ATTACHMENT_TOO_LARGE" ? 413 : code === "RATE_LIMITED" ? 429 : 400,
        headers,
      },
    );
  }
});
export const download = httpAction(async (ctx, request) => {
  const headers = cors(request);
  try {
    const id = new URL(request.url).searchParams.get("id") as Id<"attachments">;
    const file = await ctx.runQuery(internal.attachmentRecords.readable, { id });
    const blob = await ctx.storage.get(file.storageId);
    if (!blob) return new Response(null, { status: 404, headers });
    // Recheck after storage I/O so a revocation during the read does not authorize a new response.
    await ctx.runQuery(internal.attachmentRecords.readable, { id });
    headers.set("Content-Type", "application/octet-stream");
    headers.set(
      "Content-Disposition",
      `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/'/g, "%27")}`,
    );
    return new Response(blob, { headers });
  } catch {
    return new Response(null, { status: 404, headers });
  }
});
