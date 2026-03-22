import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Collapse,
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
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import {
  matchStakesRuleCreateFlowSchema,
  parseJsonOrDefault,
  type MatchStakesRuleCreateFlowValues
} from "@/features/rules/schemas";
import { useCreateRuleSet, useCreateRuleSetVersionById } from "@/features/rules/hooks";
import { formatAmountVnd, formatPenaltyDestination } from "@/features/rules/builder-utils";
import { FormApiError } from "@/components/common/FormApiError";
import { SectionCard } from "@/components/layout/SectionCard";
import { getErrorMessage } from "@/lib/error-messages";
import { toAppError } from "@/api/httpClient";
import type {
  CreateRuleSetVersionRequest,
  MatchStakesPenaltyConfig,
  MatchStakesPenaltyDestinationSelectorType,
  RuleSetDto
} from "@/types/api";

const winnerOptionsByParticipant = {
  3: [
    { label: "1 winner (common)", value: 1 },
    { label: "2 winners", value: 2 }
  ],
  4: [
    { label: "1 winner", value: 1 },
    { label: "2 winners (common)", value: 2 },
    { label: "3 winners", value: 3 }
  ]
} as const;

const destinationTypeOptions: Array<{ label: string; value: MatchStakesPenaltyDestinationSelectorType }> = [
  { label: "Best participant", value: "BEST_PARTICIPANT" },
  { label: "Match winner", value: "MATCH_WINNER" },
  { label: "Fixed player", value: "FIXED_PLAYER" },
  { label: "Fund account", value: "FUND_ACCOUNT" }
];

const defaultWinnerCount = (participantCount: 3 | 4) => (participantCount === 3 ? 1 : 2);

const buildRankAmounts = (
  start: number,
  end: number,
  existing: Array<{ relativeRank: number; amountVnd: number }>
): Array<{ relativeRank: number; amountVnd: number }> => {
  const existingMap = new Map(existing.map((item) => [item.relativeRank, item.amountVnd]));
  const rows: Array<{ relativeRank: number; amountVnd: number }> = [];

  for (let rank = start; rank <= end; rank += 1) {
    rows.push({
      relativeRank: rank,
      amountVnd: existingMap.get(rank) ?? 0
    });
  }

  return rows;
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

interface Step2RecoveryState {
  createdRuleSet: RuleSetDto;
  versionPayload: CreateRuleSetVersionRequest;
  errorMessage: string;
}

export const MatchStakesRuleCreateFlow = () => {
  const navigate = useNavigate();
  const createRuleSetMutation = useCreateRuleSet();
  const createVersionMutation = useCreateRuleSetVersionById();

  const [apiError, setApiError] = useState<string | null>(null);
  const [step2Recovery, setStep2Recovery] = useState<Step2RecoveryState | null>(null);

  const form = useForm<MatchStakesRuleCreateFlowValues>({
    resolver: zodResolver(matchStakesRuleCreateFlowSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      status: "ACTIVE",
      isDefault: false,
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
  const status = useWatch({ control: form.control, name: "status" });
  const isDefault = useWatch({ control: form.control, name: "isDefault" });
  const isVersionActive = useWatch({ control: form.control, name: "isActive" });

  const penaltiesFieldArray = useFieldArray({
    control: form.control,
    name: "penalties"
  });

  useEffect(() => {
    const recommended = defaultWinnerCount(participantCount);
    if (winnerCount >= participantCount || winnerCount < 1) {
      form.setValue("winnerCount", recommended, { shouldValidate: true });
    }
  }, [form, participantCount, winnerCount]);

  useEffect(() => {
    form.setValue("payouts", buildRankAmounts(1, winnerCount, payouts), { shouldValidate: true });
    form.setValue("losses", buildRankAmounts(winnerCount + 1, participantCount, losses), { shouldValidate: true });
  }, [form, participantCount, winnerCount]);

  const totalPayout = useMemo(() => payouts.reduce((sum, item) => sum + (item.amountVnd || 0), 0), [payouts]);
  const totalLoss = useMemo(() => losses.reduce((sum, item) => sum + (item.amountVnd || 0), 0), [losses]);
  const isBalanced = totalPayout === totalLoss;

  const reviewPenaltyLines = useMemo(() => {
    if (!penalties.length) {
      return ["No special penalties"];
    }

    return penalties.map(
      (penalty) =>
        `Top ${penalty.absolutePlacement} pays extra ${formatAmountVnd(penalty.amountVnd)} to ${formatPenaltyDestination(
          penalty.destinationSelectorType
        )}`
    );
  }, [penalties]);

  const createVersionPayload = (values: MatchStakesRuleCreateFlowValues): CreateRuleSetVersionRequest => ({
    participantCountMin: values.participantCount,
    participantCountMax: values.participantCount,
    effectiveTo: values.effectiveTo || null,
    isActive: values.isActive,
    summaryJson: parseRecordJson(values.summaryJsonText),
    builderType: "MATCH_STAKES_PAYOUT",
    builderConfig: {
      participantCount: values.participantCount,
      winnerCount: values.winnerCount,
      payouts: values.payouts.map((item) => ({ relativeRank: item.relativeRank, amountVnd: item.amountVnd })),
      losses: values.losses.map((item) => ({ relativeRank: item.relativeRank, amountVnd: item.amountVnd })),
      penalties: values.penalties.map((penalty) => ({
        absolutePlacement: penalty.absolutePlacement,
        amountVnd: penalty.amountVnd,
        destinationSelectorType: penalty.destinationSelectorType,
        destinationSelectorJson: parseRecordJson(penalty.destinationSelectorJsonText),
        code: penalty.code || undefined,
        name: penalty.name || undefined,
        description: penalty.description || undefined
      }))
    }
  });

  const submit = form.handleSubmit(async (values) => {
    setApiError(null);
    setStep2Recovery(null);

    try {
      const createdRuleSet = await createRuleSetMutation.mutateAsync({
        module: "MATCH_STAKES",
        code: values.code,
        name: values.name,
        description: values.description || null,
        status: values.status,
        isDefault: values.isDefault
      });

      const versionPayload = createVersionPayload(values);

      try {
        const createdVersion = await createVersionMutation.mutateAsync({
          ruleSetId: createdRuleSet.id,
          payload: versionPayload
        });

        message.success("Match Stakes rule created successfully");
        navigate(`/rules/${createdRuleSet.id}/versions/${createdVersion.id}`);
      } catch (step2Error) {
        const errorMessage = getErrorMessage(toAppError(step2Error));
        setApiError(
          `Rule set metadata was created, but version creation failed. You can retry version creation or open the created rule set.`
        );
        setStep2Recovery({ createdRuleSet, versionPayload, errorMessage });
      }
    } catch (error) {
      setApiError(getErrorMessage(toAppError(error)));
    }
  });

  const retryStep2 = async () => {
    if (!step2Recovery) {
      return;
    }

    try {
      const createdVersion = await createVersionMutation.mutateAsync({
        ruleSetId: step2Recovery.createdRuleSet.id,
        payload: step2Recovery.versionPayload
      });

      message.success("Version creation retried successfully");
      navigate(`/rules/${step2Recovery.createdRuleSet.id}/versions/${createdVersion.id}`);
    } catch (error) {
      setApiError("Retry failed. Please review the error and use Open Rule Set Detail if needed.");
      setStep2Recovery((current) =>
        current
          ? {
              ...current,
              errorMessage: getErrorMessage(toAppError(error))
            }
          : null
      );
    }
  };

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

  return (
    <form className="space-y-5" onSubmit={submit}>
      <FormApiError message={apiError} />

      {step2Recovery ? (
        <Alert
          type="error"
          showIcon
          message="Rule set was created, but version creation failed"
          description={
            <div className="space-y-2">
              <div>{step2Recovery.errorMessage}</div>
              <div>{`Created rule set: ${step2Recovery.createdRuleSet.name} (${step2Recovery.createdRuleSet.code})`}</div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void retryStep2()} loading={createVersionMutation.isPending}>
                  Retry Version Creation
                </Button>
                <Button onClick={() => navigate(`/rules/${step2Recovery.createdRuleSet.id}`)}>Open Rule Set Detail</Button>
              </div>
            </div>
          }
        />
      ) : null}

      <SectionCard title="Basic Info" description="Business information for this Match Stakes rule">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Rule name</label>
            <Controller control={form.control} name="name" render={({ field }) => <Input {...field} size="large" placeholder="Sunday Squad Rule" />} />
            {form.formState.errors.name ? <div className="mt-1 text-xs text-red-600">{form.formState.errors.name.message}</div> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Code</label>
            <Controller control={form.control} name="code" render={({ field }) => <Input {...field} size="large" placeholder="MS_3P_STANDARD" />} />
            {form.formState.errors.code ? <div className="mt-1 text-xs text-red-600">{form.formState.errors.code.message}</div> : null}
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium">Description (optional)</label>
          <Controller control={form.control} name="description" render={({ field }) => <Input.TextArea {...field} rows={3} />} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Rule set status</label>
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { label: "Active", value: "ACTIVE" },
                    { label: "Inactive", value: "INACTIVE" }
                  ]}
                />
              )}
            />
          </div>

          <div className="flex items-end">
            <div className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-2.5">
              <span className="text-sm font-medium">Set as default</span>
              <Controller control={form.control} name="isDefault" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} />} />
            </div>
          </div>

          <div className="flex items-end">
            <div className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-2.5">
              <span className="text-sm font-medium">Activate version now</span>
              <Controller control={form.control} name="isActive" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} />} />
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Match Setup" description="Choose participants and winner count">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Participant count</label>
            <Controller
              control={form.control}
              name="participantCount"
              render={({ field }) => (
                <Select
                  size="large"
                  value={field.value}
                  onChange={(value: 3 | 4) => field.onChange(value)}
                  options={[
                    { label: "3 players", value: 3 },
                    { label: "4 players", value: 4 }
                  ]}
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
                <Select size="large" value={field.value} onChange={field.onChange} options={[...winnerOptionsByParticipant[participantCount]]} />
              )}
            />
            {form.formState.errors.winnerCount ? (
              <div className="mt-1 text-xs text-red-600">{form.formState.errors.winnerCount.message}</div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Version effective to (optional)</label>
            <Controller
              control={form.control}
              name="effectiveTo"
              render={({ field }) => (
                <DatePicker
                  className="w-full"
                  showTime
                  value={field.value ? dayjs(field.value) : null}
                  onChange={(value) => field.onChange(value ? value.toISOString() : "")}
                />
              )}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Summary JSON (optional)</label>
            <Controller
              control={form.control}
              name="summaryJsonText"
              render={({ field }) => <Input.TextArea {...field} rows={2} placeholder='{"note":"optional"}' />}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Base Payouts and Losses" description="Configure winner payouts and loser losses by relative rank">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Winners" className="!border-emerald-200 !bg-emerald-50/40">
            <div className="space-y-3">
              {payouts.map((item, index) => (
                <div key={`payout-${item.relativeRank}`} className="grid grid-cols-[120px_1fr] gap-3">
                  <div className="flex items-center rounded-lg bg-white px-3 text-sm font-medium text-emerald-700">Rank {item.relativeRank}</div>
                  <Controller
                    control={form.control}
                    name={`payouts.${index}.amountVnd`}
                    render={({ field }) => (
                      <InputNumber min={1} precision={0} value={field.value} onChange={(value) => field.onChange(value ?? 0)} className="w-full" addonAfter="VND" />
                    )}
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Losers" className="!border-rose-200 !bg-rose-50/40">
            <div className="space-y-3">
              {losses.map((item, index) => (
                <div key={`loss-${item.relativeRank}`} className="grid grid-cols-[120px_1fr] gap-3">
                  <div className="flex items-center rounded-lg bg-white px-3 text-sm font-medium text-rose-700">Rank {item.relativeRank}</div>
                  <Controller
                    control={form.control}
                    name={`losses.${index}.amountVnd`}
                    render={({ field }) => (
                      <InputNumber min={1} precision={0} value={field.value} onChange={(value) => field.onChange(value ?? 0)} className="w-full" addonAfter="VND" />
                    )}
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs text-slate-500">Total payouts</div>
            <div className="text-base font-semibold">{formatAmountVnd(totalPayout)} VND</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs text-slate-500">Total losses</div>
            <div className="text-base font-semibold">{formatAmountVnd(totalLoss)} VND</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs text-slate-500">Balance</div>
            <div className={`text-base font-semibold ${isBalanced ? "text-green-600" : "text-red-600"}`}>{isBalanced ? "Balanced" : "Unbalanced"}</div>
          </div>
        </div>

        <Alert
          className="mt-3"
          type={isBalanced ? "success" : "error"}
          showIcon
          message={isBalanced ? "Base payouts/losses are balanced." : "Total payouts and losses must be equal."}
        />
      </SectionCard>

      <SectionCard
        title="Special Penalties"
        description="Extra penalties by TFT absolute placement"
        actions={
          <Space wrap>
            <Button icon={<PlusOutlined />} onClick={() => addPenaltyPreset(2)}>Add top2 penalty</Button>
            <Button icon={<PlusOutlined />} onClick={() => addPenaltyPreset(8)}>Add top8 penalty</Button>
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
              Add custom penalty
            </Button>
          </Space>
        }
      >
        {penaltiesFieldArray.fields.length === 0 ? (
          <Alert showIcon type="info" message="No penalty rows. Add one only when you need special top-X cases." />
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
                      render={({ field: penaltyField }) => (
                        <InputNumber min={1} max={8} precision={0} value={penaltyField.value} onChange={(value) => penaltyField.onChange(value ?? 1)} className="w-full" />
                      )}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium">Amount</label>
                    <Controller
                      control={form.control}
                      name={`penalties.${index}.amountVnd`}
                      render={({ field: penaltyField }) => (
                        <InputNumber min={1} precision={0} value={penaltyField.value} onChange={(value) => penaltyField.onChange(value ?? 0)} className="w-full" addonAfter="VND" />
                      )}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium">Destination selector</label>
                    <Controller
                      control={form.control}
                      name={`penalties.${index}.destinationSelectorType`}
                      render={({ field: penaltyField }) => <Select value={penaltyField.value} onChange={penaltyField.onChange} options={destinationTypeOptions} />}
                    />
                  </div>
                </div>

                <Collapse
                  className="mt-3"
                  items={[
                    {
                      key: "advanced",
                      label: "Advanced fields (optional)",
                      children: (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <Controller
                              control={form.control}
                              name={`penalties.${index}.code`}
                              render={({ field: penaltyField }) => <Input {...penaltyField} placeholder="Penalty code" />}
                            />
                            <Controller
                              control={form.control}
                              name={`penalties.${index}.name`}
                              render={({ field: penaltyField }) => <Input {...penaltyField} placeholder="Penalty name" />}
                            />
                          </div>

                          <Controller
                            control={form.control}
                            name={`penalties.${index}.description`}
                            render={({ field: penaltyField }) => <Input.TextArea {...penaltyField} rows={2} placeholder="Description" />}
                          />

                          <Controller
                            control={form.control}
                            name={`penalties.${index}.destinationSelectorJsonText`}
                            render={({ field: penaltyField }) => <Input.TextArea {...penaltyField} rows={2} placeholder='{"playerId": "..."}' />}
                          />
                        </div>
                      )
                    }
                  ]}
                />
              </Card>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Review and Submit" description="Final check before creating this Match Stakes rule">
        <div className="space-y-3 text-sm text-slate-700">
          <div className="flex flex-wrap gap-2">
            <Tag color="blue">Module: MATCH_STAKES</Tag>
            <Tag color={status === "ACTIVE" ? "green" : "default"}>Rule Set: {status}</Tag>
            <Tag color={isVersionActive ? "green" : "default"}>Version: {isVersionActive ? "Active" : "Inactive"}</Tag>
            <Tag color={isDefault ? "processing" : "default"}>{isDefault ? "Default" : "Non-default"}</Tag>
          </div>

          <div>{`${participantCount} players, ${winnerCount} winner${winnerCount > 1 ? "s" : ""}`}</div>
          <div>{`Payouts: ${payouts.map((item) => `R${item.relativeRank} +${formatAmountVnd(item.amountVnd)}`).join(" | ")}`}</div>
          <div>{`Losses: ${losses.map((item) => `R${item.relativeRank} -${formatAmountVnd(item.amountVnd)}`).join(" | ")}`}</div>
          <div className="space-y-1">
            <div>Penalties:</div>
            {reviewPenaltyLines.map((line, index) => (
              <div key={`${index}-${line}`} className="pl-3 text-xs text-slate-600">
                - {line}
              </div>
            ))}
          </div>
        </div>

        <Divider />

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button onClick={() => navigate("/rules")}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={createRuleSetMutation.isPending || createVersionMutation.isPending} disabled={!isBalanced}>
            Create Match Stakes Rule
          </Button>
        </div>
      </SectionCard>

      {!isBalanced ? (
        <Typography.Text type="danger">Submission is disabled until total payouts equals total losses.</Typography.Text>
      ) : null}
    </form>
  );
};
