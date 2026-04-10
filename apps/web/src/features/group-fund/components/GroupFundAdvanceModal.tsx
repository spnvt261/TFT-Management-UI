import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, DatePicker, Input, Modal, Select } from "antd";
import dayjs from "dayjs";
import { Controller, useForm } from "react-hook-form";
import { FormApiError } from "@/components/common/FormApiError";
import { fundAdvanceSchema, type FundAdvanceValues } from "@/features/group-fund/schemas";
import { CurrencyAmountInput } from "@/features/rules/create-flow/components/CurrencyAmountInput";
import type { CreateGroupFundAdvanceRequest } from "@/types/api";
import { nowIso } from "@/lib/format";

interface SelectOption {
  value: string;
  label: string;
}

interface GroupFundAdvanceModalProps {
  open: boolean;
  canWrite: boolean;
  loading: boolean;
  apiError: string | null;
  playerOptions: SelectOption[];
  onCancel: () => void;
  onSubmit: (payload: CreateGroupFundAdvanceRequest) => Promise<void>;
}

export const GroupFundAdvanceModal = ({
  open,
  canWrite,
  loading,
  apiError,
  playerOptions,
  onCancel,
  onSubmit
}: GroupFundAdvanceModalProps) => {
  const {
    control,
    reset,
    handleSubmit,
    formState: { errors }
  } = useForm<FundAdvanceValues>({
    resolver: zodResolver(fundAdvanceSchema),
    defaultValues: {
      playerId: "",
      amountVnd: 0,
      note: "",
      postedAt: nowIso()
    }
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    reset({
      playerId: "",
      amountVnd: 0,
      note: "",
      postedAt: nowIso()
    });
  }, [open, reset]);

  return (
    <Modal title="Record Fund Advance" open={open && canWrite} footer={null} onCancel={onCancel}>
      <form
        className="space-y-4"
        onSubmit={handleSubmit(async (values) => {
          await onSubmit({
            playerId: values.playerId,
            amountVnd: Math.trunc(values.amountVnd),
            note: values.note?.trim() || null,
            postedAt: values.postedAt
          });
        })}
      >
        <FormApiError message={apiError} />

        <div>
          <label className="mb-1 block text-sm font-medium">Player</label>
          <Controller
            control={control}
            name="playerId"
            render={({ field }) => (
              <Select
                value={field.value || undefined}
                onChange={(value) => field.onChange(value ?? "")}
                options={playerOptions}
                placeholder="Select player"
                status={errors.playerId ? "error" : ""}
              />
            )}
          />
          {errors.playerId ? <div className="mt-1 text-xs text-red-600">{errors.playerId.message}</div> : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Amount (VND)</label>
          <Controller
            control={control}
            name="amountVnd"
            render={({ field }) => (
              <CurrencyAmountInput
                className="w-full"
                min={1}
                value={field.value}
                step={10000}
                onChange={field.onChange}
                status={errors.amountVnd ? "error" : ""}
              />
            )}
          />
          {errors.amountVnd ? <div className="mt-1 text-xs text-red-600">{errors.amountVnd.message}</div> : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Posted at (optional)</label>
          <Controller
            control={control}
            name="postedAt"
            render={({ field }) => (
              <DatePicker
                className="w-full"
                showTime
                value={field.value ? dayjs(field.value) : null}
                onChange={(value) => field.onChange(value ? value.toISOString() : undefined)}
              />
            )}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Note / reason</label>
          <Controller
            control={control}
            name="note"
            render={({ field }) => <Input.TextArea {...field} rows={3} status={errors.note ? "error" : ""} />}
          />
          {errors.note ? <div className="mt-1 text-xs text-red-600">{errors.note.message}</div> : null}
        </div>

        <Button type="primary" htmlType="submit" loading={loading}>
          Save fund advance
        </Button>
      </form>
    </Modal>
  );
};
