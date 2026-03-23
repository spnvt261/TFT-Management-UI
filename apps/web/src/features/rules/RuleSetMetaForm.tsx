import { useEffect, useState } from "react";
import { Button, Input, Select, Switch } from "antd";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toAppError } from "@/api/httpClient";
import { FormApiError } from "@/components/common/FormApiError";
import { SectionCard } from "@/components/layout/SectionCard";
import { RuleFormFooter } from "@/features/rules/create-flow/components";
import {
  ruleSetMetaSchema,
  type RuleSetMetaValues
} from "@/features/rules/schemas";
import { getErrorMessage } from "@/lib/error-messages";
import { moduleLabels } from "@/lib/labels";
import type { ModuleType, RuleSetDto } from "@/types/api";

interface RuleSetMetaFormProps {
  initial?: RuleSetDto;
  initialModule?: ModuleType;
  lockModule?: boolean;
  submitLabel: string;
  submitting?: boolean;
  onCancel?: () => void;
  cancelLabel?: string;
  onSubmit: (values: RuleSetMetaValues) => Promise<void>;
}

export const RuleSetMetaForm = ({
  initial,
  initialModule,
  lockModule,
  submitLabel,
  submitting,
  onCancel,
  cancelLabel,
  onSubmit
}: RuleSetMetaFormProps) => {
  const [apiError, setApiError] = useState<string | null>(null);
  const isModuleLocked = Boolean(initial) || Boolean(lockModule);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors }
  } = useForm<RuleSetMetaValues>({
    resolver: zodResolver(ruleSetMetaSchema),
    defaultValues: {
      module: initial?.module ?? initialModule ?? "MATCH_STAKES",
      code: initial?.code ?? "",
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      status: initial?.status ?? "ACTIVE",
      isDefault: initial?.isDefault ?? false
    }
  });

  useEffect(() => {
    if (!initial) {
      return;
    }

    reset({
      module: initial.module,
      code: initial.code,
      name: initial.name,
      description: initial.description ?? "",
      status: initial.status,
      isDefault: initial.isDefault
    });
  }, [initial, reset]);

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit(async (values) => {
        setApiError(null);
        try {
          await onSubmit(values);
        } catch (error) {
          const appError = toAppError(error);
          if (appError.code === "RULE_SET_DUPLICATE") {
            setError("code", { message: "Code already exists" });
            return;
          }

          setApiError(getErrorMessage(appError));
        }
      })}
    >
      <FormApiError message={apiError} />

      <SectionCard
        title="Basic Info"
        description="Business metadata for this rule set"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Module</label>
            {isModuleLocked ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                {moduleLabels[
                  initial?.module ?? initialModule ?? "MATCH_STAKES"
                ]}
              </div>
            ) : (
              <Controller
                control={control}
                name="module"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { label: "Match Stakes", value: "MATCH_STAKES" },
                      { label: "Group Fund", value: "GROUP_FUND" }
                    ]}
                    size="large"
                  />
                )}
              />
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Status</label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { label: "Active", value: "ACTIVE" },
                    { label: "Inactive", value: "INACTIVE" }
                  ]}
                  size="large"
                />
              )}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Code</label>
            <Controller
              control={control}
              name="code"
              render={({ field }) => (
                <Input
                  {...field}
                  size="large"
                  disabled={Boolean(initial)}
                  status={errors.code ? "error" : ""}
                />
              )}
            />
            {errors.code ? (
              <div className="mt-1 text-xs text-red-600">{errors.code.message}</div>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <Input
                  {...field}
                  size="large"
                  status={errors.name ? "error" : ""}
                />
              )}
            />
            {errors.name ? (
              <div className="mt-1 text-xs text-red-600">{errors.name.message}</div>
            ) : null}
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium">Description</label>
          <Controller
            control={control}
            name="description"
            render={({ field }) => <Input.TextArea {...field} rows={4} />}
          />
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 p-3">
          <span className="text-sm font-medium">Default rule set for module</span>
          <Controller
            control={control}
            name="isDefault"
            render={({ field }) => (
              <Switch checked={field.value} onChange={field.onChange} />
            )}
          />
        </div>
      </SectionCard>

      {onCancel ? (
        <SectionCard bodyClassName="py-4">
          <RuleFormFooter
            onCancel={onCancel}
            cancelLabel={cancelLabel}
            submitLabel={submitLabel}
            submitLoading={submitting}
          />
        </SectionCard>
      ) : (
        <Button htmlType="submit" type="primary" loading={submitting}>
          {submitLabel}
        </Button>
      )}
    </form>
  );
};
