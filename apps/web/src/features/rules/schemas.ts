import { z } from "zod";
import type { ConditionOperator, RuleActionType, RuleConditionKey, RuleKind, RuleStatus, SelectorType } from "@/types/api";

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

export const ruleSetVersionSchema = z
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
export type RuleSetVersionValues = z.infer<typeof ruleSetVersionSchema>;
export type RuleSetVersionMetaValues = z.infer<typeof ruleSetVersionMetaSchema>;

export const parseJsonOrDefault = (value?: string | null, fallback: unknown = {}) => {
  if (!value) {
    return fallback;
  }

  return JSON.parse(value);
};
