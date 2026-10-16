import { frontendHealth, frontendResponse } from "@alloo/shared/http";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

export default createServerEntry({
  async fetch(request, options) {
    if (new URL(request.url).pathname === "/healthz") return frontendHealth("alloo-frontend");
    return frontendResponse(request, await handler.fetch(request, options));
  },
});
