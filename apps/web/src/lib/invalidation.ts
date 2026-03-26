import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/api/queryKeys";
import type { ModuleType } from "@/types/api";

export const invalidateAfterMatchCreate = async (queryClient: QueryClient, module: ModuleType) => {
  if (module === "MATCH_STAKES") {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["match-stakes", "summary"] }),
      queryClient.invalidateQueries({ queryKey: ["match-stakes", "ledger"] }),
      queryClient.invalidateQueries({ queryKey: ["match-stakes", "matches"] }),
      queryClient.invalidateQueries({ queryKey: ["match-stakes", "debt-periods"] })
    ]);
  }

  if (module === "GROUP_FUND") {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["group-fund", "summary"] }),
      queryClient.invalidateQueries({ queryKey: ["group-fund", "ledger"] }),
      queryClient.invalidateQueries({ queryKey: ["group-fund", "matches"] })
    ]);
  }

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.overview }),
    queryClient.invalidateQueries({ queryKey: queryKeys.matches.preset(module) })
  ]);
};

export const invalidateAfterPlayerMutation = async (queryClient: QueryClient) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["players", "list"] }),
    queryClient.invalidateQueries({ queryKey: queryKeys.players.activeOptions }),
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.overview })
  ]);
};

export const invalidateAfterRuleMutation = async (queryClient: QueryClient) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["rules", "list"] }),
    queryClient.invalidateQueries({ queryKey: ["rules", "detail"] }),
    queryClient.invalidateQueries({ queryKey: ["rules", "version"] }),
    queryClient.invalidateQueries({ queryKey: ["rules", "default"] })
  ]);
};

export const invalidateAfterGroupFundTransaction = async (queryClient: QueryClient) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["group-fund", "summary"] }),
    queryClient.invalidateQueries({ queryKey: ["group-fund", "ledger"] }),
    queryClient.invalidateQueries({ queryKey: ["group-fund", "transactions"] }),
    queryClient.invalidateQueries({ queryKey: ["group-fund", "withdrawals"] }),
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.overview })
  ]);
};

export const invalidateAfterMatchVoid = async (queryClient: QueryClient) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["matches", "detail"] }),
    queryClient.invalidateQueries({ queryKey: ["match-stakes"] }),
    queryClient.invalidateQueries({ queryKey: ["group-fund"] }),
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.overview })
  ]);
};
