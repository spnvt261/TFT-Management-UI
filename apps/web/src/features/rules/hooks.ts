import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rulesApi } from "@/api/rulesApi";
import { queryKeys } from "@/api/queryKeys";
import { invalidateAfterRuleMutation } from "@/lib/invalidation";
import type { CreateRuleSetRequest, CreateRuleSetVersionRequest, ListRuleSetsQuery, UpdateRuleSetRequest, UpdateRuleSetVersionRequest } from "@/types/api";

export const useRuleSets = (query: ListRuleSetsQuery) =>
  useQuery({
    queryKey: queryKeys.rules.list(query),
    queryFn: () => rulesApi.list(query)
  });

export const useAllRuleSets = () =>
  useQuery({
    queryKey: queryKeys.rules.list({ scope: "all" }),
    queryFn: async () => {
      const requestPageSize = 100;
      const firstPage = await rulesApi.list({ page: 1, pageSize: requestPageSize });
      const totalPages = firstPage.meta?.totalPages ?? 1;
      const items = [...firstPage.data];

      if (totalPages <= 1) {
        return items;
      }

      const restPages = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) =>
          rulesApi.list({ page: index + 2, pageSize: requestPageSize })
        )
      );

      for (const page of restPages) {
        items.push(...page.data);
      }

      return items;
    }
  });

export const useRuleSetDetail = (ruleSetId?: string) =>
  useQuery({
    queryKey: queryKeys.rules.detail(ruleSetId ?? ""),
    queryFn: () => rulesApi.detail(ruleSetId!),
    enabled: Boolean(ruleSetId)
  });

export const useRuleSetVersionDetail = (ruleSetId?: string, versionId?: string) =>
  useQuery({
    queryKey: queryKeys.rules.version(ruleSetId ?? "", versionId ?? ""),
    queryFn: () => rulesApi.getVersion(ruleSetId!, versionId!),
    enabled: Boolean(ruleSetId && versionId)
  });

export const useCreateRuleSet = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateRuleSetRequest) => rulesApi.create(payload),
    onSuccess: async () => {
      await invalidateAfterRuleMutation(queryClient);
    }
  });
};

export const useUpdateRuleSet = (ruleSetId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateRuleSetRequest) => rulesApi.update(ruleSetId, payload),
    onSuccess: async () => {
      await invalidateAfterRuleMutation(queryClient);
      await queryClient.invalidateQueries({ queryKey: queryKeys.rules.detail(ruleSetId) });
    }
  });
};

export const useCreateRuleSetVersion = (ruleSetId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateRuleSetVersionRequest) => rulesApi.createVersion(ruleSetId, payload),
    onSuccess: async () => {
      await invalidateAfterRuleMutation(queryClient);
      await queryClient.invalidateQueries({ queryKey: queryKeys.rules.detail(ruleSetId) });
    }
  });
};

export const useCreateRuleSetVersionById = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ruleSetId, payload }: { ruleSetId: string; payload: CreateRuleSetVersionRequest }) =>
      rulesApi.createVersion(ruleSetId, payload),
    onSuccess: async (_, variables) => {
      await invalidateAfterRuleMutation(queryClient);
      await queryClient.invalidateQueries({ queryKey: queryKeys.rules.detail(variables.ruleSetId) });
    }
  });
};

export const useUpdateRuleSetVersion = (ruleSetId: string, versionId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateRuleSetVersionRequest) => rulesApi.updateVersion(ruleSetId, versionId, payload),
    onSuccess: async () => {
      await invalidateAfterRuleMutation(queryClient);
      await queryClient.invalidateQueries({ queryKey: queryKeys.rules.version(ruleSetId, versionId) });
    }
  });
};
