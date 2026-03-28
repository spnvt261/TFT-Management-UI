import type { DebtPeriodStatus, GroupFundTransactionType, MatchStatus, ModuleType, RuleKind, RuleStatus } from "@/types/api";

export const moduleLabels: Record<ModuleType, string> = {
  MATCH_STAKES: "Match Stakes",
  GROUP_FUND: "Group Fund"
};

export const matchStatusLabels: Record<string, string> = {
  DRAFT: "Draft",
  CALCULATED: "Calculated",
  POSTED: "Posted",
  VOIDED: "Voided"
};

export const ruleStatusLabels: Record<RuleStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive"
};

export const ruleKindLabels: Record<RuleKind, string> = {
  BASE_RELATIVE_RANK: "Base Relative Rank",
  ABSOLUTE_PLACEMENT_MODIFIER: "Absolute Placement Modifier",
  PAIR_CONDITION_MODIFIER: "Pair Condition Modifier",
  FUND_CONTRIBUTION: "Fund Contribution",
  CUSTOM: "Custom"
};

export const groupFundTransactionLabels: Record<GroupFundTransactionType, string> = {
  CONTRIBUTION: "Contribution",
  WITHDRAWAL: "Withdrawal",
  ADJUSTMENT_IN: "Adjustment In",
  ADJUSTMENT_OUT: "Adjustment Out",
  FUND_ADVANCE: "Fund Advance"
};

export const debtPeriodStatusLabels: Record<DebtPeriodStatus, string> = {
  OPEN: "Open",
  CLOSED: "Closed"
};

export const getEnumLabel = (map: Record<string, string>, value: string) => map[value] ?? value;
