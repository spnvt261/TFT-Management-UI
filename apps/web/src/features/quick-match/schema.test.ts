import { describe, expect, it } from "vitest";
import { playerFormSchema } from "@/features/players/schemas";
import { quickMatchSchema } from "@/features/quick-match/schema";

describe("schema validation", () => {
  it("rejects invalid player payload", () => {
    const result = playerFormSchema.safeParse({ displayName: "", avatarUrl: "not-url", isActive: true });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate quick match players", () => {
    const result = quickMatchSchema.safeParse({
      module: "MATCH_STAKES",
      participantCount: 3,
      ruleSetId: "r1",
      ruleSetVersionId: "",
      note: "",
      participants: [
        { playerId: "p1", tftPlacement: 1 },
        { playerId: "p1", tftPlacement: 2 },
        { playerId: "p3", tftPlacement: 3 }
      ]
    });

    expect(result.success).toBe(false);
  });
});
