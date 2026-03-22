import { z } from "zod";
import type {
  ConditionOperator,
  MatchStakesPenaltyDestinationSelectorType,
  RuleActionType,
  RuleConditionKey,
  RuleKind,
  RuleStatus,
  SelectorType
} from "@/types/api";

export const ruleSetMetaSchema = z.object({
  module: z.enum(["MATCH_STAKES", "GROUP_FUND"]),
  code: z.string().min(1, "Code is required").max(80),
  name: z.string().min(1, "Name is required").max(150),
  description: z.string().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  isDefault: z.boolean()
});

const jsonTextSchema = z
  .string()
  .optional()
  .or(z.literal(""))
  .refine((value) => {
    if (!value) {
      return true;
    }

    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }, "Must be valid JSON");

const positiveIntSchema = z.number().int().positive("Amount must be a positive integer");
const nonNegativeIntSchema = z.number().int().min(0, "Amount must be a non-negative integer");

const rankAmountSchema = z.object({
  relativeRank: z.number().int().min(1),
  amountVnd: positiveIntSchema
});

const nonNegativeRankAmountSchema = z.object({
  relativeRank: z.number().int().min(1),
  amountVnd: nonNegativeIntSchema
});

const penaltyDestinationTypeSchema = z.enum([
  "BEST_PARTICIPANT",
  "MATCH_WINNER",
  "FIXED_PLAYER",
  "FUND_ACCOUNT"
] as [MatchStakesPenaltyDestinationSelectorType, ...MatchStakesPenaltyDestinationSelectorType[]]);

const penaltySchema = z.object({
  absolutePlacement: z.number().int().min(1).max(8),
  amountVnd: positiveIntSchema,
  destinationSelectorType: penaltyDestinationTypeSchema,
  destinationSelectorJsonText: jsonTextSchema,
  code: z.string().max(80).optional().or(z.literal("")),
  name: z.string().max(150).optional().or(z.literal("")),
  description: z.string().optional().or(z.literal(""))
});

const simplifiedPenaltyDestinationTypeSchema = z.enum(["BEST_PARTICIPANT", "FUND_ACCOUNT"] as [
  MatchStakesPenaltyDestinationSelectorType,
  MatchStakesPenaltyDestinationSelectorType
]);

const simplifiedPenaltySchema = z.object({
  absolutePlacement: z.number().int().min(1).max(8),
  amountVnd: nonNegativeIntSchema,
  destinationSelectorType: simplifiedPenaltyDestinationTypeSchema
});

const groupFundPenaltySchema = z.object({
  absolutePlacement: z.number().int().min(1).max(8),
  amountVnd: nonNegativeIntSchema
});

const isUnique = (values: number[]) => new Set(values).size === values.length;

const matchStakesBuilderFormBaseSchema = z.object({
  participantCount: z.union([z.literal(3), z.literal(4)]),
  winnerCount: z.number().int().min(1),
  effectiveTo: z.string().optional().or(z.literal("")),
  isActive: z.boolean(),
  summaryJsonText: jsonTextSchema,
  payouts: z.array(rankAmountSchema).min(1),
  losses: z.array(rankAmountSchema).min(1),
  penalties: z.array(penaltySchema)
});

const refineMatchStakesBuilder = (
  value: {
    participantCount: 3 | 4;
    winnerCount: number;
    payouts: Array<{ relativeRank: number; amountVnd: number }>;
    losses: Array<{ relativeRank: number; amountVnd: number }>;
  },
  ctx: z.RefinementCtx
) => {
  if (value.winnerCount >= value.participantCount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Winner count must be smaller than participant count",
      path: ["winnerCount"]
    });
  }

  const payoutRanks = value.payouts.map((item) => item.relativeRank);
  const lossRanks = value.losses.map((item) => item.relativeRank);

  if (!isUnique(payoutRanks)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Payout ranks must be unique",
      path: ["payouts"]
    });
  }

  if (!isUnique(lossRanks)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Loss ranks must be unique",
      path: ["losses"]
    });
  }

  const expectedPayoutRanks = Array.from({ length: value.winnerCount }, (_, index) => index + 1);
  const expectedLossRanks = Array.from(
    { length: value.participantCount - value.winnerCount },
    (_, index) => index + value.winnerCount + 1
  );

  const payoutSet = new Set(payoutRanks);
  const lossSet = new Set(lossRanks);

  const payoutCoverageValid =
    payoutSet.size === expectedPayoutRanks.length && expectedPayoutRanks.every((rank) => payoutSet.has(rank));
  const lossCoverageValid =
    lossSet.size === expectedLossRanks.length && expectedLossRanks.every((rank) => lossSet.has(rank));

  if (!payoutCoverageValid || !lossCoverageValid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Payout/loss rank coverage must map exactly to participant ranks",
      path: ["payouts"]
    });
  }

  const allRanks = new Set([...payoutRanks, ...lossRanks]);
  if (allRanks.size !== value.participantCount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Payout and loss ranks must not overlap and must cover all participant ranks",
      path: ["losses"]
    });
  }

  const totalPayout = value.payouts.reduce((sum, item) => sum + item.amountVnd, 0);
  const totalLoss = value.losses.reduce((sum, item) => sum + item.amountVnd, 0);

  if (totalPayout !== totalLoss) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Total payouts must equal total losses",
      path: ["losses"]
    });
  }
};

export const matchStakesVersionBuilderSchema = matchStakesBuilderFormBaseSchema.superRefine(refineMatchStakesBuilder);

const matchStakesRuleCreateFlowBaseSchema = z.object({
  participantCount: z.union([z.literal(3), z.literal(4)]),
  winnerCount: z.number().int().min(1),
  winnerPayouts: z.array(nonNegativeRankAmountSchema),
  losses: z.array(nonNegativeRankAmountSchema).min(1),
  penalties: z.array(simplifiedPenaltySchema)
});

const refineMatchStakesRuleCreateFlow = (
  value: {
    participantCount: 3 | 4;
    winnerCount: number;
    winnerPayouts: Array<{ relativeRank: number; amountVnd: number }>;
    losses: Array<{ relativeRank: number; amountVnd: number }>;
  },
  ctx: z.RefinementCtx
) => {
  if (value.winnerCount >= value.participantCount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Winner count must be smaller than participant count",
      path: ["winnerCount"]
    });
  }

  const winnerRanks = value.winnerPayouts.map((item) => item.relativeRank);
  const lossRanks = value.losses.map((item) => item.relativeRank);

  if (!isUnique(winnerRanks)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Winner payout ranks must be unique",
      path: ["winnerPayouts"]
    });
  }

  if (!isUnique(lossRanks)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Loser ranks must be unique",
      path: ["losses"]
    });
  }

  const expectedWinnerRanks = Array.from({ length: Math.max(0, value.winnerCount - 1) }, (_, index) => index + 2);
  const expectedLossRanks = Array.from(
    { length: value.participantCount - value.winnerCount },
    (_, index) => index + value.winnerCount + 1
  );

  const winnerSet = new Set(winnerRanks);
  const lossSet = new Set(lossRanks);

  const winnerCoverageValid =
    winnerSet.size === expectedWinnerRanks.length &&
    expectedWinnerRanks.every((rank) => winnerSet.has(rank));
  const lossCoverageValid = lossSet.size === expectedLossRanks.length && expectedLossRanks.every((rank) => lossSet.has(rank));

  if (!winnerCoverageValid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Winner payout rows must cover ranks 2..winner count",
      path: ["winnerPayouts"]
    });
  }

  if (!lossCoverageValid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Loser rows must cover non-winner ranks",
      path: ["losses"]
    });
  }

  const totalLoss = value.losses.reduce((sum, item) => sum + item.amountVnd, 0);
  const totalOtherWinnerPayout = value.winnerPayouts.reduce((sum, item) => sum + item.amountVnd, 0);
  const topWinnerPayout = totalLoss - totalOtherWinnerPayout;

  if (topWinnerPayout < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Top 1 payout cannot be negative. Reduce lower winner payouts or increase losses.",
      path: ["winnerPayouts"]
    });
  }

  const totalPayout = topWinnerPayout + totalOtherWinnerPayout;
  if (totalPayout !== totalLoss) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Payouts and losses must balance exactly",
      path: ["losses"]
    });
  }

  if (value.winnerCount > 1) {
    const rank2Payout = value.winnerPayouts.find((item) => item.relativeRank === 2)?.amountVnd ?? 0;
    if (topWinnerPayout <= rank2Payout) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Winner rank 1 payout must be greater than winner rank 2",
        path: ["winnerPayouts"]
      });
    }
  }
};

export const matchStakesRuleCreateFlowSchema = ruleSetMetaSchema
  .omit({ module: true, status: true, code: true })
  .extend(matchStakesRuleCreateFlowBaseSchema.shape)
  .superRefine(refineMatchStakesRuleCreateFlow);

const groupFundRuleCreateFlowBaseSchema = z.object({
  participantCount: z.union([z.literal(3), z.literal(4)]),
  contributions: z.array(nonNegativeRankAmountSchema).min(1),
  penalties: z.array(groupFundPenaltySchema)
});

const refineGroupFundRuleCreateFlow = (
  value: {
    participantCount: 3 | 4;
    contributions: Array<{ relativeRank: number; amountVnd: number }>;
    penalties: Array<{ absolutePlacement: number; amountVnd: number }>;
  },
  ctx: z.RefinementCtx
) => {
  const contributionRanks = value.contributions.map((item) => item.relativeRank);
  if (!isUnique(contributionRanks)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Contribution ranks must be unique",
      path: ["contributions"]
    });
  }

  const expectedRanks = Array.from({ length: value.participantCount }, (_, index) => index + 1);
  const contributionSet = new Set(contributionRanks);
  const coverageValid =
    contributionSet.size === expectedRanks.length && expectedRanks.every((rank) => contributionSet.has(rank));

  if (!coverageValid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Contribution rows must cover all participant ranks",
      path: ["contributions"]
    });
  }

  const penaltyPlacements = value.penalties.map((item) => item.absolutePlacement);
  if (!isUnique(penaltyPlacements)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Penalty placements must be unique",
      path: ["penalties"]
    });
  }

  const hasPositiveContribution = value.contributions.some((item) => item.amountVnd > 0);
  const hasPositivePenalty = value.penalties.some((item) => item.amountVnd > 0);
  if (!hasPositiveContribution && !hasPositivePenalty) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one contribution or penalty amount must be greater than 0",
      path: ["contributions"]
    });
  }
};

export const groupFundRuleCreateFlowSchema = ruleSetMetaSchema
  .omit({ module: true, status: true, code: true })
  .extend(groupFundRuleCreateFlowBaseSchema.shape)
  .superRefine(refineGroupFundRuleCreateFlow);

const conditionSchema = z.object({
  conditionKey: z.enum([
    "participantCount",
    "module",
    "subjectRelativeRank",
    "subjectAbsolutePlacement",
    "matchContainsAbsolutePlacements"
  ] as [RuleConditionKey, ...RuleConditionKey[]]),
  operator: z.enum(["EQ", "NEQ", "GT", "GTE", "LT", "LTE", "IN", "NOT_IN", "BETWEEN", "CONTAINS"] as [
    ConditionOperator,
    ...ConditionOperator[]
  ]),
  valueJsonText: jsonTextSchema,
  sortOrder: z.number().int().min(1)
});

const actionSchema = z.object({
  actionType: z.enum(["TRANSFER", "POST_TO_FUND", "CREATE_OBLIGATION", "REDUCE_OBLIGATION"] as [RuleActionType, ...RuleActionType[]]),
  amountVnd: z.number().int().positive(),
  sourceSelectorType: z.enum([
    "SUBJECT_PLAYER",
    "PLAYER_BY_RELATIVE_RANK",
    "PLAYER_BY_ABSOLUTE_PLACEMENT",
    "MATCH_WINNER",
    "MATCH_RUNNER_UP",
    "BEST_PARTICIPANT",
    "WORST_PARTICIPANT",
    "FUND_ACCOUNT",
    "SYSTEM_ACCOUNT",
    "FIXED_PLAYER"
  ] as [SelectorType, ...SelectorType[]]),
  sourceSelectorJsonText: jsonTextSchema,
  destinationSelectorType: z.enum([
    "SUBJECT_PLAYER",
    "PLAYER_BY_RELATIVE_RANK",
    "PLAYER_BY_ABSOLUTE_PLACEMENT",
    "MATCH_WINNER",
    "MATCH_RUNNER_UP",
    "BEST_PARTICIPANT",
    "WORST_PARTICIPANT",
    "FUND_ACCOUNT",
    "SYSTEM_ACCOUNT",
    "FIXED_PLAYER"
  ] as [SelectorType, ...SelectorType[]]),
  destinationSelectorJsonText: jsonTextSchema,
  descriptionTemplate: z.string().optional().or(z.literal("")),
  sortOrder: z.number().int().min(1)
});

const ruleSchema = z.object({
  code: z.string().min(1).max(80),
  name: z.string().min(1).max(150),
  description: z.string().optional().or(z.literal("")),
  ruleKind: z.enum([
    "BASE_RELATIVE_RANK",
    "ABSOLUTE_PLACEMENT_MODIFIER",
    "PAIR_CONDITION_MODIFIER",
    "FUND_CONTRIBUTION",
    "CUSTOM"
  ] as [RuleKind, ...RuleKind[]]),
  priority: z.number().int().min(1),
  status: z.enum(["ACTIVE", "INACTIVE"] as [RuleStatus, ...RuleStatus[]]),
  stopProcessingOnMatch: z.boolean(),
  metadataText: jsonTextSchema,
  conditions: z.array(conditionSchema).min(1, "Add at least one condition"),
  actions: z.array(actionSchema).min(1, "Add at least one action")
});

export const rawRuleSetVersionSchema = z
  .object({
    participantCountMin: z.number().int().min(2).max(8),
    participantCountMax: z.number().int().min(2).max(8),
    effectiveTo: z.string().optional().or(z.literal("")),
    isActive: z.boolean(),
    summaryJsonText: jsonTextSchema,
    rules: z.array(ruleSchema).min(1, "At least one rule is required")
  })
  .refine((value) => value.participantCountMin <= value.participantCountMax, {
    message: "Participant min must be <= max",
    path: ["participantCountMax"]
  });

export const ruleSetVersionMetaSchema = z.object({
  isActive: z.boolean(),
  effectiveTo: z.string().optional().or(z.literal("")),
  summaryJsonText: jsonTextSchema
});

export type RuleSetMetaValues = z.infer<typeof ruleSetMetaSchema>;
export type MatchStakesVersionBuilderValues = z.infer<typeof matchStakesVersionBuilderSchema>;
export type MatchStakesRuleCreateFlowValues = z.infer<typeof matchStakesRuleCreateFlowSchema>;
export type MatchStakesCreatePenaltyValues = z.infer<typeof simplifiedPenaltySchema>;
export type GroupFundRuleCreateFlowValues = z.infer<typeof groupFundRuleCreateFlowSchema>;
export type RawRuleSetVersionValues = z.infer<typeof rawRuleSetVersionSchema>;
export type RuleSetVersionMetaValues = z.infer<typeof ruleSetVersionMetaSchema>;

export const parseJsonOrDefault = (value?: string | null, fallback: unknown = {}) => {
  if (!value) {
    return fallback;
  }

  return JSON.parse(value);
};
