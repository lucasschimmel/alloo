import { expect, it } from "vitest";
import { providerAvatar } from "./provider-avatar";

it("T-AC-10 T-PROFILE-FALLBACK permits provider images and rejects lookalike hosts, credentials and protocols", () => {
  for (const value of [
    "https://avatars.githubusercontent.com/u/123",
    "https://lh3.googleusercontent.com/a/photo",
  ])
    expect(providerAvatar(value)).toBe(value);
  for (const value of [
    "http://lh3.googleusercontent.com/a",
    "https://avatars.githubusercontent.com.evil.test/u",
    "https://user:pass@lh3.googleusercontent.com/a",
    "https://localhost/a",
    "data:image/png,x",
    "not a url",
    "https://lh3.googleusercontent.com:444/a",
  ])
    expect(providerAvatar(value)).toBeNull();
});
