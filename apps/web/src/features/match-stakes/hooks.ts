import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/api/queryKeys";
import { matchStakesApi } from "@/api/matchStakesApi";
import type { ModuleLedgerQuery, ModuleSummaryQuery } from "@/types/api";

export const useMatchStakesSummary = (query: ModuleSummaryQuery) =>
  useQuery({
    queryKey: queryKeys.matchStakes.summary(query),
    queryFn: () => matchStakesApi.summary(query)
  });

export const useMatchStakesLedger = (query: ModuleLedgerQuery) =>
  useQuery({
    queryKey: queryKeys.matchStakes.ledger(query),
    queryFn: () => matchStakesApi.ledger(query)
  });

export const useMatchStakesMatches = (query: ModuleLedgerQuery & { ruleSetId?: string }) =>
  useQuery({
    queryKey: queryKeys.matchStakes.matches(query),
    queryFn: () => matchStakesApi.matches(query)
  });
