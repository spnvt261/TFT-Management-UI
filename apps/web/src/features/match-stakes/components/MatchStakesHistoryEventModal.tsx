import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input, InputNumber, Modal, Select } from "antd";
import { Controller, useForm } from "react-hook-form";
import { FormApiError } from "@/components/common/FormApiError";
import { historyEventSchema, type HistoryEventValues } from "@/features/match-stakes/schemas";
import type { CreateMatchStakesHistoryEventRequest } from "@/types/api";

interface SelectOption {
  value: string;
  label: string;
}

interface MatchStakesHistoryEventModalProps {
  open: boolean;
  canWrite: boolean;
  loading: boolean;
  apiError: string | null;
  defaultPeriodId?: string;
  periodOptions: SelectOption[];
  playerOptions: SelectOption[];
  onCancel: () => void;
  onSubmit: (payload: CreateMatchStakesHistoryEventRequest) => Promise<void>;
}

const eventTypeOptions = [
  { value: "ADVANCE", label: "Advance" },
  { value: "DEBT_SETTLEMENT", label: "Debt Settlement" },
  { value: "NOTE", label: "Note" }
];

const impactModeOptions = [
  { value: "AFFECTS_DEBT", label: "Affects debt" },
  { value: "INFORMATIONAL", label: "Informational only" }
];

export const MatchStakesHistoryEventModal = ({
  open,
  canWrite,
  loading,
  apiError,
  defaultPeriodId,
  periodOptions,
  playerOptions,
  onCancel,
  onSubmit
}: MatchStakesHistoryEventModalProps) => {
  const toPositiveInteger = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      const normalized = Math.trunc(value);
      return normalized > 0 ? normalized : null;
    }

    if (typeof value === "string") {
      const normalizedText = value.replace(/[^\d-]/g, "");
      if (!normalizedText) {
        return null;
      }

      const parsed = Number(normalizedText);
      if (!Number.isFinite(parsed)) {
        return null;
      }

      const normalized = Math.trunc(parsed);
      return normalized > 0 ? normalized : null;
    }

    return null;
  };

  const formatAmountVnd = (value: string | number | undefined) => {
    if (value === undefined || value === null || value === "") {
      return "";
    }

    const normalized = String(value).replace(/[^\d.-]/g, "");
    if (!normalized) {
      return "";
    }

    const [intPart, decimalPart] = normalized.split(".");
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return decimalPart ? `${formattedInt}.${decimalPart}` : formattedInt;
  };

  const parseAmountVnd = (value: string | undefined) => {
    if (!value) {
      return "";
    }

    return value.replace(/[^\d-]/g, "");
  };

  const {
    control,
    watch,
    reset,
    setValue,
    handleSubmit,
    formState: { errors }
  } = useForm<HistoryEventValues & { periodId?: string }>({
    resolver: zodResolver(historyEventSchema),
    defaultValues: {
      periodId: defaultPeriodId,
      eventType: "ADVANCE",
      playerId: "",
      participantPlayerIds: [],
      amountVnd: undefined,
      note: "",
      impactMode: "AFFECTS_DEBT"
    }
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    reset({
      periodId: defaultPeriodId,
      eventType: "ADVANCE",
      playerId: "",
      participantPlayerIds: [],
      amountVnd: undefined,
      note: "",
      impactMode: "AFFECTS_DEBT"
    });
  }, [defaultPeriodId, open, reset]);

  const eventType = watch("eventType");
  const selectedParticipants = watch("participantPlayerIds");
  const selectedPlayerId = watch("playerId");
  const noteValue = watch("note");
  const amountValue = watch("amountVnd");
  const normalizedAmountVnd = toPositiveInteger(amountValue);
  const requiresAmount = eventType === "ADVANCE" || eventType === "DEBT_SETTLEMENT";
  const participantPlayerIds = Array.isArray(selectedParticipants)
    ? selectedParticipants.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  const advancerOptions = useMemo(() => {
    if (eventType !== "ADVANCE") {
      return playerOptions;
    }

    const participantIdSet = new Set(participantPlayerIds);
    return playerOptions.filter((option) => participantIdSet.has(option.value));
  }, [eventType, participantPlayerIds, playerOptions]);

  useEffect(() => {
    if (eventType !== "ADVANCE") {
      return;
    }

    if (selectedPlayerId && !participantPlayerIds.includes(selectedPlayerId)) {
      setValue("playerId", "", { shouldValidate: true });
    }
  }, [eventType, participantPlayerIds, selectedPlayerId, setValue]);

  const canSubmit =
    noteValue.trim().length > 0 &&
    (!requiresAmount || normalizedAmountVnd !== null) &&
    (eventType !== "ADVANCE" || (participantPlayerIds.length > 0 && !!selectedPlayerId && participantPlayerIds.includes(selectedPlayerId))) &&
    !loading;

  return (
    <Modal title="Add History Event" width={680} open={open && canWrite} footer={null} onCancel={onCancel}>
      <form
        className="space-y-4"
        onSubmit={handleSubmit(async (values) => {
          const submitAmountVnd = toPositiveInteger(values.amountVnd);
          const submitParticipantIds = Array.isArray(values.participantPlayerIds)
            ? values.participantPlayerIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
            : [];

          const payload: CreateMatchStakesHistoryEventRequest = {
            periodId: values.periodId || defaultPeriodId || null,
            eventType: values.eventType,
            playerId: values.playerId || null,
            amountVnd: submitAmountVnd,
            note: values.note?.trim() || null,
            impactMode: values.impactMode,
            affectsDebt: values.impactMode === "AFFECTS_DEBT"
          };

          if (values.eventType === "ADVANCE") {
            payload.participantPlayerIds = submitParticipantIds;
          }

          await onSubmit(payload);
        })}
      >
        <FormApiError message={apiError} />

        <div>
          <label className="mb-1 block text-sm font-medium">Debt period</label>
          <Controller
            control={control}
            name={"periodId"}
            render={({ field }) => (
              <Select
                value={field.value || undefined}
                options={periodOptions}
                onChange={(value) => field.onChange(value)}
                placeholder="Select debt period"
                className="w-full"
              />
            )}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Event type</label>
          <Controller
            control={control}
            name="eventType"
            render={({ field }) => <Select value={field.value} options={eventTypeOptions} onChange={field.onChange} className="w-full" />}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">{eventType === "ADVANCE" ? "Participants" : "Player"}</label>
          {eventType === "ADVANCE" ? (
            <Controller
              control={control}
              name="participantPlayerIds"
              render={({ field }) => (
                <Select
                  mode="multiple"
                  value={field.value}
                  options={playerOptions}
                  onChange={(value) => field.onChange(value ?? [])}
                  placeholder="Select participants"
                  status={errors.participantPlayerIds ? "error" : ""}
                  className="w-full"
                />
              )}
            />
          ) : (
            <Controller
              control={control}
              name="playerId"
              render={({ field }) => (
                <Select
                  allowClear
                  value={field.value || undefined}
                  options={playerOptions}
                  onChange={(value) => field.onChange(value ?? "")}
                  placeholder="Optional player"
                  status={errors.playerId ? "error" : ""}
                  className="w-full"
                />
              )}
            />
          )}
          {errors.participantPlayerIds ? <div className="mt-1 text-xs text-red-600">{errors.participantPlayerIds.message}</div> : null}
          {eventType === "ADVANCE" ? (
            <div className="mt-3">
              <label className="mb-1 block text-sm font-medium">Advancer (paid first)</label>
              <Controller
                control={control}
                name="playerId"
                render={({ field }) => (
                  <Select
                    allowClear
                    value={field.value || undefined}
                    options={advancerOptions}
                    onChange={(value) => field.onChange(value ?? "")}
                    placeholder="Select advancer"
                    status={errors.playerId ? "error" : ""}
                    className="w-full"
                  />
                )}
              />
            </div>
          ) : null}
          {errors.playerId ? <div className="mt-1 text-xs text-red-600">{errors.playerId.message}</div> : null}
        </div>

        {eventType === "ADVANCE" || eventType === "DEBT_SETTLEMENT" ? (
          <div>
            <label className="mb-1 block text-sm font-medium">Amount (VND)</label>
            <Controller
              control={control}
              name="amountVnd"
              render={({ field }) => (
                <InputNumber
                  className="w-full"
                  min={1}
                  precision={0}
                  value={field.value}
                  formatter={formatAmountVnd}
                  parser={parseAmountVnd}
                  addonAfter="VND"
                  onChange={(value) => field.onChange(typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : undefined)}
                  status={errors.amountVnd ? "error" : ""}
                />
              )}
            />
            {errors.amountVnd ? <div className="mt-1 text-xs text-red-600">{errors.amountVnd.message}</div> : null}
          </div>
        ) : null}

        <div>
          <label className="mb-1 block text-sm font-medium">Impact mode</label>
          <Controller
            control={control}
            name="impactMode"
            render={({ field }) => <Select value={field.value} options={impactModeOptions} onChange={field.onChange} className="w-full" />}
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

        <Button type="primary" htmlType="submit" loading={loading} disabled={!canSubmit}>
          Save event
        </Button>
      </form>
    </Modal>
  );
};
