import type { AppError } from "@/types/error";

export const knownErrorMessages: Record<string, string> = {
  MATCH_DUPLICATE_PLAYER: "Players must be unique.",
  MATCH_DUPLICATE_PLACEMENT: "Placements must be unique.",
  MATCH_PLACEMENT_INVALID: "Placements must be integers from 1 to 8.",
  MATCH_PLAYERS_INVALID: "One or more selected players are not active.",
  RULE_SET_VERSION_NOT_APPLICABLE: "No applicable active rule version for this participant count.",
  PLAYER_DUPLICATE: "Slug is already used by another player.",
  RULE_SET_DUPLICATE: "Rule set code already exists."
};

export const getErrorMessage = (error?: Partial<AppError> | null): string => {
  if (!error) {
    return "Unexpected error";
  }

  if (error.code && knownErrorMessages[error.code]) {
    return knownErrorMessages[error.code];
  }

  return error.message ?? "Unexpected error";
};
