import { useState } from "react";
import { Button, Card, Input, Switch, message } from "antd";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "react-router-dom";
import { useRuleSetVersionDetail, useUpdateRuleSetVersion } from "@/features/rules/hooks";
import { ruleSetVersionMetaSchema, parseJsonOrDefault, type RuleSetVersionMetaValues } from "@/features/rules/schemas";
import { PageLoading } from "@/components/states/PageLoading";
import { ErrorState } from "@/components/states/ErrorState";
import { FormApiError } from "@/components/common/FormApiError";
import { getErrorMessage } from "@/lib/error-messages";
import { toAppError } from "@/api/httpClient";

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
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Edit Version Metadata</h2>
      <Card>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            setApiError(null);
            try {
              await updateMutation.mutateAsync({
                isActive: values.isActive,
                effectiveTo: values.effectiveTo || null,
                summaryJson: parseJsonOrDefault(values.summaryJsonText, null) as Record<string, unknown> | null
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
            <label className="mb-1 block text-sm font-medium">Effective to (ISO or empty)</label>
            <Controller control={form.control} name="effectiveTo" render={({ field }) => <Input {...field} placeholder="2026-12-31T23:59:59Z" />} />
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
    </div>
  );
};
