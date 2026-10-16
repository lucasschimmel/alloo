import { expect, it, vi } from "vitest";
import { MediaLease } from "./media-lease";

it("T-MEDIA stops media that resolves after cancellation", async () => {
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
  let resolve: (value: MediaStream) => void = () => {
    throw new Error("not initialized");
  };
  const pending = new Promise<MediaStream>((done) => {
    resolve = done;
  });
  const lease = new MediaLease(),
    request = lease.acquire(pending);
  lease.close();
  resolve(stream);
  await expect(request).rejects.toThrow("Canceled");
  expect(stop).toHaveBeenCalledOnce();
});
it("T-MEDIA teardown immediately stops known tracks and is idempotent", async () => {
  const stop = vi.fn();
  const lease = new MediaLease();
  await lease.acquire(Promise.resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream));
  lease.close();
  lease.close();
  expect(stop).toHaveBeenCalledOnce();
});
