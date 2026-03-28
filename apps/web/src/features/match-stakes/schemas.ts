import { z } from "zod";

export const historyEventSchema = z
  .object({
    periodId: z.string().optional().or(z.literal("")),
    eventType: z.enum(["ADVANCE", "NOTE", "DEBT_SETTLEMENT"]),
    playerId: z.string().optional().or(z.literal("")),
    participantPlayerIds: z.array(z.string().trim().min(1)).default([]),
    amountVnd: z.number().int("Amount must be an integer").nonnegative("Amount must be non-negative").optional(),
    note: z.string().trim().min(1, "Note is required").max(400, "Note can be up to 400 characters"),
    impactMode: z.enum(["AFFECTS_DEBT", "INFORMATIONAL"])
  })
  .superRefine((value, ctx) => {
    if (value.eventType === "ADVANCE") {
      if (value.participantPlayerIds.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["participantPlayerIds"],
          message: "Participants are required for advance events"
        });
      }

      if (!value.playerId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["playerId"],
          message: "Advancer is required for advance events"
        });
      }

      if (value.playerId && !value.participantPlayerIds.includes(value.playerId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["playerId"],
          message: "Advancer must be one of the selected participants"
        });
      }
    }

    if ((value.eventType === "ADVANCE" || value.eventType === "DEBT_SETTLEMENT") && (!value.amountVnd || value.amountVnd <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amountVnd"],
        message: "Amount must be greater than 0 for this event type"
      });
    }
  });

export type HistoryEventValues = z.input<typeof historyEventSchema>;
