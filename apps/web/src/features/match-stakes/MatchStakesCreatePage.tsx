import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Input, InputNumber, Modal, Select, Tag, message } from "antd";
import { Link, useNavigate } from "react-router-dom";
import { matchesApi } from "@/api/matchesApi";
import { queryKeys } from "@/api/queryKeys";
import { rulesApi } from "@/api/rulesApi";
import { useActivePlayers } from "@/features/players/hooks";
import { AppBreadcrumb } from "@/components/layout/AppBreadcrumb";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/layout/SectionCard";
import { ErrorState } from "@/components/states/ErrorState";
import { FormApiError } from "@/components/common/FormApiError";
import { RankPlacementSelect } from "@/features/rules/create-flow/components/RankPlacementSelect";
import { toAppError } from "@/api/httpClient";
import { getErrorMessage } from "@/lib/error-messages";
import { formatVnd } from "@/lib/format";
import { invalidateAfterMatchCreate } from "@/lib/invalidation";
import type { CreateMatchRequest, PreviewMatchResultDto, RuleSetVersionDetailDto } from "@/types/api";

type ParticipantCount = 3 | 4;
type MatchSlot = {
  playerId: string | null;
  tftPlacement?: number;
};

type StoredMatchStakesDraft = {
  participantCount: ParticipantCount;
  ruleSetId: string | null;
  slotPlayerIds: string[];
};

type DropdownOption<T extends string | number> = {
  label: ReactNode;
  value: T;
  disabled?: boolean;
};

type SharedDropdownProps<T extends string | number> = {
  label: string;
  value?: T;
  options: Array<DropdownOption<T>>;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  wrapperClassName?: string;
  selectClassName?: string;
  onChange: (value: T | undefined) => void;
};

const STORAGE_KEY = "tft2.match-stakes.create.draft.v2";
const PARTICIPANT_COUNT_OPTIONS = [
  { label: "3 players", value: 3 },
  { label: "4 players", value: 4 }
] as const;

const SharedDropdown = <T extends string | number>({
  label,
  value,
  options,
  placeholder,
  disabled,
  allowClear,
  wrapperClassName,
  selectClassName,
  onChange
}: SharedDropdownProps<T>) => (
  <div className={wrapperClassName}>
    <label className="mb-1 block text-sm font-medium">{label}</label>
    <Select<T>
      size="large"
      className={`w-full ${selectClassName ?? ""}`.trim()}
      popupMatchSelectWidth={false}
      value={value}
      options={options}
      placeholder={placeholder}
      disabled={disabled}
      allowClear={allowClear}
      onChange={(nextValue) => onChange((nextValue ?? undefined) as T | undefined)}
    />
  </div>
);

const normalizeParticipantCount = (value: unknown): ParticipantCount => (value === 3 ? 3 : 4);

const buildPreviewKey = (payload: {
  ruleSetId: string;
  participants: Array<{ playerId: string; tftPlacement: number }>;
}) =>
  JSON.stringify({
    ruleSetId: payload.ruleSetId,
    participants: [...payload.participants].sort((left, right) => left.tftPlacement - right.tftPlacement)
  });

const buildEmptySlots = (count: ParticipantCount): MatchSlot[] =>
  Array.from({ length: count }, () => ({
    playerId: null,
    tftPlacement: undefined
  }));

const hydrateSlots = (count: ParticipantCount, slotPlayerIds: string[] | undefined) => {
  const next = buildEmptySlots(count);
  const used = new Set<string>();

  (slotPlayerIds ?? []).slice(0, count).forEach((playerId, index) => {
    const normalized = typeof playerId === "string" ? playerId.trim() : "";
    if (!normalized || used.has(normalized)) {
      return;
    }

    used.add(normalized);
    next[index].playerId = normalized;
  });

  return next;
};

const loadDraft = (): StoredMatchStakesDraft | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredMatchStakesDraft>;
    return {
      participantCount: normalizeParticipantCount(parsed.participantCount),
      ruleSetId: typeof parsed.ruleSetId === "string" ? parsed.ruleSetId : null,
      slotPlayerIds: Array.isArray(parsed.slotPlayerIds) ? parsed.slotPlayerIds.filter((item) => typeof item === "string") : []
    };
  } catch {
    return null;
  }
};

const persistDraft = (draft: StoredMatchStakesDraft) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
};

const syncSlotsWithCount = (previous: MatchSlot[], count: ParticipantCount) => {
  const next = buildEmptySlots(count);

  previous.slice(0, count).forEach((slot, index) => {
    next[index].playerId = slot.playerId;
    next[index].tftPlacement = slot.tftPlacement;
  });

  return next;
};

const isVersionApplicable = (version: RuleSetVersionDetailDto, participantCount: ParticipantCount, nowEpoch: number) => {
  if (!version.isActive) {
    return false;
  }

  if (participantCount < version.participantCountMin || participantCount > version.participantCountMax) {
    return false;
  }

  const effectiveFromEpoch = Date.parse(version.effectiveFrom);
  if (!Number.isNaN(effectiveFromEpoch) && effectiveFromEpoch > nowEpoch) {
    return false;
  }

  if (!version.effectiveTo) {
    return true;
  }

  const effectiveToEpoch = Date.parse(version.effectiveTo);
  if (Number.isNaN(effectiveToEpoch)) {
    return true;
  }

  return effectiveToEpoch >= nowEpoch;
};

export const MatchStakesCreatePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const initialDraft = useMemo(() => loadDraft(), []);

  const [participantCount, setParticipantCount] = useState<ParticipantCount>(() => initialDraft?.participantCount ?? 4);
  const [selectedRuleSetId, setSelectedRuleSetId] = useState<string>(initialDraft?.ruleSetId ?? "");
  const [slots, setSlots] = useState<MatchSlot[]>(() => hydrateSlots(initialDraft?.participantCount ?? 4, initialDraft?.slotPlayerIds));
  const [note, setNote] = useState("");
  const [previewData, setPreviewData] = useState<PreviewMatchResultDto | null>(null);
  const [lastCalculatedPreviewKey, setLastCalculatedPreviewKey] = useState<string | null>(null);
  const [lastPreviewErrorKey, setLastPreviewErrorKey] = useState<string | null>(null);
  const [netByPlayerId, setNetByPlayerId] = useState<Record<string, number>>({});
  const [showManualAdjustments, setShowManualAdjustments] = useState(false);
  const [confirmManualCreateOpen, setConfirmManualCreateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const playersQuery = useActivePlayers();
  const ruleSetsQuery = useQuery({
    queryKey: queryKeys.rules.list({ module: "MATCH_STAKES", status: "ACTIVE", page: 1, pageSize: 100 }),
    queryFn: async () => {
      const response = await rulesApi.list({ module: "MATCH_STAKES", status: "ACTIVE", page: 1, pageSize: 100 });
      return response.data;
    }
  });

  const ruleDetailQueries = useQueries({
    queries: (ruleSetsQuery.data ?? []).map((ruleSet) => ({
      queryKey: [...queryKeys.rules.detail(ruleSet.id), participantCount] as const,
      queryFn: () => rulesApi.detail(ruleSet.id),
      enabled: Boolean(ruleSet.id)
    }))
  });

  const previewMutation = useMutation({
    mutationFn: matchesApi.preview,
    onSuccess: (result, variables) => {
      const nextNets = Object.fromEntries(result.participants.map((participant) => [participant.playerId, participant.suggestedNetVnd]));
      setNetByPlayerId(nextNets);
      setPreviewData(result);
      setLastCalculatedPreviewKey(buildPreviewKey({ ruleSetId: variables.ruleSetId, participants: variables.participants }));
      setLastPreviewErrorKey(null);
      setShowManualAdjustments(false);
      setFormError(null);
    },
    onError: (error, variables) => {
      setPreviewData(null);
      setLastCalculatedPreviewKey(null);
      setLastPreviewErrorKey(buildPreviewKey({ ruleSetId: variables.ruleSetId, participants: variables.participants }));
      setFormError(getErrorMessage(toAppError(error)));
    }
  });

  const createMutation = useMutation({
    mutationFn: matchesApi.create,
    onSuccess: async (result) => {
      await invalidateAfterMatchCreate(queryClient, "MATCH_STAKES");
      message.success("Match created successfully.");
      navigate(`/matches/${result.id}`);
    },
    onError: (error) => {
      setFormError(getErrorMessage(toAppError(error)));
    }
  });

  const nowEpoch = Date.now();
  const ruleOptions = useMemo(() => {
    const options = (ruleSetsQuery.data ?? [])
      .map((ruleSet, index) => {
        const detail = ruleDetailQueries[index]?.data;
        if (!detail) {
          return null;
        }

        const applicableVersion = [...detail.versions]
          .filter((version) => isVersionApplicable(version, participantCount, nowEpoch))
          .sort((a, b) => b.versionNo - a.versionNo)[0];

        if (!applicableVersion) {
          return null;
        }

        return {
          value: ruleSet.id,
          name: ruleSet.name,
          description: ruleSet.description,
          versionNo: applicableVersion.versionNo,
          versionId: applicableVersion.id
        };
      })
      .filter(
        (item): item is { value: string; name: string; description: string | null; versionNo: number; versionId: string } => item !== null
      )
      .sort((left, right) => left.name.localeCompare(right.name));

    return options;
  }, [nowEpoch, participantCount, ruleDetailQueries, ruleSetsQuery.data]);

  const selectedRuleOption = useMemo(
    () => ruleOptions.find((option) => option.value === selectedRuleSetId),
    [ruleOptions, selectedRuleSetId]
  );
  const isRuleDetailsResolving = ruleDetailQueries.some((query) => query.isLoading || query.isFetching);

  const selectedPlayers = useMemo(
    () =>
      slots
        .filter((slot): slot is MatchSlot & { playerId: string; tftPlacement: number } => Boolean(slot.playerId) && typeof slot.tftPlacement === "number")
        .map((slot) => ({
          playerId: slot.playerId,
          tftPlacement: slot.tftPlacement
        })),
    [slots]
  );

  const hasDuplicatePlayers = useMemo(() => {
    const playerIds = selectedPlayers.map((participant) => participant.playerId);
    return new Set(playerIds).size !== playerIds.length;
  }, [selectedPlayers]);

  const hasDuplicatePlacements = useMemo(() => {
    const placements = selectedPlayers.map((participant) => participant.tftPlacement);
    return new Set(placements).size !== placements.length;
  }, [selectedPlayers]);

  const hasRowsMissingTop = slots.some((slot) => Boolean(slot.playerId) && typeof slot.tftPlacement !== "number");

  const previewRequestPayload = useMemo(
    () => ({
      module: "MATCH_STAKES" as const,
      ruleSetId: selectedRuleSetId,
      note: note.trim() || null,
      participants: selectedPlayers
    }),
    [note, selectedPlayers, selectedRuleSetId]
  );
  const currentPreviewKey = useMemo(
    () => buildPreviewKey({ ruleSetId: selectedRuleSetId, participants: selectedPlayers }),
    [selectedPlayers, selectedRuleSetId]
  );

  const isInputComplete =
    selectedPlayers.length === participantCount &&
    Boolean(selectedRuleOption) &&
    !hasDuplicatePlayers &&
    !hasDuplicatePlacements &&
    !hasRowsMissingTop;

  const previewParticipants = previewData?.participants ?? [];
  const currentPreviewNets = useMemo(
    () =>
      previewParticipants.map((participant) => ({
        ...participant,
        currentNetVnd: netByPlayerId[participant.playerId] ?? participant.suggestedNetVnd
      })),
    [netByPlayerId, previewParticipants]
  );

  const winners = useMemo(
    () => currentPreviewNets.filter((participant) => participant.currentNetVnd > 0).sort((left, right) => right.currentNetVnd - left.currentNetVnd),
    [currentPreviewNets]
  );
  const losers = useMemo(
    () => currentPreviewNets.filter((participant) => participant.currentNetVnd < 0).sort((left, right) => left.currentNetVnd - right.currentNetVnd),
    [currentPreviewNets]
  );

  const hasNetData = currentPreviewNets.length > 0;
  const currentNetTotal = currentPreviewNets.reduce((sum, participant) => sum + participant.currentNetVnd, 0);
  const hasBalancedNet = !hasNetData || currentNetTotal === 0;
  const hasManualAdjustedNets = currentPreviewNets.some(
    (participant) => participant.currentNetVnd !== participant.suggestedNetVnd
  );
  const requiresAdjustmentNote = Boolean(previewData) && hasManualAdjustedNets;
  const hasAdjustmentNote = note.trim().length > 0;

  const hasRuleLoadError = ruleSetsQuery.isError || ruleDetailQueries.some((query) => query.isError);
  const isRuleLoading = ruleSetsQuery.isLoading || ruleDetailQueries.some((query) => query.isLoading);
  const ruleLoadErrorMessage = getErrorMessage(toAppError(ruleSetsQuery.error ?? ruleDetailQueries.find((query) => query.error)?.error));

  const canCreate = Boolean(previewData) && hasBalancedNet && !createMutation.isPending && (!requiresAdjustmentNote || hasAdjustmentNote);
  const canTriggerRecalculate = isInputComplete && !previewMutation.isPending;

  const playerOptions = useMemo(
    () =>
      (playersQuery.data ?? []).map((player) => ({
        label: player.displayName,
        value: player.id
      })),
    [playersQuery.data]
  );

  useEffect(() => {
    setSlots((previous) => syncSlotsWithCount(previous, participantCount));
  }, [participantCount]);

  useEffect(() => {
    if (!playersQuery.data) {
      return;
    }

    const activePlayerIds = new Set(playersQuery.data.map((player) => player.id));
    setSlots((previous) =>
      previous.map((slot) => ({
        ...slot,
        playerId: slot.playerId && activePlayerIds.has(slot.playerId) ? slot.playerId : null
      }))
    );
  }, [playersQuery.data]);

  useEffect(() => {
    if (!ruleOptions.length) {
      return;
    }

    if (selectedRuleSetId && ruleOptions.some((option) => option.value === selectedRuleSetId)) {
      return;
    }

    // Avoid random default selection while rule details are still loading.
    if (isRuleDetailsResolving) {
      return;
    }

    setSelectedRuleSetId(ruleOptions[0].value);
  }, [isRuleDetailsResolving, ruleOptions, selectedRuleSetId]);

  useEffect(() => {
    persistDraft({
      participantCount,
      ruleSetId: selectedRuleSetId || null,
      slotPlayerIds: slots.map((slot) => slot.playerId ?? "")
    });
  }, [participantCount, selectedRuleSetId, slots]);

  useEffect(() => {
    if (!isInputComplete || isRuleLoading || previewMutation.isPending) {
      return;
    }

    if (hasManualAdjustedNets) {
      return;
    }

    if (currentPreviewKey === lastCalculatedPreviewKey) {
      return;
    }

    if (currentPreviewKey === lastPreviewErrorKey) {
      return;
    }

    const timer = setTimeout(() => {
      void previewMutation.mutateAsync(previewRequestPayload);
    }, 250);

    return () => clearTimeout(timer);
  }, [
    currentPreviewKey,
    hasManualAdjustedNets,
    isInputComplete,
    isRuleLoading,
    lastCalculatedPreviewKey,
    lastPreviewErrorKey,
    previewMutation,
    previewMutation.isPending,
    previewRequestPayload
  ]);

  const resetPreview = () => {
    setPreviewData(null);
    setLastCalculatedPreviewKey(null);
    setLastPreviewErrorKey(null);
    setNetByPlayerId({});
    setShowManualAdjustments(false);
    setConfirmManualCreateOpen(false);
  };

  const updatePlayer = (slotIndex: number, playerId: string | undefined) => {
    let changed = false;
    setSlots((previous) =>
      previous.map((slot, index) => {
        if (index === slotIndex) {
          const nextPlayerId = playerId ?? null;
          const nextPlacement = playerId ? slot.tftPlacement : undefined;
          changed = changed || slot.playerId !== nextPlayerId || slot.tftPlacement !== nextPlacement;
          return {
            ...slot,
            playerId: nextPlayerId,
            tftPlacement: nextPlacement
          };
        }

        if (playerId && slot.playerId === playerId) {
          changed = true;
          return { ...slot, playerId: null, tftPlacement: undefined };
        }

        return slot;
      })
    );

    if (changed && previewData) {
      resetPreview();
    }
  };

  const updatePlacement = (slotIndex: number, placement: number | undefined) => {
    let changed = false;
    setSlots((previous) =>
      previous.map((slot, index) => {
        if (index !== slotIndex) {
          return slot;
        }

        if (!slot.playerId) {
          changed = changed || slot.tftPlacement !== undefined;
          return { ...slot, tftPlacement: undefined };
        }

        changed = changed || slot.tftPlacement !== placement;
        return { ...slot, tftPlacement: placement };
      })
    );

    if (changed && previewData) {
      resetPreview();
    }
  };

  const runPreview = async () => {
    if (!canTriggerRecalculate) {
      return;
    }

    setLastPreviewErrorKey(null);
    setFormError(null);
    await previewMutation.mutateAsync(previewRequestPayload);
  };

  const submitCreateMatch = async () => {
    if (!previewData || !selectedRuleOption) {
      return;
    }

    setFormError(null);
    const confirmationParticipantNets = currentPreviewNets.map((participant) => ({
      playerId: participant.playerId,
      netVnd: Math.trunc(participant.currentNetVnd)
    }));

    const payload: CreateMatchRequest = {
      module: "MATCH_STAKES",
      ruleSetId: selectedRuleSetId,
      ruleSetVersionId: previewData.ruleSetVersion.id,
      note: note.trim() || null,
      participants: selectedPlayers,
      confirmation: {
        mode: hasManualAdjustedNets ? "MANUAL_ADJUSTED" : "ENGINE",
        participantNets: confirmationParticipantNets,
        overrideReason: hasManualAdjustedNets ? note.trim() : null
      }
    };

    await createMutation.mutateAsync(payload);
  };

  const handleCreateMatch = async () => {
    if (!canCreate) {
      return;
    }
    setConfirmManualCreateOpen(true);
  };

  if (hasRuleLoadError) {
    return (
      <ErrorState
        description={ruleLoadErrorMessage}
        onRetry={() => {
          void ruleSetsQuery.refetch();
          ruleDetailQueries.forEach((query) => {
            void query.refetch();
          });
        }}
      />
    );
  }

  return (
    <PageContainer>
      <AppBreadcrumb items={[{ label: "Match Stakes", to: "/match-stakes" }, { label: "Create Match" }]} />

      <PageHeader
        title="Create Match Stakes Match"
        subtitle="Select participants, preview settlement, optionally adjust nets, then create match."
        actions={<Button onClick={() => navigate("/match-stakes")}>Back to Match Stakes</Button>}
      />

      {formError ? (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[1100] flex justify-center px-4">
          <div className="pointer-events-auto w-full max-w-xl">
            <FormApiError message={formError} />
          </div>
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-[420px_1fr]">
        <SectionCard title="Setup" bodyClassName="space-y-4">
          <div>
            <div className="mb-1 block text-sm font-medium">Module</div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">MATCH_STAKES</div>
          </div>

          <SharedDropdown<ParticipantCount>
            label="Participant count"
            value={participantCount}
            options={PARTICIPANT_COUNT_OPTIONS.map((option) => ({ label: option.label, value: option.value }))}
            onChange={(value) => {
              const nextCount = value ?? 4;
              if (nextCount !== participantCount && previewData) {
                resetPreview();
              }
              setParticipantCount(nextCount);
            }}
            wrapperClassName="w-full max-w-[240px]"
          />

          <div className="w-full max-w-[360px]">
            <label className="mb-1 block text-sm font-medium">Rule</label>
            <Select
              className="w-full"
              popupMatchSelectWidth={false}
              value={selectedRuleSetId || undefined}
              onChange={(value) => {
                if (value !== selectedRuleSetId && previewData) {
                  resetPreview();
                }
                setSelectedRuleSetId(value);
              }}
              size="large"
              loading={isRuleLoading}
              disabled={isRuleLoading || !ruleOptions.length}
              options={ruleOptions.map((option) => ({
                value: option.value,
                label: (
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900">{option.name}</div>
                    </div>
                    <Tag className="!mr-0">{`v${option.versionNo}`}</Tag>
                  </div>
                )
              }))}
              placeholder={isRuleLoading ? "Loading rules..." : "No active rule for selected participant count"}
            />

            {selectedRuleOption ? (
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Description Rule</div>
                    <div
                      className="mt-0.5 text-sm text-slate-700"
                      title={selectedRuleOption.description || "No description"}
                    >
                      {selectedRuleOption.description || "No description"}
                    </div>
                  </div>
                  <Link to={`/rules/${selectedRuleOption.value}`} className="shrink-0 text-xs font-medium text-brand-700 hover:text-brand-800">
                    View detail
                  </Link>
                </div>
              </div>
            ) : null}

            {!isRuleLoading && !ruleOptions.length ? (
              <div className="mt-1 text-xs text-red-600">No applicable active rule found for this participant count.</div>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Note</label>
            <Input.TextArea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={400}
              rows={3}
              placeholder="Optional note"
              className="w-full"
            />
            {requiresAdjustmentNote && !hasAdjustmentNote ? (
              <div className="mt-1 text-xs text-red-600">Note is required when win/loss values are manually adjusted.</div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Button
              className={`w-full ${
                canCreate
                  ? "!border-emerald-600 !bg-emerald-600 !text-white shadow-[0_10px_28px_rgba(5,150,105,0.3)] hover:!border-emerald-500 hover:!bg-emerald-500"
                  : ""
              }`}
              disabled={!canCreate}
              loading={createMutation.isPending}
              onClick={() => void handleCreateMatch()}
            >
              Create Match
            </Button>
          </div>
        </SectionCard>

        <div className="space-y-3">
          <SectionCard title="Participants" description="Choose player and top for each participant row.">
            <div className="space-y-3 mb-2">
              {slots.map((slot, index) => {
                const usedPlayerIds = new Set(
                  slots
                    .filter((_, itemIndex) => itemIndex !== index)
                    .map((item) => item.playerId)
                    .filter((item): item is string => Boolean(item))
                );
                const playerOptionsForRow = playerOptions.map((option) => ({
                  ...option,
                  disabled: usedPlayerIds.has(option.value)
                }));
                const disabledTopValues = slots
                  .filter((item, itemIndex) => itemIndex !== index && Boolean(item.playerId) && typeof item.tftPlacement === "number")
                  .map((item) => item.tftPlacement as number);

                return (
                  <Card key={index} size="small" className="rounded-xl border border-slate-200">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{`Participant ${index + 1}`}</div>
                    <div className="flex flex-nowrap items-end gap-3">
                      <SharedDropdown<string>
                        label="Player"
                        value={slot.playerId ?? undefined}
                        options={playerOptionsForRow}
                        placeholder={`Select player ${index + 1}`}
                        allowClear
                        disabled={playersQuery.isLoading || playersQuery.isError}
                        onChange={(value) => updatePlayer(index, value)}
                        wrapperClassName="min-w-0 flex-1"
                      />

                      <div className="w-[132px] shrink-0">
                        <label className="mb-1 block text-sm font-medium">Top</label>
                        <RankPlacementSelect
                          value={slot.tftPlacement}
                          onChange={(value) => updatePlacement(index, value)}
                          min={1}
                          max={8}
                          disabledValues={disabledTopValues}
                          placeholder="Select top"
                          size="large"
                          disabled={!slot.playerId}
                          optionLabel={(value) => `Top ${value}`}
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {hasRowsMissingTop ? <Alert type="warning" showIcon message="Please choose top for all selected players." /> : null}
            {hasDuplicatePlayers ? <Alert type="error" showIcon message="Players must be unique." /> : null}
            {hasDuplicatePlacements ? <Alert type="error" showIcon message="Top placements must be unique." /> : null}
          </SectionCard>

          <SectionCard
            title="Settlement Preview"
            description="Auto-calculated when participant inputs are complete."
            actions={
              previewData && hasManualAdjustedNets ? (
                <Button type="default" className="border-yellow-500 text-yellow-500" loading={previewMutation.isPending} onClick={() => void runPreview()}>
                  Recalculate
                </Button>
              ) : null
            }
          >
            {!previewData ? <div className="text-sm text-slate-500">No preview yet. Fill participants to auto-calculate settlement.</div> : null}

            {previewData ? (
              <div className="space-y-4">
                {!hasBalancedNet ? (
                  <Alert
                    type="error"
                    showIcon
                    message={`Current manual net total is ${formatVnd(currentNetTotal)}. Total must be 0 before creating.`}
                  />
                ) : null}

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                  <Card size="small">
                    <div className="text-xs text-slate-500">Rule version</div>
                    <div className="mt-1 text-sm font-semibold">{`v${previewData.ruleSetVersion.versionNo}`}</div>
                  </Card>
                  <Card size="small">
                    <div className="text-xs text-slate-500">Total transfer</div>
                    <div className="mt-1 text-sm font-semibold">{formatVnd(previewData.settlementPreview.totalTransferVnd)}</div>
                  </Card>
                  <Card size="small">
                    <div className="text-xs text-slate-500">Current net total</div>
                    <div className={`mt-1 text-sm font-semibold ${hasBalancedNet ? "text-green-700" : "text-red-700"}`}>{formatVnd(currentNetTotal)}</div>
                  </Card>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <Card size="small" className="border border-green-200 bg-green-50/40">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-700">Winners</div>
                    {winners.length === 0 ? (
                      <div className="text-xs text-slate-500">No winner net amount.</div>
                    ) : (
                      <div className="space-y-1.5">
                        {winners.map((winner) => (
                          <div key={winner.playerId} className="flex items-center justify-between gap-2 text-sm">
                            <span className="truncate text-slate-800">{winner.playerName}</span>
                            <span className="font-semibold text-green-700">{formatVnd(winner.currentNetVnd)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>

                  <Card size="small" className="border border-red-200 bg-red-50/40">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700">Losers</div>
                    {losers.length === 0 ? (
                      <div className="text-xs text-slate-500">No loser net amount.</div>
                    ) : (
                      <div className="space-y-1.5">
                        {losers.map((loser) => (
                          <div key={loser.playerId} className="flex items-center justify-between gap-2 text-sm">
                            <span className="truncate text-slate-800">{loser.playerName}</span>
                            <span className="font-semibold text-red-700">{formatVnd(loser.currentNetVnd)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>

                <div className="flex justify-end">
                  <Button type="link" className="px-0" onClick={() => setShowManualAdjustments((previous) => !previous)}>
                    {showManualAdjustments ? "Hide win/loss adjustments" : "Adjust win/loss values"}
                  </Button>
                </div>

                {showManualAdjustments ? (
                  <div className="space-y-2">
                    {currentPreviewNets.map((participant) => (
                      <Card key={participant.playerId} size="small">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px] sm:items-center">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{participant.playerName}</div>
                            <div className="mt-1 text-xs text-slate-500">{`Top ${participant.tftPlacement} | Suggested: ${formatVnd(
                              participant.suggestedNetVnd
                            )}`}</div>
                          </div>
                          <InputNumber
                            className="w-full"
                            size="large"
                            precision={0}
                            step={10000}
                            controls
                            value={participant.currentNetVnd}
                            onChange={(value) =>
                              setNetByPlayerId((previous) => ({
                                ...previous,
                                [participant.playerId]: Number(value ?? 0)
                              }))
                            }
                            addonAfter="VND"
                          />
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </SectionCard>
        </div>
      </section>

      <Modal
        title="Confirm create match"
        open={confirmManualCreateOpen}
        okText="Confirm and create"
        okButtonProps={{ loading: createMutation.isPending }}
        onOk={async () => {
          await submitCreateMatch();
          setConfirmManualCreateOpen(false);
        }}
        onCancel={() => setConfirmManualCreateOpen(false)}
      >
        <div className="space-y-3">
          {hasManualAdjustedNets ? (
            <Alert type="warning" showIcon message="Win/loss values were manually adjusted from calculated results." />
          ) : null}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Winners</div>
            {winners.length === 0 ? (
              <div className="mt-1 text-sm text-slate-500">No winners</div>
            ) : (
              <div className="mt-2 space-y-1.5">
                {winners.map((winner) => (
                  <div key={winner.playerId} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate">{winner.playerName}</div>
                      <div className="text-xs text-slate-500">{`Top ${winner.tftPlacement}`}</div>
                    </div>
                    <span className="font-semibold text-green-700">{formatVnd(winner.currentNetVnd)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Losers</div>
            {losers.length === 0 ? (
              <div className="mt-1 text-sm text-slate-500">No losers</div>
            ) : (
              <div className="mt-2 space-y-1.5">
                {losers.map((loser) => (
                  <div key={loser.playerId} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate">{loser.playerName}</div>
                      <div className="text-xs text-slate-500">{`Top ${loser.tftPlacement}`}</div>
                    </div>
                    <span className="font-semibold text-red-700">{formatVnd(loser.currentNetVnd)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
};
