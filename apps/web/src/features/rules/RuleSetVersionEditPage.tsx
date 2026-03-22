import { useState } from "react";
import { Alert, Button, Card, DatePicker, Input, Switch, message } from "antd";
import dayjs from "dayjs";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "react-router-dom";
import { useRuleSetVersionDetail, useUpdateRuleSetVersion } from "@/features/rules/hooks";
import { parseJsonOrDefault, ruleSetVersionMetaSchema, type RuleSetVersionMetaValues } from "@/features/rules/schemas";
import { FormApiError } from "@/components/common/FormApiError";
import { ErrorState } from "@/components/states/ErrorState";
import { PageLoading } from "@/components/states/PageLoading";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { getErrorMessage } from "@/lib/error-messages";
import { toAppError } from "@/api/httpClient";

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

export const RuleSetVersionEditPage = () => {
  const navigate = useNavigate();
  const { ruleSetId, versionId } = useParams();
  const [apiError, setApiError] = useState<string | null>(null);

  const detailQuery = useRuleSetVersionDetail(ruleSetId, versionId);
  const updateMutation = useUpdateRuleSetVersion(ruleSetId ?? "", versionId ?? "");

  const form = useForm<RuleSetVersionMetaValues>({
    resolver: zodResolver(ruleSetVersionMetaSchema),
    values: {
      isActive: detailQuery.data?.isActive ?? true,
      effectiveTo: detailQuery.data?.effectiveTo ?? "",
      summaryJsonText: detailQuery.data?.summaryJson ? JSON.stringify(detailQuery.data.summaryJson, null, 2) : ""
    }
  });

  if (!ruleSetId || !versionId) {
    return <ErrorState title="Missing params" />;
  }

  if (detailQuery.isLoading) {
    return <PageLoading label="Loading version..." />;
  }

  if (detailQuery.isError || !detailQuery.data) {
    return <ErrorState onRetry={() => void detailQuery.refetch()} />;
  }

  return (
    <PageContainer>
      <PageHeader title="Edit Version Metadata" subtitle={`v${detailQuery.data.versionNo} (${detailQuery.data.builderType || "RAW"})`} />

      <Alert
        showIcon
        type="info"
        message="Metadata-only update"
        description="This endpoint updates only version metadata (active flag, effective end time, summary JSON). Rule logic body is immutable."
      />

      <Card>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            setApiError(null);
            try {
              await updateMutation.mutateAsync({
                isActive: values.isActive,
                effectiveTo: values.effectiveTo || null,
                summaryJson: parseRecordJson(values.summaryJsonText)
              });
              message.success("Version metadata updated");
              navigate(`/rules/${ruleSetId}/versions/${versionId}`);
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

          <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>
            Save metadata
          </Button>
        </form>
      </Card>
    </PageContainer>
  );
};
