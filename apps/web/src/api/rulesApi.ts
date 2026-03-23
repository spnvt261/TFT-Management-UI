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
  UpdateRuleSetRequest
} from "@/types/api";

const findVersion = (detail: RuleSetDetailDto, versionId: string) => {
  const version = detail.versions.find((item) => item.id === versionId);
  if (!version) {
    throw new Error(`Rule version ${versionId} not found in rule set ${detail.id}`);
  }

  return version;
};

export const rulesApi = {
  list: async (query: ListRuleSetsQuery) => apiGet<RuleSetDto[]>("/rule-sets", { params: query }),
  create: async (payload: CreateRuleSetRequest) => {
    const response = await apiPost<RuleSetDetailDto, CreateRuleSetRequest>("/rule-sets", payload);
    return response.data;
  },
  detail: async (ruleSetId: string) => {
    const response = await apiGet<RuleSetDetailDto>(`/rule-sets/${ruleSetId}`);
    return response.data;
  },
  update: async (ruleSetId: string, payload: UpdateRuleSetRequest) => {
    const response = await apiPatch<RuleSetDetailDto, UpdateRuleSetRequest>(`/rule-sets/${ruleSetId}`, payload);
    return response.data;
  },
  createVersion: async (ruleSetId: string, payload: CreateRuleSetVersionRequest) => {
    const detail = await rulesApi.detail(ruleSetId);
    const isBuilderMode = Boolean(payload.builderType);
    const updated = await rulesApi.update(ruleSetId, {
      description: detail.latestVersion?.description ?? detail.description ?? null,
      participantCountMin: payload.participantCountMin,
      participantCountMax: payload.participantCountMax,
      effectiveTo: payload.effectiveTo ?? null,
      isActive: payload.isActive,
      summaryJson: payload.summaryJson ?? null,
      builderType: isBuilderMode ? payload.builderType ?? null : null,
      builderConfig: isBuilderMode ? payload.builderConfig ?? null : null,
      rules: isBuilderMode ? undefined : payload.rules
    });

    if (!updated.latestVersion) {
      throw new Error(`Cannot resolve latest version after creating version for rule set ${ruleSetId}`);
    }

    return updated.latestVersion;
  },
  getVersion: async (ruleSetId: string, versionId: string) => {
    const detail = await rulesApi.detail(ruleSetId);
    return findVersion(detail, versionId);
  },
  getDefaultByModule: async (module: ModuleType, participantCount?: 3 | 4) => {
    const response = await apiGet<DefaultRuleSetByModuleDto>(`/rule-sets/default/by-module/${module}`, {
      params: participantCount ? { participantCount } : undefined
    });

    return response.data;
  }
};
