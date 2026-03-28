import { z } from "zod";

export const historyEventSchema = z
  .object({
    periodId: z.string().optional().or(z.literal("")),
    eventType: z.enum(["ADVANCE", "NOTE", "DEBT_SETTLEMENT"]),
    playerId: z.string().optional().or(z.literal("")),
    amountVnd: z.number().int("Amount must be an integer").nonnegative("Amount must be non-negative").optional(),
    note: z.string().trim().min(1, "Note is required").max(400, "Note can be up to 400 characters"),
    impactMode: z.enum(["AFFECTS_DEBT", "INFORMATION_ONLY"])
  })
  .superRefine((value, ctx) => {
    if (value.eventType === "ADVANCE" && !value.playerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["playerId"],
        message: "Player is required for advance events"
      });
    }

    if ((value.eventType === "ADVANCE" || value.eventType === "DEBT_SETTLEMENT") && (!value.amountVnd || value.amountVnd <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amountVnd"],
        message: "Amount must be greater than 0 for this event type"
      });
    }
  });

export type HistoryEventValues = z.infer<typeof historyEventSchema>;
