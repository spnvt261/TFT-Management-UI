import { apiGet, apiPatch, apiPost } from "@/api/httpClient";
import type {
  ConditionOperator,
  CreateRuleSetRequest,
  CreateRuleSetVersionRequest,
  DefaultRuleSetByModuleDto,
  ListRuleSetsQuery,
  MatchStakesBuilderConfig,
  ModuleType,
  RuleActionType,
  RuleBuilderType,
  RuleConditionKey,
  RuleInput,
  RuleStatus,
  RuleSetDetailDto,
  RuleSetDto,
  RuleSetVersionDetailDto,
  SelectorType,
  UpdateRuleSetRequest,
  UpdateRuleSetVersionRequest
} from "@/types/api";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toSummaryRecordOrNull = (value: unknown): Record<string, unknown> | null => {
  if (value === null || value === undefined) {
    return null;
  }

  return isRecord(value) ? value : null;
};

const toBuilderConfigOrNull = (
  value: unknown
): MatchStakesBuilderConfig | Record<string, unknown> | null => {
  if (value === null || value === undefined) {
    return null;
  }

  return isRecord(value) ? value : null;
};

const toRuleBuilderType = (value: string | null): RuleBuilderType | null =>
  value === "MATCH_STAKES_PAYOUT" ? value : null;

const toRuleInput = (rule: RuleSetVersionDetailDto["rules"][number]): RuleInput => ({
  code: rule.code,
  name: rule.name,
  description: rule.description,
  ruleKind: rule.ruleKind as RuleInput["ruleKind"],
  priority: rule.priority,
  status: rule.status as RuleStatus,
  stopProcessingOnMatch: rule.stopProcessingOnMatch,
  metadata: isRecord(rule.metadata) ? rule.metadata : null,
  conditions: rule.conditions.map((condition) => ({
    conditionKey: condition.conditionKey as RuleConditionKey,
    operator: condition.operator as ConditionOperator,
    valueJson: condition.valueJson,
    sortOrder: condition.sortOrder
  })),
  actions: rule.actions.map((action) => ({
    actionType: action.actionType as RuleActionType,
    amountVnd: action.amountVnd,
    sourceSelectorType: action.sourceSelectorType as SelectorType,
    sourceSelectorJson: action.sourceSelectorJson,
    destinationSelectorType: action.destinationSelectorType as SelectorType,
    destinationSelectorJson: action.destinationSelectorJson,
    descriptionTemplate: action.descriptionTemplate,
    sortOrder: action.sortOrder
  }))
});

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
  updateVersion: async (ruleSetId: string, versionId: string, payload: UpdateRuleSetVersionRequest) => {
    const detail = await rulesApi.detail(ruleSetId);
    const sourceVersion = findVersion(detail, versionId);
    const sourceBuilderType = toRuleBuilderType(sourceVersion.builderType);
    const updated = await rulesApi.update(ruleSetId, {
      description: sourceVersion.description,
      participantCountMin: sourceVersion.participantCountMin,
      participantCountMax: sourceVersion.participantCountMax,
      effectiveTo: payload.effectiveTo ?? sourceVersion.effectiveTo,
      isActive: payload.isActive ?? sourceVersion.isActive,
      summaryJson:
        payload.summaryJson === undefined
          ? toSummaryRecordOrNull(sourceVersion.summaryJson)
          : payload.summaryJson,
      builderType: sourceBuilderType,
      builderConfig: sourceBuilderType ? toBuilderConfigOrNull(sourceVersion.builderConfig) : null,
      rules: sourceBuilderType ? undefined : sourceVersion.rules.map(toRuleInput)
    });

    if (!updated.latestVersion) {
      throw new Error(`Cannot resolve latest version after updating metadata for version ${versionId}`);
    }

    return updated.latestVersion;
  },
  getDefaultByModule: async (module: ModuleType, participantCount?: 3 | 4) => {
    const response = await apiGet<DefaultRuleSetByModuleDto>(`/rule-sets/default/by-module/${module}`, {
      params: participantCount ? { participantCount } : undefined
    });

    return response.data;
  }
};
