// Remote OAuth images are rendered by the browser, never fetched by the backend.
export function providerAvatar(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (
      url.hostname !== "avatars.githubusercontent.com" &&
      !/^lh\d+\.googleusercontent\.com$/.test(url.hostname)
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
