import { useEffect, useState } from "react";
import { Button, Card, Input, Select, Switch } from "antd";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ModuleType } from "@/types/api";
import type { RuleSetDto } from "@/types/api";
import { ruleSetMetaSchema, type RuleSetMetaValues } from "@/features/rules/schemas";
import { FormApiError } from "@/components/common/FormApiError";
import { toAppError } from "@/api/httpClient";
import { getErrorMessage } from "@/lib/error-messages";

interface RuleSetMetaFormProps {
  initial?: RuleSetDto;
  initialModule?: ModuleType;
  lockModule?: boolean;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (values: RuleSetMetaValues) => Promise<void>;
}

export const RuleSetMetaForm = ({ initial, initialModule, lockModule, submitLabel, submitting, onSubmit }: RuleSetMetaFormProps) => {
  const [apiError, setApiError] = useState<string | null>(null);
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
    <Card>
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Module</label>
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
                  disabled={Boolean(initial) || Boolean(lockModule)}
                />
              )}
            />
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

        <div>
          <label className="mb-1 block text-sm font-medium">Code</label>
          <Controller control={control} name="code" render={({ field }) => <Input {...field} size="large" status={errors.code ? "error" : ""} />} />
          {errors.code ? <div className="mt-1 text-xs text-red-600">{errors.code.message}</div> : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Name</label>
          <Controller control={control} name="name" render={({ field }) => <Input {...field} size="large" status={errors.name ? "error" : ""} />} />
          {errors.name ? <div className="mt-1 text-xs text-red-600">{errors.name.message}</div> : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Description</label>
          <Controller control={control} name="description" render={({ field }) => <Input.TextArea {...field} rows={3} />} />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
          <span className="text-sm font-medium">Default rule set for module</span>
          <Controller control={control} name="isDefault" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} />} />
        </div>

        <Button htmlType="submit" type="primary" loading={submitting}>
          {submitLabel}
        </Button>
      </form>
    </Card>
  );
};
