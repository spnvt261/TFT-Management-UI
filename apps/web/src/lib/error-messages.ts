import type { AppError } from "@/types/error";

export const knownErrorMessages: Record<string, string> = {
  MATCH_DUPLICATE_PLAYER: "Players must be unique.",
  MATCH_DUPLICATE_PLACEMENT: "Placements must be unique.",
  MATCH_PLACEMENT_INVALID: "Placements must be integers from 1 to 8.",
  MATCH_PLAYERS_INVALID: "One or more selected players are not active.",
  RULE_SET_VERSION_NOT_APPLICABLE: "No applicable active rule version for this participant count.",
  PLAYER_DUPLICATE: "Slug is already used by another player.",
  RULE_SET_DUPLICATE: "Rule set code already exists.",
  RULE_SET_NOT_FOUND: "Rule set was not found.",
  RULE_SET_VERSION_INVALID: "Rule set version payload is invalid.",
  RULE_BUILDER_UNSUPPORTED_MODULE: "Builder mode is only supported for Match Stakes rule sets.",
  RULE_BUILDER_INVALID_CONFIG: "Builder configuration is invalid.",
  RULE_BUILDER_PAYOUT_LOSS_UNBALANCED: "Total payouts and losses must be balanced.",
  RULE_BUILDER_PARTICIPANT_COUNT_UNSUPPORTED: "Only participant count 3 or 4 is supported in builder mode.",
  RULE_BUILDER_DUPLICATE_RANK: "Duplicate payout/loss rank found.",
  RULE_BUILDER_RANK_COVERAGE_INVALID: "Payout/loss rank coverage is invalid."
};

const stringifyDetails = (details: unknown): string => {
  if (!details) {
    return "";
  }

  if (typeof details === "string") {
    return details;
  }

  try {
    return JSON.stringify(details);
  } catch {
    return "";
  }
};

export const getErrorMessage = (error?: Partial<AppError> | null): string => {
  if (!error) {
    return "Unexpected error";
  }

  const details = stringifyDetails(error.details);

  if (error.code && knownErrorMessages[error.code]) {
    const base = knownErrorMessages[error.code];
    if (details) {
      return `${base} (${details})`;
    }

    return base;
  }

  if (error.message && details) {
    return `${error.message} (${details})`;
  }

  return error.message ?? "Unexpected error";
};
