import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { groupFundApi } from "@/api/groupFundApi";
import { queryKeys } from "@/api/queryKeys";
import { invalidateAfterGroupFundTransaction } from "@/lib/invalidation";
import type {
  CreateGroupFundAdvanceRequest,
  CreateGroupFundContributionRequest,
  CreateGroupFundWithdrawalRequest,
  GroupFundHistoryQuery,
  GroupFundTransactionQuery,
  ModuleLedgerQuery,
  ModuleSummaryQuery
} from "@/types/api";

export const useGroupFundSummary = (query: ModuleSummaryQuery, enabled = true) =>
  useQuery({
    queryKey: queryKeys.groupFund.summary(query),
    queryFn: () => groupFundApi.summary(query),
    enabled
  });

export const useGroupFundLedger = (query: ModuleLedgerQuery, enabled = true) =>
  useQuery({
    queryKey: queryKeys.groupFund.ledger(query),
    queryFn: () => groupFundApi.ledger(query),
    enabled
  });

export const useGroupFundMatches = (query: ModuleLedgerQuery & { ruleSetId?: string }, enabled = true) =>
  useQuery({
    queryKey: queryKeys.groupFund.matches(query),
    queryFn: () => groupFundApi.matches(query),
    enabled
  });

export const useGroupFundTransactions = (query: GroupFundTransactionQuery, enabled = true) =>
  useQuery({
    queryKey: queryKeys.groupFund.transactions(query),
    queryFn: () => groupFundApi.transactions(query),
    enabled
  });

export const useGroupFundWithdrawals = (query: Omit<GroupFundTransactionQuery, "transactionType">, enabled = true) =>
  useQuery({
    queryKey: queryKeys.groupFund.withdrawals(query),
    queryFn: () => groupFundApi.withdrawals(query),
    enabled
  });

export const useGroupFundHistory = (query: GroupFundHistoryQuery, enabled = true) =>
  useQuery({
    queryKey: queryKeys.groupFund.history(query),
    queryFn: () => groupFundApi.history(query),
    enabled
  });

export const useCreateGroupFundContribution = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateGroupFundContributionRequest) => groupFundApi.createContribution(payload),
    onSuccess: async () => {
      await invalidateAfterGroupFundTransaction(queryClient);
    }
  });
};

export const useCreateGroupFundWithdrawal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateGroupFundWithdrawalRequest) => groupFundApi.createWithdrawal(payload),
    onSuccess: async () => {
      await invalidateAfterGroupFundTransaction(queryClient);
    }
  });
};

export const useCreateGroupFundTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: groupFundApi.createTransaction,
    onSuccess: async () => {
      await invalidateAfterGroupFundTransaction(queryClient);
    }
  });
};

export const useCreateGroupFundAdvance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateGroupFundAdvanceRequest) => groupFundApi.createFundAdvance(payload),
    onSuccess: async () => {
      await invalidateAfterGroupFundTransaction(queryClient);
    }
  });
};
