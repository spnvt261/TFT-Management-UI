import { apiGet, apiPatch, apiPost } from "@/api/httpClient";
import type {
  CreateRuleSetRequest,
  CreateRuleSetVersionRequest,
  DefaultRuleSetByModuleDto,
  ListRuleSetsQuery,
  ModuleType,
  RuleSetDetailDto,
  RuleSetDto,
  RuleSetVersionDetailDto,
  UpdateRuleSetRequest,
  UpdateRuleSetVersionRequest
} from "@/types/api";

export const rulesApi = {
  list: async (query: ListRuleSetsQuery) => apiGet<RuleSetDto[]>("/rule-sets", { params: query }),
  create: async (payload: CreateRuleSetRequest) => {
    const response = await apiPost<RuleSetDto, CreateRuleSetRequest>("/rule-sets", payload);
    return response.data;
  },
  detail: async (ruleSetId: string) => {
    const response = await apiGet<RuleSetDetailDto>(`/rule-sets/${ruleSetId}`);
    return response.data;
  },
  update: async (ruleSetId: string, payload: UpdateRuleSetRequest) => {
    const response = await apiPatch<RuleSetDto, UpdateRuleSetRequest>(`/rule-sets/${ruleSetId}`, payload);
    return response.data;
  },
  createVersion: async (ruleSetId: string, payload: CreateRuleSetVersionRequest) => {
    const response = await apiPost<RuleSetVersionDetailDto, CreateRuleSetVersionRequest>(
      `/rule-sets/${ruleSetId}/versions`,
      payload
    );
    return response.data;
  },
  getVersion: async (ruleSetId: string, versionId: string) => {
    const response = await apiGet<RuleSetVersionDetailDto>(`/rule-sets/${ruleSetId}/versions/${versionId}`);
    return response.data;
  },
  updateVersion: async (ruleSetId: string, versionId: string, payload: UpdateRuleSetVersionRequest) => {
    const response = await apiPatch<RuleSetVersionDetailDto, UpdateRuleSetVersionRequest>(
      `/rule-sets/${ruleSetId}/versions/${versionId}`,
      payload
    );
    return response.data;
  },
  getDefaultByModule: async (module: ModuleType, participantCount?: 3 | 4) => {
    const response = await apiGet<DefaultRuleSetByModuleDto>(`/rule-sets/default/by-module/${module}`, {
      params: participantCount ? { participantCount } : undefined
    });

    return response.data;
  }
};
