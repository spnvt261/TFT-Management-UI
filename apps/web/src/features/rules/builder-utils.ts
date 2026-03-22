import type { MatchStakesBuilderConfig, MatchStakesPenaltyConfig } from "@/types/api";

const amountFormatter = new Intl.NumberFormat("vi-VN");

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const asInt = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null;
  }

  return value;
};

const normalizeRankAmounts = (value: unknown): Array<{ relativeRank: number; amountVnd: number }> | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized: Array<{ relativeRank: number; amountVnd: number }> = [];

  for (const item of value) {
    if (!isRecord(item)) {
      return null;
    }

    const relativeRank = asInt(item.relativeRank);
    const amountVnd = asInt(item.amountVnd);

    if (!relativeRank || !amountVnd) {
      return null;
    }

    normalized.push({ relativeRank, amountVnd });
  }

  return normalized;
};

const normalizePenalty = (value: unknown): MatchStakesPenaltyConfig | null => {
  if (!isRecord(value)) {
    return null;
  }

  const absolutePlacement = asInt(value.absolutePlacement);
  const amountVnd = asInt(value.amountVnd);

  if (!absolutePlacement || !amountVnd) {
    return null;
  }

  const destinationSelectorType =
    value.destinationSelectorType === "BEST_PARTICIPANT" ||
    value.destinationSelectorType === "MATCH_WINNER" ||
    value.destinationSelectorType === "FIXED_PLAYER" ||
    value.destinationSelectorType === "FUND_ACCOUNT"
      ? value.destinationSelectorType
      : "BEST_PARTICIPANT";

  return {
    absolutePlacement,
    amountVnd,
    destinationSelectorType,
    destinationSelectorJson: isRecord(value.destinationSelectorJson)
      ? value.destinationSelectorJson
      : value.destinationSelectorJson === null
        ? null
        : undefined,
    code: typeof value.code === "string" && value.code.trim() ? value.code : undefined,
    name: typeof value.name === "string" && value.name.trim() ? value.name : undefined,
    description:
      typeof value.description === "string" ? value.description : value.description === null ? null : undefined
  };
};

export const normalizeMatchStakesBuilderConfig = (value: unknown): MatchStakesBuilderConfig | null => {
  if (!isRecord(value)) {
    return null;
  }

  const participantCount = asInt(value.participantCount);
  const winnerCount = asInt(value.winnerCount);
  const payouts = normalizeRankAmounts(value.payouts);
  const losses = normalizeRankAmounts(value.losses);

  if (!participantCount || !winnerCount || !payouts || !losses) {
    return null;
  }

  if (participantCount !== 3 && participantCount !== 4) {
    return null;
  }

  if (winnerCount < 1 || winnerCount >= participantCount) {
    return null;
  }

  const penalties = Array.isArray(value.penalties)
    ? value.penalties
        .map(normalizePenalty)
        .filter((item): item is MatchStakesPenaltyConfig => item !== null)
    : undefined;

  return {
    participantCount,
    winnerCount,
    payouts,
    losses,
    penalties
  };
};

export const formatAmountVnd = (amountVnd: number) => amountFormatter.format(amountVnd);

export const formatRankAmountLine = (
  items: Array<{ relativeRank: number; amountVnd: number }>,
  kind: "payout" | "loss"
) =>
  items
    .slice()
    .sort((a, b) => a.relativeRank - b.relativeRank)
    .map((item) => `R${item.relativeRank} ${kind === "payout" ? "+" : "-"}${formatAmountVnd(item.amountVnd)}`)
    .join(", ");

export const formatPenaltyDestination = (type: MatchStakesPenaltyConfig["destinationSelectorType"]) => {
  if (type === "MATCH_WINNER") {
    return "match winner";
  }

  if (type === "FIXED_PLAYER") {
    return "fixed player";
  }

  if (type === "FUND_ACCOUNT") {
    return "fund account";
  }

  return "best participant";
};

export const formatPenaltyShort = (penalty: MatchStakesPenaltyConfig) =>
  `top${penalty.absolutePlacement} -${formatAmountVnd(penalty.amountVnd)}`;

export const summarizeMatchStakesBuilder = (config: MatchStakesBuilderConfig) => {
  const payouts = formatRankAmountLine(config.payouts, "payout");
  const losses = formatRankAmountLine(config.losses, "loss");
  const penalties = config.penalties?.length ? config.penalties.map(formatPenaltyShort).join(", ") : "None";

  return {
    headline: `${config.participantCount} players / ${config.winnerCount} winner${config.winnerCount > 1 ? "s" : ""}`,
    payouts,
    losses,
    penalties
  };
};
