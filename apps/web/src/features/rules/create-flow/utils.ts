import { formatAmountVnd } from "@/features/rules/builder-utils";

export interface RankAmount {
  relativeRank: number;
  amountVnd: number;
}

export const winnerOptionsByParticipant = {
  3: [
    { label: "1 winner (common)", value: 1 },
    { label: "2 winners", value: 2 }
  ],
  4: [
    { label: "1 winner", value: 1 },
    { label: "2 winners (common)", value: 2 },
    { label: "3 winners", value: 3 }
  ]
} as const;

export const defaultWinnerCount = (participantCount: 3 | 4) => (participantCount === 3 ? 1 : 2);

export const buildRankAmounts = (
  start: number,
  end: number,
  existing: RankAmount[]
): RankAmount[] => {
  const existingMap = new Map(existing.map((item) => [item.relativeRank, item.amountVnd]));
  const rows: RankAmount[] = [];

  for (let rank = start; rank <= end; rank += 1) {
    rows.push({
      relativeRank: rank,
      amountVnd: existingMap.get(rank) ?? 0
    });
  }

  return rows;
};

export const sameRankAmounts = (left: RankAmount[], right: RankAmount[]) =>
  left.length === right.length &&
  left.every((item, index) => item.relativeRank === right[index]?.relativeRank && item.amountVnd === right[index]?.amountVnd);

export const sumAmounts = (items: RankAmount[]) => items.reduce((sum, item) => sum + item.amountVnd, 0);

export const computeTopWinnerPayout = (losses: RankAmount[], winnerPayouts: RankAmount[]) =>
  sumAmounts(losses) - sumAmounts(winnerPayouts);

export const formatRankAmountList = (items: RankAmount[], sign: "+" | "-") =>
  items.map((item) => `R${item.relativeRank} ${sign}${formatAmountVnd(item.amountVnd)}`).join(" | ");

const normalizeCodeBase = (value: string) => {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 36);

  return normalized || "RULE";
};

export const buildAutoRuleCode = (modulePrefix: "MS" | "GF", name: string) => {
  const codeBase = normalizeCodeBase(name);
  const suffix = Date.now().toString().slice(-6);
  return `${modulePrefix}_${codeBase}_${suffix}`.slice(0, 80);
};
