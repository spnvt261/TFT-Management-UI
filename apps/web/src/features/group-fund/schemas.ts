import { z } from "zod";

export const contributionSchema = z.object({
  playerId: z.string().min(1, "Player is required"),
  amountVnd: z
    .number({ invalid_type_error: "Amount is required" })
    .int("Amount must be an integer")
    .positive("Amount must be positive"),
  note: z.string().max(400, "Note can be up to 400 characters").optional().or(z.literal("")),
  postedAt: z.string().optional()
});

export const withdrawalSchema = z.object({
  playerId: z.string().min(1, "Recipient player is required"),
  amountVnd: z
    .number({ invalid_type_error: "Amount is required" })
    .int("Amount must be an integer")
    .positive("Amount must be positive"),
  reason: z.string().min(3, "Reason must be at least 3 characters"),
  postedAt: z.string().optional()
});

export const manualTransactionSchema = z
  .object({
    transactionType: z.enum(["CONTRIBUTION", "WITHDRAWAL", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"]),
    playerId: z.string().optional().or(z.literal("")),
    amountVnd: z
      .number({ invalid_type_error: "Amount is required" })
      .int("Amount must be an integer")
      .positive("Amount must be positive"),
    reason: z.string().min(3, "Reason must be at least 3 characters"),
    postedAt: z.string().optional()
  })
  .superRefine((value, ctx) => {
    if ((value.transactionType === "CONTRIBUTION" || value.transactionType === "WITHDRAWAL") && !value.playerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["playerId"],
        message: "Player is required for this transaction type"
      });
    }
  });

export type ManualTransactionValues = z.infer<typeof manualTransactionSchema>;
export type ContributionValues = z.infer<typeof contributionSchema>;
export type WithdrawalValues = z.infer<typeof withdrawalSchema>;
