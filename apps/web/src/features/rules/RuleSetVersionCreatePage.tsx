import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Divider,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message
} from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { Controller, FormProvider, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { RuleBuilder } from "@/features/rules/RuleBuilder";
import { RulesBreadcrumb } from "@/features/rules/components";
import { useCreateRuleSetVersion, useRuleSetDetail, useRuleSetVersionDetail } from "@/features/rules/hooks";
import {
  matchStakesVersionBuilderSchema,
  parseJsonOrDefault,
  rawRuleSetVersionSchema,
  type MatchStakesVersionBuilderValues,
  type RawRuleSetVersionValues
} from "@/features/rules/schemas";
import { formatAmountVnd, formatPenaltyDestination, normalizeMatchStakesBuilderConfig } from "@/features/rules/builder-utils";
import { FormApiError } from "@/components/common/FormApiError";
import { ErrorState } from "@/components/states/ErrorState";
import { PageLoading } from "@/components/states/PageLoading";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/layout/SectionCard";
import { getErrorMessage } from "@/lib/error-messages";
import { moduleLabels } from "@/lib/labels";
import { toAppError } from "@/api/httpClient";
import type {
  CreateRuleSetVersionRequest,
  MatchStakesPenaltyDestinationSelectorType,
  MatchStakesPenaltyConfig,
  RuleSetDetailDto
} from "@/types/api";

const destinationTypeOptions: Array<{ label: string; value: MatchStakesPenaltyDestinationSelectorType }> = [
  { label: "Best participant", value: "BEST_PARTICIPANT" },
  { label: "Match winner", value: "MATCH_WINNER" },
  { label: "Fixed player", value: "FIXED_PLAYER" },
  { label: "Fund account", value: "FUND_ACCOUNT" }
];

const toWinnerOptions = (participantCount: 3 | 4) => {
  if (participantCount === 3) {
    return [
      { label: "1 winner (common)", value: 1 },
      { label: "2 winners", value: 2 }
    ];
  }

  return [
    { label: "1 winner", value: 1 },
    { label: "2 winners (common)", value: 2 },
    { label: "3 winners", value: 3 }
  ];
};

const defaultWinnerCount = (participantCount: 3 | 4) => (participantCount === 3 ? 1 : 2);

const buildRankAmounts = (
  start: number,
  end: number,
  existing: Array<{ relativeRank: number; amountVnd: number }>
): Array<{ relativeRank: number; amountVnd: number }> => {
  const existingMap = new Map(existing.map((item) => [item.relativeRank, item.amountVnd]));
  const result: Array<{ relativeRank: number; amountVnd: number }> = [];

  for (let rank = start; rank <= end; rank += 1) {
    result.push({
      relativeRank: rank,
      amountVnd: existingMap.get(rank) ?? 0
    });
  }

  return result;
};

const parseRecordJson = (value?: string | null): Record<string, unknown> | null => {
  if (!value) {
    return null;
  }

  const parsed = parseJsonOrDefault(value, null);
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }

  return null;
};

const toPenaltyPreview = (penalty: MatchStakesPenaltyConfig) =>
  `top${penalty.absolutePlacement} pays extra ${formatAmountVnd(penalty.amountVnd)} to ${formatPenaltyDestination(
    penalty.destinationSelectorType
  )}`;

interface MatchStakesBuilderFormProps {
  ruleSet: RuleSetDetailDto;
  prefill?:
    | {
        sourceVersionNo: number;
        participantCount: 3 | 4;
        winnerCount: number;
        payouts: Array<{ relativeRank: number; amountVnd: number }>;
        losses: Array<{ relativeRank: number; amountVnd: number }>;
        penalties: MatchStakesVersionBuilderValues["penalties"];
        isActive: boolean;
        effectiveTo: string;
        summaryJsonText: string;
      }
    | null;
}

const MatchStakesBuilderForm = ({ ruleSet, prefill }: MatchStakesBuilderFormProps) => {
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);
  const createMutation = useCreateRuleSetVersion(ruleSet.id);

  const form = useForm<MatchStakesVersionBuilderValues>({
    resolver: zodResolver(matchStakesVersionBuilderSchema),
    defaultValues: {
      participantCount: 3,
      winnerCount: 1,
      effectiveTo: "",
      isActive: true,
      summaryJsonText: "",
      payouts: [{ relativeRank: 1, amountVnd: 0 }],
      losses: [
        { relativeRank: 2, amountVnd: 0 },
        { relativeRank: 3, amountVnd: 0 }
      ],
      penalties: []
    }
  });

  const participantCount = useWatch({ control: form.control, name: "participantCount" });
  const winnerCount = useWatch({ control: form.control, name: "winnerCount" });
  const payouts = useWatch({ control: form.control, name: "payouts" }) ?? [];
  const losses = useWatch({ control: form.control, name: "losses" }) ?? [];
  const penalties = useWatch({ control: form.control, name: "penalties" }) ?? [];

  const penaltiesFieldArray = useFieldArray({
    control: form.control,
    name: "penalties"
  });

  useEffect(() => {
    if (!prefill) {
      return;
    }

    form.reset({
      participantCount: prefill.participantCount,
      winnerCount: prefill.winnerCount,
      effectiveTo: prefill.effectiveTo,
      isActive: prefill.isActive,
      summaryJsonText: prefill.summaryJsonText,
      payouts: prefill.payouts,
      losses: prefill.losses,
      penalties: prefill.penalties
    });
  }, [form, prefill]);

  useEffect(() => {
    const recommended = defaultWinnerCount(participantCount);
    if (winnerCount >= participantCount || winnerCount < 1) {
      form.setValue("winnerCount", recommended, { shouldValidate: true });
    }
  }, [form, participantCount, winnerCount]);

  useEffect(() => {
    const nextPayouts = buildRankAmounts(1, winnerCount, payouts);
    const nextLosses = buildRankAmounts(winnerCount + 1, participantCount, losses);

    form.setValue("payouts", nextPayouts, { shouldValidate: true });
    form.setValue("losses", nextLosses, { shouldValidate: true });
  }, [form, participantCount, winnerCount]);

  const totalPayout = useMemo(() => payouts.reduce((sum, item) => sum + (item.amountVnd || 0), 0), [payouts]);
  const totalLoss = useMemo(() => losses.reduce((sum, item) => sum + (item.amountVnd || 0), 0), [losses]);
  const isBalanced = totalPayout === totalLoss;

  const previewLines = useMemo(() => {
    const lines: string[] = [`${participantCount}-player / ${winnerCount}-winner rule`];

    for (const payout of payouts) {
      lines.push(`rank${payout.relativeRank} gets ${formatAmountVnd(payout.amountVnd || 0)}`);
    }

    for (const loss of losses) {
      lines.push(`rank${loss.relativeRank} loses ${formatAmountVnd(loss.amountVnd || 0)}`);
    }

    if (penalties.length === 0) {
      lines.push("No penalty modifiers");
    } else {
      penalties.forEach((penalty) => {
        lines.push(
          toPenaltyPreview({
            absolutePlacement: penalty.absolutePlacement,
            amountVnd: penalty.amountVnd,
            destinationSelectorType: penalty.destinationSelectorType,
            destinationSelectorJson: parseRecordJson(penalty.destinationSelectorJsonText),
            code: penalty.code || undefined,
            name: penalty.name || undefined,
            description: penalty.description || undefined
          })
        );
      });
    }

    return lines;
  }, [losses, participantCount, penalties, payouts, winnerCount]);

  const addPenaltyPreset = (absolutePlacement: number) => {
    penaltiesFieldArray.append({
      absolutePlacement,
      amountVnd: 10000,
      destinationSelectorType: "BEST_PARTICIPANT",
      destinationSelectorJsonText: "",
      code: "",
      name: "",
      description: ""
    });
  };

  const submit = form.handleSubmit(async (values) => {
    setApiError(null);
    const payload: CreateRuleSetVersionRequest = {
      participantCountMin: values.participantCount,
      participantCountMax: values.participantCount,
      effectiveTo: values.effectiveTo || null,
      isActive: values.isActive,
      summaryJson: parseRecordJson(values.summaryJsonText),
      builderType: "MATCH_STAKES_PAYOUT",
      builderConfig: {
        participantCount: values.participantCount,
        winnerCount: values.winnerCount,
        payouts: values.payouts.map((item: { relativeRank: number; amountVnd: number }) => ({
          relativeRank: item.relativeRank,
          amountVnd: item.amountVnd
        })),
        losses: values.losses.map((item: { relativeRank: number; amountVnd: number }) => ({
          relativeRank: item.relativeRank,
          amountVnd: item.amountVnd
        })),
        penalties: values.penalties.map((penalty: MatchStakesVersionBuilderValues["penalties"][number]) => ({
          absolutePlacement: penalty.absolutePlacement,
          amountVnd: penalty.amountVnd,
          destinationSelectorType: penalty.destinationSelectorType,
          destinationSelectorJson: parseRecordJson(penalty.destinationSelectorJsonText),
          code: penalty.code || undefined,
          name: penalty.name || undefined,
          description: penalty.description || undefined
        }))
      }
    };

    try {
      const created = await createMutation.mutateAsync(payload);
      message.success("Version created from Match Stakes builder");
      navigate(`/rules/${ruleSet.id}/versions/${created.id}`);
    } catch (error) {
      setApiError(getErrorMessage(toAppError(error)));
    }
  });

  return (
    <form className="space-y-5" onSubmit={submit}>
      {prefill ? (
        <Alert
          showIcon
          type="info"
          message={`Prefilled from version v${prefill.sourceVersionNo}`}
          description="Review and adjust business config, then create a new immutable version."
        />
      ) : null}
      <FormApiError message={apiError} />

      <SectionCard title="Basic Info" description="Version metadata and participant model">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Participant count</label>
            <Controller
              control={form.control}
              name="participantCount"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onChange={(value: 3 | 4) => field.onChange(value)}
                  options={[
                    { label: "3 players", value: 3 },
                    { label: "4 players", value: 4 }
                  ]}
                  size="large"
                />
              )}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Winner count</label>
            <Controller
              control={form.control}
              name="winnerCount"
              render={({ field }) => (
                <Select value={field.value} onChange={(value) => field.onChange(value)} options={toWinnerOptions(participantCount)} size="large" />
              )}
            />
            {form.formState.errors.winnerCount ? (
              <div className="mt-1 text-xs text-red-600">{form.formState.errors.winnerCount.message}</div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Effective to (optional)</label>
            <Controller
              control={form.control}
              name="effectiveTo"
              render={({ field }) => (
                <DatePicker
                  className="w-full"
                  showTime
                  size="large"
                  value={field.value ? dayjs(field.value) : null}
                  onChange={(value) => field.onChange(value ? value.toISOString() : "")}
                />
              )}
            />
          </div>

          <div className="flex items-end">
            <div className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-2.5">
              <span className="text-sm font-medium">Version active</span>
              <Controller
                control={form.control}
                name="isActive"
                render={({ field }) => <Switch checked={field.value} onChange={field.onChange} />}
              />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium">Summary JSON (optional)</label>
          <Controller
            control={form.control}
            name="summaryJsonText"
            render={({ field }) => <Input.TextArea {...field} rows={3} placeholder='{"note": "optional"}' />}
          />
          {form.formState.errors.summaryJsonText ? (
            <div className="mt-1 text-xs text-red-600">{form.formState.errors.summaryJsonText.message}</div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="Winners & Payouts" description="Configure payout amount per winner rank">
        <div className="space-y-3">
          {payouts.map((item, index) => (
            <div key={`payout-${item.relativeRank}`} className="grid grid-cols-[120px_1fr] gap-3">
              <div className="flex items-center rounded-lg bg-slate-50 px-3 text-sm font-medium">Rank {item.relativeRank}</div>
              <Controller
                control={form.control}
                name={`payouts.${index}.amountVnd`}
                render={({ field }) => (
                  <InputNumber
                    min={1}
                    precision={0}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? 0)}
                    className="w-full"
                    addonAfter="VND"
                  />
                )}
              />
            </div>
          ))}
          {form.formState.errors.payouts?.message ? (
            <div className="text-xs text-red-600">{form.formState.errors.payouts.message}</div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="Losers & Losses" description="Configure base loss amount for non-winner ranks">
        <div className="space-y-3">
          {losses.map((item, index) => (
            <div key={`loss-${item.relativeRank}`} className="grid grid-cols-[120px_1fr] gap-3">
              <div className="flex items-center rounded-lg bg-slate-50 px-3 text-sm font-medium">Rank {item.relativeRank}</div>
              <Controller
                control={form.control}
                name={`losses.${index}.amountVnd`}
                render={({ field }) => (
                  <InputNumber
                    min={1}
                    precision={0}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? 0)}
                    className="w-full"
                    addonAfter="VND"
                  />
                )}
              />
            </div>
          ))}
          {form.formState.errors.losses?.message ? (
            <div className="text-xs text-red-600">{form.formState.errors.losses.message}</div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title="Penalties"
        description="Optional absolute TFT placement penalties"
        actions={
          <Space>
            <Button icon={<PlusOutlined />} onClick={() => addPenaltyPreset(2)}>
              Add top2 penalty
            </Button>
            <Button icon={<PlusOutlined />} onClick={() => addPenaltyPreset(8)}>
              Add top8 penalty
            </Button>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() =>
                penaltiesFieldArray.append({
                  absolutePlacement: 1,
                  amountVnd: 10000,
                  destinationSelectorType: "BEST_PARTICIPANT",
                  destinationSelectorJsonText: "",
                  code: "",
                  name: "",
                  description: ""
                })
              }
            >
              Custom penalty
            </Button>
          </Space>
        }
      >
        {penaltiesFieldArray.fields.length === 0 ? (
          <Alert type="info" showIcon message="No penalties. Base payouts/losses will be used." />
        ) : (
          <div className="space-y-4">
            {penaltiesFieldArray.fields.map((field, index) => (
              <Card key={field.id} size="small" className="!bg-slate-50">
                <div className="mb-3 flex items-center justify-between">
                  <Tag>{`Penalty #${index + 1}`}</Tag>
                  <Button danger icon={<DeleteOutlined />} onClick={() => penaltiesFieldArray.remove(index)} />
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium">Absolute placement (1..8)</label>
                    <Controller
                      control={form.control}
                      name={`penalties.${index}.absolutePlacement`}
                      render={({ field: formField }) => (
                        <InputNumber
                          min={1}
                          max={8}
                          precision={0}
                          value={formField.value}
                          onChange={(value) => formField.onChange(value ?? 1)}
                          className="w-full"
                        />
                      )}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium">Amount</label>
                    <Controller
                      control={form.control}
                      name={`penalties.${index}.amountVnd`}
                      render={({ field: formField }) => (
                        <InputNumber
                          min={1}
                          precision={0}
                          value={formField.value}
                          onChange={(value) => formField.onChange(value ?? 0)}
                          className="w-full"
                          addonAfter="VND"
                        />
                      )}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium">Destination selector</label>
                    <Controller
                      control={form.control}
                      name={`penalties.${index}.destinationSelectorType`}
                      render={({ field: formField }) => (
                        <Select value={formField.value} onChange={formField.onChange} options={destinationTypeOptions} />
                      )}
                    />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Controller
                    control={form.control}
                    name={`penalties.${index}.code`}
                    render={({ field: formField }) => <Input {...formField} placeholder="Penalty code (optional)" />}
                  />
                  <Controller
                    control={form.control}
                    name={`penalties.${index}.name`}
                    render={({ field: formField }) => <Input {...formField} placeholder="Penalty name (optional)" />}
                  />
                </div>

                <div className="mt-3">
                  <Controller
                    control={form.control}
                    name={`penalties.${index}.description`}
                    render={({ field: formField }) => <Input.TextArea {...formField} rows={2} placeholder="Description (optional)" />}
                  />
                </div>

                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium">Destination selector JSON (optional)</label>
                  <Controller
                    control={form.control}
                    name={`penalties.${index}.destinationSelectorJsonText`}
                    render={({ field: formField }) => (
                      <Input.TextArea {...formField} rows={2} placeholder='{"playerId": "..."}' />
                    )}
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Settlement Summary" description="Validation and human-readable preview before submit">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs text-slate-500">Total payout</div>
            <div className="text-base font-semibold">{formatAmountVnd(totalPayout)} VND</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs text-slate-500">Total loss</div>
            <div className="text-base font-semibold">{formatAmountVnd(totalLoss)} VND</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs text-slate-500">Balance status</div>
            <div className={`text-base font-semibold ${isBalanced ? "text-green-600" : "text-red-600"}`}>
              {isBalanced ? "Balanced" : "Unbalanced"}
            </div>
          </div>
        </div>

        <Alert
          className="mt-4"
          type={isBalanced ? "success" : "error"}
          showIcon
          message={isBalanced ? "Base payouts and losses are balanced." : "Cannot submit until total payouts equals total losses."}
        />

        <Divider />

        <Typography.Title level={5}>Preview</Typography.Title>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          {previewLines.map((line, index) => (
            <li key={`${index}-${line}`}>{line}</li>
          ))}
        </ul>
      </SectionCard>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
        <Button onClick={() => navigate(`/rules/${ruleSet.id}`)}>Cancel</Button>
        <Button htmlType="submit" type="primary" loading={createMutation.isPending} disabled={!isBalanced}>
          Create Version
        </Button>
      </div>
    </form>
  );
};

interface RawVersionFormProps {
  ruleSet: RuleSetDetailDto;
}

const RawVersionForm = ({ ruleSet }: RawVersionFormProps) => {
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);
  const createMutation = useCreateRuleSetVersion(ruleSet.id);

  const form = useForm<RawRuleSetVersionValues>({
    resolver: zodResolver(rawRuleSetVersionSchema),
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

  const submit = form.handleSubmit(async (values) => {
    setApiError(null);
    try {
      const created = await createMutation.mutateAsync({
        participantCountMin: values.participantCountMin,
        participantCountMax: values.participantCountMax,
        effectiveTo: values.effectiveTo || null,
        isActive: values.isActive,
        summaryJson: parseRecordJson(values.summaryJsonText),
        rules: values.rules.map((rule) => ({
          code: rule.code,
          name: rule.name,
          description: rule.description || null,
          ruleKind: rule.ruleKind,
          priority: rule.priority,
          status: rule.status,
          stopProcessingOnMatch: rule.stopProcessingOnMatch,
          metadata: parseRecordJson(rule.metadataText),
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

      message.success("Raw version created");
      navigate(`/rules/${ruleSet.id}/versions/${created.id}`);
    } catch (error) {
      setApiError(getErrorMessage(toAppError(error)));
    }
  });

  return (
    <FormProvider {...form}>
      <form className="space-y-4" onSubmit={submit}>
        <Alert
          showIcon
          type="warning"
          message="This module currently uses raw rule mode"
          description="Builder mode is reserved for MATCH_STAKES. Use raw rules only for advanced or legacy workflows."
        />

        <FormApiError message={apiError} />

        <SectionCard title="Version Metadata">
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
        </SectionCard>

        <SectionCard title="Raw Rules">
          <RuleBuilder />
        </SectionCard>

        <div className="flex justify-end">
          <Button htmlType="submit" type="primary" size="large" loading={createMutation.isPending}>
            Create Version
          </Button>
        </div>
      </form>
    </FormProvider>
  );
};

export const RuleSetVersionCreatePage = () => {
  const { ruleSetId } = useParams();
  const [searchParams] = useSearchParams();
  const fromVersionId = searchParams.get("fromVersionId") ?? undefined;
  const detailQuery = useRuleSetDetail(ruleSetId);
  const prefillVersionQuery = useRuleSetVersionDetail(ruleSetId, fromVersionId);

  if (!ruleSetId) {
    return <ErrorState title="Missing rule set id" />;
  }

  if (detailQuery.isLoading) {
    return <PageLoading label="Loading rule set..." />;
  }

  if (detailQuery.isError || !detailQuery.data) {
    return <ErrorState onRetry={() => void detailQuery.refetch()} />;
  }

  const ruleSet = detailQuery.data;
  const prefillConfig = useMemo(() => {
    if (!fromVersionId || !prefillVersionQuery.data) {
      return null;
    }

    if (prefillVersionQuery.data.builderType !== "MATCH_STAKES_PAYOUT") {
      return null;
    }

    const normalized = normalizeMatchStakesBuilderConfig(prefillVersionQuery.data.builderConfig);
    if (!normalized) {
      return null;
    }

    return {
      sourceVersionNo: prefillVersionQuery.data.versionNo,
      participantCount: normalized.participantCount,
      winnerCount: normalized.winnerCount,
      payouts: normalized.payouts,
      losses: normalized.losses,
      penalties: (normalized.penalties ?? []).map((penalty) => ({
        absolutePlacement: penalty.absolutePlacement,
        amountVnd: penalty.amountVnd,
        destinationSelectorType: penalty.destinationSelectorType ?? "BEST_PARTICIPANT",
        destinationSelectorJsonText: penalty.destinationSelectorJson ? JSON.stringify(penalty.destinationSelectorJson, null, 2) : "",
        code: penalty.code ?? "",
        name: penalty.name ?? "",
        description: penalty.description ?? ""
      })),
      isActive: prefillVersionQuery.data.isActive,
      effectiveTo: prefillVersionQuery.data.effectiveTo ?? "",
      summaryJsonText: prefillVersionQuery.data.summaryJson ? JSON.stringify(prefillVersionQuery.data.summaryJson, null, 2) : ""
    };
  }, [fromVersionId, prefillVersionQuery.data]);

  const hasPrefillWarning =
    Boolean(fromVersionId) &&
    !prefillVersionQuery.isLoading &&
    (!prefillVersionQuery.data || prefillVersionQuery.data.builderType !== "MATCH_STAKES_PAYOUT" || !prefillConfig);

  if (ruleSet.module === "MATCH_STAKES" && fromVersionId && prefillVersionQuery.isLoading) {
    return <PageLoading label="Loading source version for prefill..." />;
  }

  return (
    <PageContainer>
      <RulesBreadcrumb
        items={[
          { label: "Rules", to: "/rules" },
          { label: ruleSet.name, to: `/rules/${ruleSetId}` },
          { label: "Create Version" }
        ]}
      />

      <PageHeader
        title="Create Rule Set Version"
        subtitle={`Rule set ${ruleSet.code} (${moduleLabels[ruleSet.module]})`}
      />

      {hasPrefillWarning ? (
        <Alert
          showIcon
          type="warning"
          message="Could not prefill from source version"
          description="The selected source version is unavailable or is not a MATCH_STAKES builder version."
        />
      ) : null}

      {ruleSet.module === "MATCH_STAKES" ? (
        <MatchStakesBuilderForm ruleSet={ruleSet} prefill={prefillConfig} />
      ) : (
        <RawVersionForm ruleSet={ruleSet} />
      )}
    </PageContainer>
  );
};
