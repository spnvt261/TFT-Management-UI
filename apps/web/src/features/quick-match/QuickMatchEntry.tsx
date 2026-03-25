import { useEffect, useMemo, useState } from "react";
import { Button, Card, Drawer, Input, InputNumber, Modal, Select, Typography } from "antd";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useAuth } from "@/features/auth/AuthContext";
import { quickMatchSchema, type QuickMatchFormValues, defaultQuickMatchParticipants } from "@/features/quick-match/schema";
import type { MatchDetailDto, ModuleType, RuleSetDto } from "@/types/api";
import { presetsApi } from "@/api/presetsApi";
import { rulesApi } from "@/api/rulesApi";
import { matchesApi } from "@/api/matchesApi";
import { queryKeys } from "@/api/queryKeys";
import { useActivePlayers } from "@/features/players/hooks";
import { FormApiError } from "@/components/common/FormApiError";
import { getErrorMessage } from "@/lib/error-messages";
import { toAppError } from "@/api/httpClient";
import { formatVnd } from "@/lib/format";
import { invalidateAfterMatchCreate } from "@/lib/invalidation";
import { moduleLabels } from "@/lib/labels";

interface QuickMatchEntryProps {
  open: boolean;
  module: ModuleType;
  onClose: () => void;
}

const participantCountOptions = [
  { label: "3 players", value: 3 },
  { label: "4 players", value: 4 }
];

const ensureCount = (input: number | null | undefined): 3 | 4 => (input === 3 ? 3 : 4);

export const QuickMatchEntry = ({ open, module, onClose }: QuickMatchEntryProps) => {
  const isMobile = useIsMobile();
  const { canWrite } = useAuth();
  const canWriteActions = canWrite();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdMatch, setCreatedMatch] = useState<MatchDetailDto | null>(null);

  const playersQuery = useActivePlayers();
  const presetQuery = useQuery({
    queryKey: queryKeys.matches.preset(module),
    queryFn: () => presetsApi.getByModule(module),
    enabled: open
  });

  const [isPrefilled, setIsPrefilled] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    getValues
  } = useForm<QuickMatchFormValues>({
    resolver: zodResolver(quickMatchSchema),
    defaultValues: {
      module,
      participantCount: 4,
      ruleSetId: "",
      ruleSetVersionId: "",
      note: "",
      participants: defaultQuickMatchParticipants(4)
    }
  });

  const participantCount = useWatch({ control, name: "participantCount" });
  const ruleSetId = useWatch({ control, name: "ruleSetId" });

  const rulesQuery = useQuery({
    queryKey: queryKeys.rules.list({ module, status: "ACTIVE", page: 1, pageSize: 100 }),
    queryFn: async () => {
      const response = await rulesApi.list({ module, status: "ACTIVE", page: 1, pageSize: 100 });
      return response.data;
    },
    enabled: open
  });

  const defaultRuleQuery = useQuery({
    queryKey: queryKeys.rules.defaultByModule(module, participantCount),
    queryFn: () => rulesApi.getDefaultByModule(module, participantCount),
    enabled: open
  });

  const selectedRuleDetailQuery = useQuery({
    queryKey: queryKeys.rules.detail(ruleSetId || ""),
    queryFn: () => rulesApi.detail(ruleSetId),
    enabled: open && Boolean(ruleSetId)
  });

  const participantsFieldArray = useFieldArray({
    control,
    name: "participants"
  });

  const createMatchMutation = useMutation({
    mutationFn: matchesApi.create,
    onSuccess: async (result, variables) => {
      if (canWriteActions) {
        await presetsApi.update(module, {
          lastRuleSetId: variables.ruleSetId,
          lastRuleSetVersionId: variables.ruleSetVersionId ?? null,
          lastSelectedPlayerIds: variables.participants.map((participant) => participant.playerId),
          lastParticipantCount: ensureCount(variables.participants.length)
        });
      }
      await invalidateAfterMatchCreate(queryClient, module);
      setCreatedMatch(result);
    }
  });

  useEffect(() => {
    if (!open) {
      setIsPrefilled(false);
      setCreatedMatch(null);
      setSubmitError(null);
      return;
    }

    setValue("module", module);
  }, [open, module, setValue]);

  useEffect(() => {
    if (!open || isPrefilled || playersQuery.isLoading || rulesQuery.isLoading || presetQuery.isLoading) {
      return;
    }

    const players = playersQuery.data ?? [];
    const activePlayerIds = new Set(players.map((player) => player.id));
    const rules = rulesQuery.data ?? [];
    const preset = presetQuery.data;

    const participantCountValue = ensureCount(preset?.lastParticipantCount);
    const presetPlayers = (preset?.lastSelectedPlayerIds ?? []).filter((playerId) => activePlayerIds.has(playerId));
    const selectedPlayers = [...new Set(presetPlayers)].slice(0, participantCountValue);

    if (selectedPlayers.length < participantCountValue) {
      for (const player of players) {
        if (!selectedPlayers.includes(player.id)) {
          selectedPlayers.push(player.id);
        }

        if (selectedPlayers.length === participantCountValue) {
          break;
        }
      }
    }

    const participants = defaultQuickMatchParticipants(participantCountValue).map((participant, index) => ({
      ...participant,
      playerId: selectedPlayers[index] ?? ""
    }));

    const hasPresetRule = Boolean(preset?.lastRuleSetId && rules.some((rule) => rule.id === preset.lastRuleSetId));
    const fallbackRuleSet = defaultRuleQuery.data?.ruleSet?.id ?? rules[0]?.id ?? "";
    const selectedRuleSetId = hasPresetRule ? preset?.lastRuleSetId ?? "" : fallbackRuleSet;

    reset({
      module,
      participantCount: participantCountValue,
      ruleSetId: selectedRuleSetId,
      ruleSetVersionId: preset?.lastRuleSetVersionId ?? defaultRuleQuery.data?.activeVersion?.id ?? "",
      note: "",
      participants
    });

    setIsPrefilled(true);
  }, [
    defaultRuleQuery.data,
    isPrefilled,
    module,
    open,
    playersQuery.data,
    playersQuery.isLoading,
    presetQuery.data,
    presetQuery.isLoading,
    reset,
    rulesQuery.data,
    rulesQuery.isLoading
  ]);

  useEffect(() => {
    const count = ensureCount(participantCount);
    const current = getValues("participants");

    if (current.length === count) {
      return;
    }

    const next = defaultQuickMatchParticipants(count).map((participant, index) => ({
      ...participant,
      playerId: current[index]?.playerId ?? "",
      tftPlacement: current[index]?.tftPlacement ?? participant.tftPlacement
    }));

    participantsFieldArray.replace(next);
  }, [getValues, participantCount, participantsFieldArray]);

  const versionOptions = useMemo(() => {
    const versions = selectedRuleDetailQuery.data?.versions ?? [];
    return versions.map((version) => ({
      label: `v${version.versionNo} (${version.participantCountMin}-${version.participantCountMax})`,
      value: version.id
    }));
  }, [selectedRuleDetailQuery.data?.versions]);

  const ruleSetOptions = (rulesQuery.data ?? []).map((ruleSet: RuleSetDto) => ({
    label: `${ruleSet.code} - ${ruleSet.name}`,
    value: ruleSet.id
  }));

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);

    try {
      await createMatchMutation.mutateAsync({
        module: values.module,
        ruleSetId: values.ruleSetId,
        ruleSetVersionId: values.ruleSetVersionId || undefined,
        note: values.note || null,
        participants: values.participants.slice(0, values.participantCount).map((participant) => ({
          playerId: participant.playerId,
          tftPlacement: Number(participant.tftPlacement)
        }))
      });
    } catch (error) {
      setSubmitError(getErrorMessage(toAppError(error)));
    }
  });

  const formContent = createdMatch ? (
    <div className="space-y-4">
      <Card>
        <Typography.Title level={4}>Settlement confirmed</Typography.Title>
        <Typography.Paragraph>
          Match was created successfully for {moduleLabels[createdMatch.module]}.
        </Typography.Paragraph>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Total transfer</div>
            <div className="text-base font-semibold">{formatVnd(createdMatch.settlement?.totalTransferVnd ?? 0)}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Fund in</div>
            <div className="text-base font-semibold">{formatVnd(createdMatch.settlement?.totalFundInVnd ?? 0)}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Fund out</div>
            <div className="text-base font-semibold">{formatVnd(createdMatch.settlement?.totalFundOutVnd ?? 0)}</div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={() => {
            setCreatedMatch(null);
            setSubmitError(null);
          }}
        >
          Add another
        </Button>
        <Button type="primary" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  ) : (
    <form className="space-y-4" onSubmit={submit}>
      <FormApiError message={submitError} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Module</label>
          <Controller
            control={control}
            name="module"
            render={({ field }) => (
              <Select {...field} options={Object.entries(moduleLabels).map(([value, label]) => ({ value, label }))} size="large" disabled />
            )}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Participant count</label>
          <Controller
            control={control}
            name="participantCount"
            render={({ field }) => (
              <Select
                value={field.value}
                onChange={(value) => field.onChange(value)}
                options={participantCountOptions}
                size="large"
              />
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Rule set</label>
          <Controller
            control={control}
            name="ruleSetId"
            render={({ field }) => (
              <Select
                value={field.value || undefined}
                onChange={(value) => {
                  field.onChange(value);
                  setValue("ruleSetVersionId", "");
                }}
                options={ruleSetOptions}
                loading={rulesQuery.isLoading}
                showSearch
                optionFilterProp="label"
                size="large"
                status={errors.ruleSetId ? "error" : ""}
              />
            )}
          />
          {errors.ruleSetId ? <div className="mt-1 text-xs text-red-600">{errors.ruleSetId.message}</div> : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Rule version (optional)</label>
          <Controller
            control={control}
            name="ruleSetVersionId"
            render={({ field }) => (
              <Select
                allowClear
                value={field.value || undefined}
                onChange={(value) => field.onChange(value || "")}
                options={versionOptions}
                loading={selectedRuleDetailQuery.isLoading}
                size="large"
              />
            )}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-sm font-medium">Participants & placements</div>
        {participantsFieldArray.fields.map((field, index) => (
          <Card key={field.id} className="!rounded-xl !bg-slate-50">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_110px]">
              <Controller
                control={control}
                name={`participants.${index}.playerId`}
                render={({ field: playerField }) => (
                  <Select
                    value={playerField.value || undefined}
                    onChange={playerField.onChange}
                    size="large"
                    placeholder={`Player ${index + 1}`}
                    showSearch
                    optionFilterProp="label"
                    options={(playersQuery.data ?? []).map((player) => ({ value: player.id, label: player.displayName }))}
                    aria-label={`Participant ${index + 1} player`}
                    status={errors.participants?.[index]?.playerId ? "error" : ""}
                  />
                )}
              />

              <Controller
                control={control}
                name={`participants.${index}.tftPlacement`}
                render={({ field: placementField }) => (
                  <InputNumber
                    min={1}
                    max={8}
                    value={placementField.value}
                    onChange={(value) => placementField.onChange(value ?? 1)}
                    size="large"
                    className="w-full"
                    aria-label={`Participant ${index + 1} placement`}
                    addonBefore="#"
                    status={errors.participants?.[index]?.tftPlacement ? "error" : ""}
                  />
                )}
              />
            </div>
          </Card>
        ))}
        {errors.participants ? <div className="text-xs text-red-600">{errors.participants.message as string}</div> : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Note</label>
        <Controller
          control={control}
          name="note"
          render={({ field }) => <Input.TextArea {...field} placeholder="Optional note" rows={3} />}
        />
      </div>

      <Button
        htmlType="submit"
        type="primary"
        size="large"
        className="w-full sm:w-auto"
        loading={createMatchMutation.isPending}
      >
        Create Match
      </Button>
    </form>
  );

  return isMobile ? (
    <Drawer title={`Quick Match - ${moduleLabels[module]}`} placement="bottom" height="95%" open={open} onClose={onClose} destroyOnHidden>
      {formContent}
    </Drawer>
  ) : (
    <Modal title={`Quick Match - ${moduleLabels[module]}`} open={open} onCancel={onClose} footer={null} width={900} destroyOnHidden>
      {formContent}
    </Modal>
  );
};
