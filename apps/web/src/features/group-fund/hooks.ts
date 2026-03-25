import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { groupFundApi } from "@/api/groupFundApi";
import { queryKeys } from "@/api/queryKeys";
import { invalidateAfterGroupFundTransaction } from "@/lib/invalidation";
import type { GroupFundTransactionQuery, ModuleLedgerQuery, ModuleSummaryQuery } from "@/types/api";

export const useGroupFundSummary = (query: ModuleSummaryQuery, enabled = true) =>
  useQuery({
    queryKey: queryKeys.groupFund.summary(query),
    queryFn: () => groupFundApi.summary(query),
    enabled
  });

export const useGroupFundLedger = (query: ModuleLedgerQuery) =>
  useQuery({
    queryKey: queryKeys.groupFund.ledger(query),
    queryFn: () => groupFundApi.ledger(query)
  });

export const useGroupFundMatches = (query: ModuleLedgerQuery & { ruleSetId?: string }) =>
  useQuery({
    queryKey: queryKeys.groupFund.matches(query),
    queryFn: () => groupFundApi.matches(query)
  });

export const useGroupFundTransactions = (query: GroupFundTransactionQuery) =>
  useQuery({
    queryKey: queryKeys.groupFund.transactions(query),
    queryFn: () => groupFundApi.transactions(query)
  });

export const useCreateGroupFundTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: groupFundApi.createTransaction,
    onSuccess: async () => {
      await invalidateAfterGroupFundTransaction(queryClient);
    }
  });
};
