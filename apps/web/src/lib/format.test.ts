import { describe, expect, it } from "vitest";
import { formatDateTime, formatRelativeTime, formatVnd } from "@/lib/format";

describe("format utils", () => {
  it("formats VND without changing integer semantics", () => {
    expect(formatVnd(1234567)).toContain("1.234.567");
    expect(formatVnd(-50000)).toContain("-50.000");
  });

  it("formats date-time with deterministic timezone", () => {
    expect(formatDateTime("2026-01-01T00:00:00.000Z", "Asia/Ho_Chi_Minh")).toBe("01/01/2026 07:00");
  });

  it("formats relative time", () => {
    expect(formatRelativeTime("2026-01-01T00:00:00.000Z")).toBeTypeOf("string");
  });
});
