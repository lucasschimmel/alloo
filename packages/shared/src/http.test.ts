import { expect, it } from "vitest";
import { frontendHealth, frontendResponse } from "./http";

it("T-AC-90 preserves redirects and headers while protecting private responses", async () => {
  const response = frontendResponse(
    new Request("https://app.example.com/app?conversation=example"),
    new Response("redirect", {
      status: 302,
      headers: { Location: "/destination", "X-Trace": "kept" },
    }),
  );
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe("/destination");
  expect(response.headers.get("x-trace")).toBe("kept");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("strict-transport-security")).toBe("max-age=15552000");
  expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  expect(await response.text()).toBe("redirect");
});

it("T-AC-90 preserves public caching on HTTP and reports frontend liveness without caching", async () => {
  const response = frontendResponse(
    new Request("http://localhost/"),
    new Response("public", {
      headers: { "Cache-Control": "max-age=60" },
    }),
  );
  expect(response.headers.get("cache-control")).toBe("max-age=60");
  expect(response.headers.has("strict-transport-security")).toBe(false);
  const health = frontendHealth("alloo-landing");
  expect(health.headers.get("cache-control")).toBe("no-store");
  expect(await health.json()).toEqual({ status: "ok", service: "alloo-landing" });
});
