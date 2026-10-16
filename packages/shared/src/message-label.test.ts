import { expect, it } from "vitest";
import { dateLabel, sameDay } from "./message-label";
import { validReaction } from "./policy";

it("T-AC-06 T-MESSAGE-PARITY accepts complete emoji sequences and rejects text or multiple reactions", () => {
  for (const value of ["🦊", "👍🏽", "👨‍👩‍👧‍👦", "🇫🇷", "❤️"])
    expect(validReaction(value)).toBe(true);
  for (const value of ["abc", "<script>", "👍👍", "", "a🦊"])
    expect(validReaction(value)).toBe(false);
});
it("T-AC-06 T-MESSAGE-PARITY separates calendar days including the previous year", () => {
  const today = new Date(2026, 0, 1, 12).getTime();
  expect(dateLabel(today, today)).toBe("Aujourd’hui");
  expect(dateLabel(new Date(2025, 11, 31, 23).getTime(), today)).toBe("Hier");
  expect(sameDay(today, new Date(2025, 0, 1, 12).getTime())).toBe(false);
});
