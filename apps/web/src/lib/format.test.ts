import { afterEach, describe, expect, it } from "vitest";
import { formatDateTime, formatRelativeTime, formatVnd, MONEY_DISPLAY_MODE_STORAGE_KEY } from "@/lib/format";

afterEach(() => {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(MONEY_DISPLAY_MODE_STORAGE_KEY);
  }
});

describe("format utils", () => {
  it("defaults to basic money display mode when no local setting exists", () => {
    expect(formatVnd(1234567)).toBe("1.234,6");
    expect(formatVnd(-50000)).toBe("-50");
  });

  it("supports alternative money display modes", () => {
    expect(formatVnd(10000, "dong")).toBe("10.000đ");
    expect(formatVnd(10000, "basic")).toBe("10");
  });

  it("respects money display mode from localStorage", () => {
    window.localStorage.setItem(MONEY_DISPLAY_MODE_STORAGE_KEY, "basic");
    expect(formatVnd(10000)).toBe("10");
  });

  it("formats date-time with deterministic timezone", () => {
    expect(formatDateTime("2026-01-01T00:00:00.000Z", "Asia/Ho_Chi_Minh")).toBe("01/01/2026 07:00");
  });

  it("formats relative time", () => {
    expect(formatRelativeTime("2026-01-01T00:00:00.000Z")).toBeTypeOf("string");
  });
});
