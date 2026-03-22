import { z } from "zod";
import type { ModuleType } from "@/types/api";

export const participantSchema = z.object({
  playerId: z.string().min(1, "Player is required"),
  tftPlacement: z
    .number({ invalid_type_error: "Placement is required" })
    .int("Placement must be integer")
    .min(1, "Placement must be at least 1")
    .max(8, "Placement must be at most 8")
});

export const quickMatchSchema = z
  .object({
    module: z.enum(["MATCH_STAKES", "GROUP_FUND"]),
    participantCount: z.union([z.literal(3), z.literal(4)]),
    ruleSetId: z.string().min(1, "Rule set is required"),
    ruleSetVersionId: z.string().optional().or(z.literal("")),
    note: z.string().max(400).optional(),
    participants: z.array(participantSchema).min(3).max(4)
  })
  .superRefine((value, ctx) => {
    if (value.participants.length !== value.participantCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["participants"],
        message: `Select exactly ${value.participantCount} participants`
      });
    }

    const playerIds = value.participants.map((participant) => participant.playerId);
    const placements = value.participants.map((participant) => participant.tftPlacement);

    if (new Set(playerIds).size !== playerIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["participants"],
        message: "Players must be unique"
      });
    }

    if (new Set(placements).size !== placements.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["participants"],
        message: "Placements must be unique"
      });
    }
  });

export type QuickMatchFormValues = z.infer<typeof quickMatchSchema>;

export const defaultQuickMatchParticipants = (count: 3 | 4) =>
  Array.from({ length: count }, (_, index) => ({
    playerId: "",
    tftPlacement: index + 1
  }));

export const modules: ModuleType[] = ["MATCH_STAKES", "GROUP_FUND"];
