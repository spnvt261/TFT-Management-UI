import { useEffect, useState } from "react";
import { Button, Card, Input, Switch } from "antd";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { PlayerDto } from "@/types/api";
import { playerFormSchema, type PlayerFormValues } from "@/features/players/schemas";
import { FormApiError } from "@/components/common/FormApiError";
import { getErrorMessage } from "@/lib/error-messages";
import { toAppError } from "@/api/httpClient";

interface PlayerFormProps {
  initial?: PlayerDto;
  submitting?: boolean;
  submitLabel: string;
  onSubmit: (values: PlayerFormValues) => Promise<void>;
}

export const PlayerForm = ({ initial, submitting, submitLabel, onSubmit }: PlayerFormProps) => {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors },
    setError,
    reset
  } = useForm<PlayerFormValues>({
    resolver: zodResolver(playerFormSchema),
    defaultValues: {
      displayName: initial?.displayName ?? "",
      slug: initial?.slug ?? "",
      avatarUrl: initial?.avatarUrl ?? "",
      isActive: initial?.isActive ?? true
    }
  });

  useEffect(() => {
    if (initial) {
      reset({
        displayName: initial.displayName,
        slug: initial.slug ?? "",
        avatarUrl: initial.avatarUrl ?? "",
        isActive: initial.isActive
      });
    }
  }, [initial, reset]);

  return (
    <Card>
      <form
        className="space-y-4"
        onSubmit={handleSubmit(async (values) => {
          setFormError(null);
          try {
            await onSubmit(values);
          } catch (error) {
            const appError = toAppError(error);
            if (appError.code === "PLAYER_DUPLICATE") {
              setError("slug", { message: "Slug already exists" });
              return;
            }

            setFormError(getErrorMessage(appError));
          }
        })}
      >
        <FormApiError message={formError} />

        <div>
          <label className="mb-1 block text-sm font-medium">Display name</label>
          <Controller
            control={control}
            name="displayName"
            render={({ field }) => <Input {...field} placeholder="Player name" size="large" status={errors.displayName ? "error" : ""} />}
          />
          {errors.displayName ? <div className="mt-1 text-xs text-red-600">{errors.displayName.message}</div> : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Slug</label>
          <Controller
            control={control}
            name="slug"
            render={({ field }) => <Input {...field} placeholder="Optional unique slug" size="large" status={errors.slug ? "error" : ""} />}
          />
          {errors.slug ? <div className="mt-1 text-xs text-red-600">{errors.slug.message}</div> : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Avatar URL</label>
          <Controller
            control={control}
            name="avatarUrl"
            render={({ field }) => <Input {...field} placeholder="https://..." size="large" status={errors.avatarUrl ? "error" : ""} />}
          />
          {errors.avatarUrl ? <div className="mt-1 text-xs text-red-600">{errors.avatarUrl.message}</div> : null}
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
          <span className="text-sm font-medium">Active</span>
          <Controller control={control} name="isActive" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} />} />
        </div>

        <Button htmlType="submit" type="primary" size="large" loading={submitting}>
          {submitLabel}
        </Button>
      </form>
    </Card>
  );
};
