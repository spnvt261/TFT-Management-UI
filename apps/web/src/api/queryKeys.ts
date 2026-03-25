import type { ModuleType } from "@/types/api";

export const queryKeys = {
  dashboard: {
    overview: ["dashboard", "overview"] as const
  },
  players: {
    list: (query: unknown) => ["players", "list", query] as const,
    detail: (playerId: string) => ["players", "detail", playerId] as const,
    activeOptions: ["players", "active-options"] as const
  },
  rules: {
    list: (query: unknown) => ["rules", "list", query] as const,
    detail: (ruleSetId: string) => ["rules", "detail", ruleSetId] as const,
    version: (ruleSetId: string, versionId: string) => ["rules", "version", ruleSetId, versionId] as const,
    defaultByModule: (module: ModuleType, participantCount?: number) =>
      ["rules", "default", module, participantCount ?? "none"] as const
  },
  matches: {
    detail: (matchId: string) => ["matches", "detail", matchId] as const,
    list: (query: unknown) => ["matches", "list", query] as const,
    preset: (module: ModuleType) => ["matches", "preset", module] as const
  },
  matchStakes: {
    summary: (query: unknown) => ["match-stakes", "summary", query] as const,
    ledger: (query: unknown) => ["match-stakes", "ledger", query] as const,
    matches: (query: unknown) => ["match-stakes", "matches", query] as const,
    currentPeriod: ["match-stakes", "debt-periods", "current"] as const,
    allPeriods: ["match-stakes", "debt-periods", "all"] as const,
    allPeriodsHistory: (query: unknown) => ["match-stakes", "debt-periods", "history", query] as const,
    periods: (query: unknown) => ["match-stakes", "debt-periods", "list", query] as const,
    periodDetail: (periodId: string) => ["match-stakes", "debt-periods", "detail", periodId] as const,
    periodTimeline: (periodId: string) => ["match-stakes", "debt-periods", "timeline", periodId] as const
  },
  groupFund: {
    summary: (query: unknown) => ["group-fund", "summary", query] as const,
    ledger: (query: unknown) => ["group-fund", "ledger", query] as const,
    matches: (query: unknown) => ["group-fund", "matches", query] as const,
    transactions: (query: unknown) => ["group-fund", "transactions", query] as const
  }
};
