/** Apply the same response policy to both frontend Workers. */
export function frontendResponse(request: Request, response: Response) {
  const url = new URL(request.url);
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "no-referrer");
  if (url.protocol === "https:") headers.set("Strict-Transport-Security", "max-age=15552000");
  headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(self), display-capture=(self), geolocation=()",
  );
  headers.set(
    "Content-Security-Policy",
    "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  );
  if (url.pathname.startsWith("/app")) headers.set("Cache-Control", "private, no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function frontendHealth(service: string) {
  return Response.json({ status: "ok", service }, { headers: { "Cache-Control": "no-store" } });
}
