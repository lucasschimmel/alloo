import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

export default createServerEntry({
  async fetch(request, options) {
    if (new URL(request.url).pathname === "/healthz")
      return Response.json(
        { status: "ok", service: "alloo-frontend" },
        { headers: { "Cache-Control": "no-store" } },
      );
    const response = await handler.fetch(request, options);
    const headers = new Headers(response.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");
    headers.set("Referrer-Policy", "no-referrer");
    if (new URL(request.url).protocol === "https:")
      headers.set("Strict-Transport-Security", "max-age=15552000");
    headers.set(
      "Permissions-Policy",
      "camera=(self), microphone=(self), display-capture=(self), geolocation=()",
    );
    headers.set(
      "Content-Security-Policy",
      "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
    );
    if (new URL(request.url).pathname.startsWith("/app"))
      headers.set("Cache-Control", "private, no-store");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
});
