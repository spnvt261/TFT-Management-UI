import { useState } from "react";
import { Alert, Button, Card, DatePicker, Input, Switch, message } from "antd";
import dayjs from "dayjs";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "react-router-dom";
import {
  useRuleSetDetail,
  useRuleSetVersionDetail,
  useUpdateRuleSet
} from "@/features/rules/hooks";
import { RulesBreadcrumb } from "@/features/rules/components";
import { parseJsonOrDefault, ruleSetVersionMetaSchema, type RuleSetVersionMetaValues } from "@/features/rules/schemas";
import { FormApiError } from "@/components/common/FormApiError";
import { ErrorState } from "@/components/states/ErrorState";
import { PageLoading } from "@/components/states/PageLoading";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { getErrorMessage } from "@/lib/error-messages";
import { toAppError } from "@/api/httpClient";
import type {
  ConditionOperator,
  MatchStakesBuilderConfig,
  RuleActionType,
  RuleBuilderType,
  RuleConditionKey,
  RuleInput,
  RuleSetVersionDetailDto,
  RuleStatus,
  SelectorType
} from "@/types/api";

const parseRecordJson = (value?: string | null): Record<string, unknown> | null => {
  if (!value) {
    return null;
  }

  const parsed = parseJsonOrDefault(value, null);
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }

  return null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toRuleBuilderType = (value: string | null): RuleBuilderType | null =>
  value === "MATCH_STAKES_PAYOUT" ? value : null;

const toBuilderConfigOrNull = (
  value: unknown
): MatchStakesBuilderConfig | Record<string, unknown> | null => {
  if (value === null || value === undefined) {
    return null;
  }

  return isRecord(value) ? value : null;
};

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

const stringifyStable = (value: unknown) => JSON.stringify(value ?? null);

export const RuleSetVersionEditPage = () => {
  const navigate = useNavigate();
  const { ruleSetId, versionId } = useParams();
  const [apiError, setApiError] = useState<string | null>(null);

  const detailQuery = useRuleSetVersionDetail(ruleSetId, versionId);
  const ruleSetQuery = useRuleSetDetail(ruleSetId);
  const updateMutation = useUpdateRuleSet(ruleSetId ?? "");

  const form = useForm<RuleSetVersionMetaValues>({
    resolver: zodResolver(ruleSetVersionMetaSchema),
    values: {
      isActive: detailQuery.data?.isActive ?? true,
      effectiveTo: detailQuery.data?.effectiveTo ?? "",
      summaryJsonText: detailQuery.data?.summaryJson ? JSON.stringify(detailQuery.data.summaryJson, null, 2) : ""
    }
  });
  const watchedIsActive = useWatch({ control: form.control, name: "isActive" });
  const watchedEffectiveTo = useWatch({ control: form.control, name: "effectiveTo" });
  const watchedSummaryJsonText = useWatch({ control: form.control, name: "summaryJsonText" });

  if (!ruleSetId || !versionId) {
    return <ErrorState title="Missing params" />;
  }

  if (detailQuery.isLoading || ruleSetQuery.isLoading) {
    return <PageLoading label="Loading version..." />;
  }

  if (detailQuery.isError || !detailQuery.data || ruleSetQuery.isError || !ruleSetQuery.data) {
    return (
      <ErrorState
        onRetry={() => {
          void detailQuery.refetch();
          void ruleSetQuery.refetch();
        }}
      />
    );
  }

  const initialEffectiveTo = detailQuery.data.effectiveTo ?? "";
  const initialSummaryJson = detailQuery.data.summaryJson
    ? stringifyStable(detailQuery.data.summaryJson)
    : stringifyStable(null);
  const currentSummaryJson = stringifyStable(parseRecordJson(watchedSummaryJsonText));
  const hasChanges =
    watchedIsActive !== detailQuery.data.isActive ||
    (watchedEffectiveTo ?? "") !== initialEffectiveTo ||
    currentSummaryJson !== initialSummaryJson;

  return (
    <PageContainer>
      <RulesBreadcrumb
        items={[
          { label: "Rules", to: "/rules" },
          { label: ruleSetQuery.data.name, to: `/rules/${ruleSetId}` },
          { label: `Version v${detailQuery.data.versionNo}`, to: `/rules/${ruleSetId}/versions/${versionId}` },
          { label: "Edit Metadata" }
        ]}
      />

      <PageHeader title="Edit Version Metadata" subtitle={`v${detailQuery.data.versionNo} (${detailQuery.data.builderType || "RAW"})`} />

      <Alert
        showIcon
        type="info"
        message="Save as a new version"
        description="This action keeps previous versions immutable and creates a new version with updated metadata."
      />

      <Card>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            setApiError(null);
            try {
              const sourceVersion = detailQuery.data;
              const sourceBuilderType = toRuleBuilderType(sourceVersion.builderType);
              const updatedRuleSet = await updateMutation.mutateAsync({
                name: ruleSetQuery.data.name,
                status: ruleSetQuery.data.status,
                isDefault: ruleSetQuery.data.isDefault,
                description: sourceVersion.description ?? ruleSetQuery.data.description ?? null,
                participantCountMin: sourceVersion.participantCountMin,
                participantCountMax: sourceVersion.participantCountMax,
                effectiveTo: values.effectiveTo || null,
                isActive: values.isActive,
                summaryJson: parseRecordJson(values.summaryJsonText),
                builderType: sourceBuilderType,
                builderConfig: sourceBuilderType
                  ? toBuilderConfigOrNull(sourceVersion.builderConfig)
                  : null,
                rules: sourceBuilderType ? undefined : sourceVersion.rules.map(toRuleInput)
              });
              const latestVersionId = updatedRuleSet.latestVersion?.id;
              message.success("Saved. New version created.");
              if (latestVersionId) {
                navigate(`/rules/${ruleSetId}/versions/${latestVersionId}`);
                return;
              }

              navigate(`/rules/${ruleSetId}`);
            } catch (error) {
              setApiError(getErrorMessage(toAppError(error)));
            }
          })}
        >
          <FormApiError message={apiError} />

          <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
            <span className="text-sm font-medium">Version active</span>
            <Controller control={form.control} name="isActive" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} />} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Effective to (optional)</label>
            <Controller
              control={form.control}
              name="effectiveTo"
              render={({ field }) => (
                <DatePicker
                  className="w-full"
                  showTime
                  value={field.value ? dayjs(field.value) : null}
                  onChange={(value) => field.onChange(value ? value.toISOString() : "")}
                />
              )}
            />
            {form.formState.errors.effectiveTo ? <div className="mt-1 text-xs text-red-600">{form.formState.errors.effectiveTo.message}</div> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Summary JSON</label>
            <Controller control={form.control} name="summaryJsonText" render={({ field }) => <Input.TextArea {...field} rows={6} />} />
            {form.formState.errors.summaryJsonText ? (
              <div className="mt-1 text-xs text-red-600">{form.formState.errors.summaryJsonText.message}</div>
            ) : null}
          </div>

          <Button
            type="primary"
            htmlType="submit"
            loading={updateMutation.isPending}
            disabled={!hasChanges}
          >
            Save
          </Button>
        </form>
      </Card>
    </PageContainer>
  );
};
