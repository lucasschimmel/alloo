export const PUSH = { devices: 5, attempts: 3, timeout: 10_000, ttl: 60 };
export function validPushSubscription(endpoint: string, p256dh: string, auth: string) {
  try {
    const url = new URL(endpoint);
    return (
      endpoint.length <= 2048 &&
      url.protocol === "https:" &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.hash &&
      ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"].includes(
        url.hostname,
      ) &&
      /^[A-Za-z0-9_-]{87}=?$/.test(p256dh) &&
      /^[A-Za-z0-9_-]{22}={0,2}$/.test(auth)
    );
  } catch {
    return false;
  }
}
