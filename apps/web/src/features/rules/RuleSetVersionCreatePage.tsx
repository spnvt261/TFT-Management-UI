import { useState } from "react";
import { Button, Card, Input, InputNumber, Switch, message } from "antd";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "react-router-dom";
import { RuleBuilder } from "@/features/rules/RuleBuilder";
import { useCreateRuleSetVersion } from "@/features/rules/hooks";
import { FormApiError } from "@/components/common/FormApiError";
import { getErrorMessage } from "@/lib/error-messages";
import { parseJsonOrDefault, ruleSetVersionSchema, type RuleSetVersionValues } from "@/features/rules/schemas";
import { toAppError } from "@/api/httpClient";

export const RuleSetVersionCreatePage = () => {
  const navigate = useNavigate();
  const { ruleSetId } = useParams();
  const [apiError, setApiError] = useState<string | null>(null);

  const createMutation = useCreateRuleSetVersion(ruleSetId ?? "");

  const form = useForm<RuleSetVersionValues>({
    resolver: zodResolver(ruleSetVersionSchema),
    defaultValues: {
      participantCountMin: 3,
      participantCountMax: 4,
      effectiveTo: "",
      isActive: true,
      summaryJsonText: "",
      rules: [
        {
          code: "",
          name: "",
          description: "",
          ruleKind: "CUSTOM",
          priority: 100,
          status: "ACTIVE",
          stopProcessingOnMatch: false,
          metadataText: "",
          conditions: [{ conditionKey: "participantCount", operator: "EQ", valueJsonText: "", sortOrder: 1 }],
          actions: [
            {
              actionType: "TRANSFER",
              amountVnd: 1000,
              sourceSelectorType: "SUBJECT_PLAYER",
              sourceSelectorJsonText: "",
              destinationSelectorType: "MATCH_WINNER",
              destinationSelectorJsonText: "",
              descriptionTemplate: "",
              sortOrder: 1
            }
          ]
        }
      ]
    }
  });

  if (!ruleSetId) {
    return <div>Missing rule set id</div>;
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setApiError(null);
    try {
      const created = await createMutation.mutateAsync({
        participantCountMin: values.participantCountMin,
        participantCountMax: values.participantCountMax,
        effectiveTo: values.effectiveTo || null,
        isActive: values.isActive,
        summaryJson: parseJsonOrDefault(values.summaryJsonText, null) as Record<string, unknown> | null,
        rules: values.rules.map((rule) => ({
          code: rule.code,
          name: rule.name,
          description: rule.description || null,
          ruleKind: rule.ruleKind,
          priority: rule.priority,
          status: rule.status,
          stopProcessingOnMatch: rule.stopProcessingOnMatch,
          metadata: parseJsonOrDefault(rule.metadataText, null) as Record<string, unknown> | null,
          conditions: rule.conditions.map((condition) => ({
            conditionKey: condition.conditionKey,
            operator: condition.operator,
            valueJson: parseJsonOrDefault(condition.valueJsonText),
            sortOrder: condition.sortOrder
          })),
          actions: rule.actions.map((action) => ({
            actionType: action.actionType,
            amountVnd: action.amountVnd,
            sourceSelectorType: action.sourceSelectorType,
            sourceSelectorJson: parseJsonOrDefault(action.sourceSelectorJsonText),
            destinationSelectorType: action.destinationSelectorType,
            destinationSelectorJson: parseJsonOrDefault(action.destinationSelectorJsonText),
            descriptionTemplate: action.descriptionTemplate || null,
            sortOrder: action.sortOrder
          }))
        }))
      });

      message.success("Version created");
      navigate(`/rules/${ruleSetId}/versions/${created.id}`);
    } catch (error) {
      setApiError(getErrorMessage(toAppError(error)));
    }
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Create Rule Set Version</h2>

      <FormProvider {...form}>
        <form className="space-y-4" onSubmit={onSubmit}>
          <FormApiError message={apiError} />

          <Card>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Participant min</label>
                <Controller
                  control={form.control}
                  name="participantCountMin"
                  render={({ field }) => (
                    <InputNumber min={2} max={8} value={field.value} onChange={(value) => field.onChange(value ?? 2)} className="w-full" />
                  )}
                />
                {form.formState.errors.participantCountMin ? (
                  <div className="mt-1 text-xs text-red-600">{form.formState.errors.participantCountMin.message}</div>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Participant max</label>
                <Controller
                  control={form.control}
                  name="participantCountMax"
                  render={({ field }) => (
                    <InputNumber min={2} max={8} value={field.value} onChange={(value) => field.onChange(value ?? 8)} className="w-full" />
                  )}
                />
                {form.formState.errors.participantCountMax ? (
                  <div className="mt-1 text-xs text-red-600">{form.formState.errors.participantCountMax.message}</div>
                ) : null}
              </div>
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-sm font-medium">Effective to (ISO optional)</label>
              <Controller control={form.control} name="effectiveTo" render={({ field }) => <Input {...field} placeholder="2026-12-31T23:59:59Z" />} />
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-sm font-medium">Summary JSON (optional)</label>
              <Controller control={form.control} name="summaryJsonText" render={({ field }) => <Input.TextArea {...field} rows={3} />} />
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <span className="text-sm font-medium">Active</span>
              <Controller control={form.control} name="isActive" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} />} />
            </div>
          </Card>

          <RuleBuilder />

          <Button htmlType="submit" type="primary" size="large" loading={createMutation.isPending}>
            Create Version
          </Button>
        </form>
      </FormProvider>
    </div>
  );
};
