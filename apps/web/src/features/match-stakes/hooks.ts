import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/api/queryKeys";
import { toAppError } from "@/api/httpClient";
import { matchStakesApi } from "@/api/matchStakesApi";
import type {
  CloseDebtPeriodRequest,
  CreateDebtSettlementRequest,
  ListDebtPeriodsQuery,
  MatchStakesMatchesQuery,
  ModuleLedgerQuery,
  ModuleSummaryQuery
} from "@/types/api";

const invalidateMatchStakesQueries = async (queryClient: QueryClient) => {
  await queryClient.invalidateQueries({ queryKey: ["match-stakes"] });
};

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

export const useMatchStakesMatches = (query: MatchStakesMatchesQuery, enabled = true) =>
  useQuery({
    queryKey: queryKeys.matchStakes.matches(query),
    queryFn: () => matchStakesApi.matches(query),
    enabled
  });

export const useCurrentDebtPeriod = () =>
  useQuery({
    queryKey: queryKeys.matchStakes.currentPeriod,
    queryFn: async () => {
      try {
        return await matchStakesApi.currentPeriod();
      } catch (error) {
        const appError = toAppError(error);
        if (appError.code === "DEBT_PERIOD_NOT_FOUND") {
          return null;
        }

        throw error;
      }
    }
  });

export const useDebtPeriodDetail = (periodId?: string) =>
  useQuery({
    queryKey: queryKeys.matchStakes.periodDetail(periodId ?? ""),
    queryFn: () => matchStakesApi.periodDetail(periodId!),
    enabled: Boolean(periodId)
  });

export const useDebtPeriods = (query: ListDebtPeriodsQuery) =>
  useQuery({
    queryKey: queryKeys.matchStakes.periods(query),
    queryFn: () => matchStakesApi.periods(query)
  });

export const useCreateDebtPeriod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: matchStakesApi.createPeriod,
    onSuccess: async () => {
      await invalidateMatchStakesQueries(queryClient);
    }
  });
};

export const useCreateDebtSettlement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ periodId, payload }: { periodId: string; payload: CreateDebtSettlementRequest }) =>
      matchStakesApi.createSettlement(periodId, payload),
    onSuccess: async (_, variables) => {
      await invalidateMatchStakesQueries(queryClient);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.matchStakes.periodDetail(variables.periodId)
      });
    }
  });
};

export const useCloseDebtPeriod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ periodId, payload }: { periodId: string; payload: CloseDebtPeriodRequest }) =>
      matchStakesApi.closePeriod(periodId, payload),
    onSuccess: async (_, variables) => {
      await invalidateMatchStakesQueries(queryClient);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.matchStakes.periodDetail(variables.periodId)
      });
    }
  });
};
