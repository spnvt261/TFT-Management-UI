import { afterEach, describe, expect, it } from "vitest";
import { formatDateTime, formatRelativeTime, formatVnd, MONEY_DISPLAY_MODE_STORAGE_KEY } from "@/lib/format";

afterEach(() => {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(MONEY_DISPLAY_MODE_STORAGE_KEY);
  }
});

describe("format utils", () => {
  it("formats VND without changing integer semantics", () => {
    expect(formatVnd(1234567)).toContain("1.234.567");
    expect(formatVnd(-50000)).toContain("-50.000");
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
