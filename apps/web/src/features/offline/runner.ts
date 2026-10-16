import { OFFLINE, permanentSendError, retryDelay } from "@alloo/shared/offline";
import { LIMITS } from "@alloo/shared/policy";
import type { LocalStore, Queued } from "./store";
export type QueueTransport = {
  receipt: (item: Queued) => Promise<unknown>;
  upload: (item: Queued) => Promise<string>;
  send: (item: Queued) => Promise<unknown>;
};
export async function drainOne(store: LocalStore, transport: QueueTransport, signal: AbortSignal) {
  if (signal.aborted) return false;
  const lease = crypto.randomUUID(),
    item = await store.claim(lease);
  if (!item) return false;
  try {
    await store.valid();
    if (signal.aborted) throw new Error("ABORTED");
    if (await transport.receipt(item)) {
      await store.remove(item.operationId, lease);
      return true;
    }
    if (
      item.file &&
      (!item.attachmentId || (item.uploadedAt ?? 0) < Date.now() - LIMITS.attachmentExpiryMs)
    ) {
      item.attachmentId = (await transport.upload(item)) as Queued["attachmentId"];
      item.uploadedAt = Date.now();
      await store.update(item.operationId, lease, {
        attachmentId: item.attachmentId,
        uploadedAt: item.uploadedAt,
      });
    }
    await store.update(item.operationId, lease, {});
    if (signal.aborted) throw new Error("ABORTED");
    await transport.send(item);
    await store.remove(item.operationId, lease);
  } catch (error) {
    if (error instanceof Error && error.message === "LOCAL_CANCELED") return true;
    const attempts = item.attempts + 1;
    const failed = permanentSendError(error) || attempts >= OFFLINE.attempts;
    // Generation/lease checks prevent a delayed completion from recreating cleared data.
    await store
      .update(item.operationId, lease, {
        attempts,
        nextAt: Date.now() + retryDelay(attempts),
        leaseUntil: 0,
        error: failed
          ? permanentSendError(error)
            ? "PERMANENT_SEND_FAILURE"
            : "RETRY_EXHAUSTED"
          : undefined,
      })
      .catch((error) => {
        if (!(error instanceof Error && error.message === "LOCAL_CANCELED")) throw error;
      });
  }
  return true;
}
