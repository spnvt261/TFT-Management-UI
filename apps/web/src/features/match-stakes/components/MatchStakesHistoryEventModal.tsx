import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input, InputNumber, Modal, Radio, Select, Tag } from "antd";
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
  openPeriodId?: string;
  openPeriodNo?: number;
  playerOptions: SelectOption[];
  onCancel: () => void;
  onSubmit: (payload: CreateMatchStakesHistoryEventRequest) => Promise<void>;
}

const ADVANCE_SELECTION_STORAGE_KEY = "tft2.match-stakes.history-event.advance-selection";
const NOTE_PRESET_OPTIONS = [
  { value: "MACHINE", label: "Tiền máy", note: "Tiền máy" },
  { value: "TABLE", label: "Tiền bàn", note: "Tiền bàn" },
  { value: "FOOD", label: "Tiền ăn", note: "Tiền ăn" },
  { value: "OTHER", label: "Khác", note: "" }
] as const;

type NotePreset = (typeof NOTE_PRESET_OPTIONS)[number]["value"];
type AdvanceSelectionSnapshot = {
  participantPlayerIds: string[];
  playerId: string | null;
};

const readAdvanceSelectionSnapshot = (): AdvanceSelectionSnapshot => {
  if (typeof window === "undefined") {
    return { participantPlayerIds: [], playerId: null };
  }

  try {
    const raw = window.localStorage.getItem(ADVANCE_SELECTION_STORAGE_KEY);
    if (!raw) {
      return { participantPlayerIds: [], playerId: null };
    }

    const parsed = JSON.parse(raw) as Partial<AdvanceSelectionSnapshot>;
    const participantPlayerIds = Array.isArray(parsed.participantPlayerIds)
      ? parsed.participantPlayerIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];
    const playerId = typeof parsed.playerId === "string" && parsed.playerId.trim().length > 0 ? parsed.playerId : null;

    return { participantPlayerIds, playerId };
  } catch {
    return { participantPlayerIds: [], playerId: null };
  }
};

const writeAdvanceSelectionSnapshot = (snapshot: AdvanceSelectionSnapshot) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ADVANCE_SELECTION_STORAGE_KEY, JSON.stringify(snapshot));
};

const getNoteByPreset = (preset: NotePreset, otherValue: string) => {
  if (preset === "OTHER") {
    return otherValue.trim();
  }

  const found = NOTE_PRESET_OPTIONS.find((option) => option.value === preset);
  return found?.note ?? "";
};

export const MatchStakesHistoryEventModal = ({
  open,
  canWrite,
  loading,
  apiError,
  openPeriodId,
  openPeriodNo,
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
  } = useForm<HistoryEventValues>({
    resolver: zodResolver(historyEventSchema),
    defaultValues: {
      eventType: "ADVANCE",
      playerId: "",
      participantPlayerIds: [],
      amountVnd: undefined,
      note: "Tiền máy",
      impactMode: "AFFECTS_DEBT"
    }
  });
  const [notePreset, setNotePreset] = useState<NotePreset>("MACHINE");
  const [noteOther, setNoteOther] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    const snapshot = readAdvanceSelectionSnapshot();
    const availablePlayerIds = new Set(playerOptions.map((option) => option.value));
    const participantPlayerIds = snapshot.participantPlayerIds.filter((playerId) => availablePlayerIds.has(playerId));
    const playerId = snapshot.playerId && participantPlayerIds.includes(snapshot.playerId) ? snapshot.playerId : "";

    reset({
      eventType: "ADVANCE",
      playerId,
      participantPlayerIds,
      amountVnd: undefined,
      note: "Tiền máy",
      impactMode: "AFFECTS_DEBT"
    });
    setNotePreset("MACHINE");
    setNoteOther("");
  }, [open, playerOptions, reset]);

  const selectedParticipants = watch("participantPlayerIds");
  const selectedPlayerId = watch("playerId");
  const amountValue = watch("amountVnd");
  const noteValue = watch("note");

  const normalizedAmountVnd = toPositiveInteger(amountValue);
  const participantPlayerIds = Array.isArray(selectedParticipants)
    ? selectedParticipants.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];

  const advancerOptions = useMemo(() => {
    const participantIdSet = new Set(participantPlayerIds);
    return playerOptions.filter((option) => participantIdSet.has(option.value));
  }, [participantPlayerIds, playerOptions]);

  useEffect(() => {
    if (selectedPlayerId && !participantPlayerIds.includes(selectedPlayerId)) {
      setValue("playerId", "", { shouldValidate: true });
    }
  }, [participantPlayerIds, selectedPlayerId, setValue]);

  useEffect(() => {
    writeAdvanceSelectionSnapshot({
      participantPlayerIds,
      playerId: selectedPlayerId || null
    });
  }, [participantPlayerIds, selectedPlayerId]);

  useEffect(() => {
    setValue("note", getNoteByPreset(notePreset, noteOther), { shouldValidate: true });
  }, [noteOther, notePreset, setValue]);

  const canSubmit =
    Boolean(openPeriodId) &&
    noteValue.trim().length > 0 &&
    normalizedAmountVnd !== null &&
    participantPlayerIds.length > 0 &&
    !!selectedPlayerId &&
    participantPlayerIds.includes(selectedPlayerId) &&
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

          await onSubmit({
            periodId: openPeriodId ?? null,
            debtPeriodId: openPeriodId ?? null,
            eventType: "MATCH_STAKES_ADVANCE",
            playerId: values.playerId || null,
            participantPlayerIds: submitParticipantIds,
            amountVnd: submitAmountVnd,
            note: getNoteByPreset(notePreset, noteOther) || null,
            impactMode: "AFFECTS_DEBT",
            affectsDebt: true
          });
        })}
      >
        <FormApiError message={apiError} />

        <div className="flex flex-wrap items-center gap-2">
          <Tag color="green">{openPeriodNo ? `Period #${openPeriodNo}` : "No open period"}</Tag>
          <Tag color="purple">Advance</Tag>
          <Tag color="geekblue">Impact mode</Tag>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Participants</label>
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
          {errors.participantPlayerIds ? <div className="mt-1 text-xs text-red-600">{errors.participantPlayerIds.message}</div> : null}
        </div>

        <div>
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
          {errors.playerId ? <div className="mt-1 text-xs text-red-600">{errors.playerId.message}</div> : null}
        </div>

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

        <div>
          <label className="mb-1 block text-sm font-medium">Note</label>
          <Radio.Group value={notePreset} onChange={(event) => setNotePreset(event.target.value as NotePreset)} optionType="button" buttonStyle="solid">
            {NOTE_PRESET_OPTIONS.map((option) => (
              <Radio.Button key={option.value} value={option.value}>
                {option.label}
              </Radio.Button>
            ))}
          </Radio.Group>

          {notePreset === "OTHER" ? (
            <Input
              className="mt-2"
              placeholder="Nhập nội dung khác"
              status={errors.note ? "error" : ""}
              value={noteOther}
              onChange={(event) => setNoteOther(event.target.value)}
            />
          ) : null}

          {errors.note ? <div className="mt-1 text-xs text-red-600">{errors.note.message}</div> : null}
        </div>

        <Button type="primary" htmlType="submit" loading={loading} disabled={!canSubmit}>
          Save event
        </Button>
      </form>
    </Modal>
  );
};
