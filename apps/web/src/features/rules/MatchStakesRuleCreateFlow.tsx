import { useEffect, useMemo, useState } from "react";
import { Card, Typography, message } from "antd";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import type { CreateRuleSetVersionRequest, RuleSetDto } from "@/types/api";
import { FormApiError } from "@/components/common/FormApiError";
import { SectionCard } from "@/components/layout/SectionCard";
import { toAppError } from "@/api/httpClient";
import { getErrorMessage } from "@/lib/error-messages";
import {
  formatAmountVnd,
  formatPenaltyDestination
} from "@/features/rules/builder-utils";
import {
  CurrencyAmountInput,
  PenaltyList,
  ReviewSummaryCard,
  RuleBasicInfoSection,
  RuleFormFooter,
  RuleMatchSetupSection
} from "@/features/rules/create-flow/components";
import {
  buildRankAmounts,
  computeTopWinnerPayout,
  defaultWinnerCount,
  formatRankAmountList,
  sameRankAmounts,
  sumAmounts,
  winnerOptionsByParticipant
} from "@/features/rules/create-flow/utils";
import {
  matchStakesRuleCreateFlowSchema,
  type MatchStakesRuleCreateFlowValues
} from "@/features/rules/schemas";
import {
  useCreateRuleSet,
  useUpdateRuleSet
} from "@/features/rules/hooks";

interface MatchStakesRuleEditContext {
  ruleSet: RuleSetDto;
  initialValues?: Partial<MatchStakesRuleCreateFlowValues>;
}

interface MatchStakesRuleCreateFlowProps {
  editContext?: MatchStakesRuleEditContext;
}

const defaultValues: MatchStakesRuleCreateFlowValues = {
  name: "",
  description: "",
  isDefault: false,
  participantCount: 3,
  winnerCount: 1,
  winnerPayouts: [],
  losses: [
    { relativeRank: 2, amountVnd: 0 },
    { relativeRank: 3, amountVnd: 0 }
  ],
  penalties: []
};

export const MatchStakesRuleCreateFlow = ({
  editContext
}: MatchStakesRuleCreateFlowProps = {}) => {
  const navigate = useNavigate();
  const isEditMode = Boolean(editContext);
  const createRuleSetMutation = useCreateRuleSet();
  const updateRuleSetMutation = useUpdateRuleSet(editContext?.ruleSet.id ?? "");

  const [apiError, setApiError] = useState<string | null>(null);

  const form = useForm<MatchStakesRuleCreateFlowValues>({
    resolver: zodResolver(matchStakesRuleCreateFlowSchema),
    mode: "onChange",
    defaultValues
  });

  const participantCount = useWatch({
    control: form.control,
    name: "participantCount"
  });
  const winnerCount = useWatch({ control: form.control, name: "winnerCount" });
  const winnerPayouts = useWatch({ control: form.control, name: "winnerPayouts" }) ?? [];
  const losses = useWatch({ control: form.control, name: "losses" }) ?? [];
  const penalties = useWatch({ control: form.control, name: "penalties" }) ?? [];
  const isDefault = useWatch({ control: form.control, name: "isDefault" });

  const penaltiesFieldArray = useFieldArray({
    control: form.control,
    name: "penalties"
  });

  useEffect(() => {
    if (!editContext?.initialValues) {
      return;
    }

    form.reset({
      ...defaultValues,
      ...editContext.initialValues,
      description: editContext.initialValues.description ?? ""
    });
  }, [editContext?.initialValues, form]);

  useEffect(() => {
    const recommended = defaultWinnerCount(participantCount);
    if (winnerCount >= participantCount || winnerCount < 1) {
      form.setValue("winnerCount", recommended, { shouldValidate: true });
    }
  }, [form, participantCount, winnerCount]);

  useEffect(() => {
    const expectedWinnerRows =
      winnerCount > 1 ? buildRankAmounts(2, winnerCount, winnerPayouts) : [];
    if (!sameRankAmounts(winnerPayouts, expectedWinnerRows)) {
      form.setValue("winnerPayouts", expectedWinnerRows, { shouldValidate: true });
    }

    const expectedLossRows = buildRankAmounts(winnerCount + 1, participantCount, losses);
    if (!sameRankAmounts(losses, expectedLossRows)) {
      form.setValue("losses", expectedLossRows, { shouldValidate: true });
    }
  }, [form, losses, participantCount, winnerCount, winnerPayouts]);

  const topWinnerPayout = useMemo(
    () => computeTopWinnerPayout(losses, winnerPayouts),
    [losses, winnerPayouts]
  );
  const payouts = useMemo(
    () => [{ relativeRank: 1, amountVnd: topWinnerPayout }, ...winnerPayouts],
    [topWinnerPayout, winnerPayouts]
  );
  const totalLoss = useMemo(() => sumAmounts(losses), [losses]);
  const totalPayout = useMemo(() => sumAmounts(payouts), [payouts]);
  const isBalanced = totalLoss === totalPayout;

  const topWinnerError =
    topWinnerPayout < 0
      ? "Top 1 payout is negative. Reduce lower winner payouts or increase loser amounts."
      : winnerCount > 1 &&
          topWinnerPayout <=
            (winnerPayouts.find((item) => item.relativeRank === 2)?.amountVnd ?? 0)
        ? "Top 1 payout must be greater than rank 2 payout."
        : null;

  const reviewPenaltyLines = useMemo(() => {
    if (!penalties.length) {
      return ["No special penalties"];
    }

    return penalties.map(
      (penalty) =>
        `Top ${penalty.absolutePlacement} pays extra ${formatAmountVnd(
          penalty.amountVnd
        )} to ${formatPenaltyDestination(penalty.destinationSelectorType)}`
    );
  }, [penalties]);

  const createVersionPayload = (
    values: MatchStakesRuleCreateFlowValues
  ): CreateRuleSetVersionRequest => {
    const computedTopPayout = computeTopWinnerPayout(values.losses, values.winnerPayouts);

    return {
      participantCountMin: values.participantCount,
      participantCountMax: values.participantCount,
      effectiveTo: null,
      isActive: true,
      summaryJson: null,
      builderType: "MATCH_STAKES_PAYOUT",
      builderConfig: {
        participantCount: values.participantCount,
        winnerCount: values.winnerCount,
        payouts: [{ relativeRank: 1, amountVnd: computedTopPayout }, ...values.winnerPayouts].map(
          (item) => ({
            relativeRank: item.relativeRank,
            amountVnd: item.amountVnd
          })
        ),
        losses: values.losses.map((item) => ({
          relativeRank: item.relativeRank,
          amountVnd: item.amountVnd
        })),
        penalties: values.penalties.map((penalty) => ({
          absolutePlacement: penalty.absolutePlacement,
          amountVnd: penalty.amountVnd,
          destinationSelectorType: penalty.destinationSelectorType
        }))
      }
    };
  };

  const submit = form.handleSubmit(async (values) => {
    setApiError(null);
    const versionPayload = createVersionPayload(values);

    if (editContext) {
      try {
        const updatedRuleSet = await updateRuleSetMutation.mutateAsync({
          name: values.name,
          isDefault: values.isDefault,
          description: values.description || null,
          ...versionPayload
        });

        if (updatedRuleSet.latestVersion?.id) {
          message.success("Rule updated. New version created.");
          navigate(`/rules/${editContext.ruleSet.id}/versions/${updatedRuleSet.latestVersion.id}`);
        } else {
          message.success("Rule updated.");
          navigate(`/rules/${editContext.ruleSet.id}`);
        }
      } catch (error) {
        setApiError(getErrorMessage(toAppError(error)));
      }

      return;
    }

    try {
      const createdRuleSet = await createRuleSetMutation.mutateAsync({
        module: "MATCH_STAKES",
        name: values.name,
        status: "ACTIVE",
        isDefault: values.isDefault,
        description: values.description || null,
        ...versionPayload
      });

      if (createdRuleSet.latestVersion?.id) {
        message.success("Match Stakes rule created successfully");
        navigate(`/rules/${createdRuleSet.id}/versions/${createdRuleSet.latestVersion.id}`);
      } else {
        message.success("Match Stakes rule created successfully");
        navigate(`/rules/${createdRuleSet.id}`);
      }
    } catch (error) {
      setApiError(getErrorMessage(toAppError(error)));
    }
  });

  const handleCancel = () => {
    if (editContext) {
      navigate(`/rules/${editContext.ruleSet.id}`);
      return;
    }

    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/rules");
  };

  const winnerPayoutErrorMessage =
    form.formState.errors.winnerPayouts &&
    !Array.isArray(form.formState.errors.winnerPayouts)
      ? String(form.formState.errors.winnerPayouts.message ?? "")
      : "";
  const lossErrorMessage =
    form.formState.errors.losses && !Array.isArray(form.formState.errors.losses)
      ? String(form.formState.errors.losses.message ?? "")
      : "";

  const submitDisabled = !form.formState.isValid || !isBalanced || Boolean(topWinnerError);
  const submitLoading = isEditMode
    ? updateRuleSetMutation.isPending
    : createRuleSetMutation.isPending;

  return (
    <form className="space-y-5" onSubmit={submit}>
      <FormApiError message={apiError} />

      <RuleBasicInfoSection
        control={form.control}
        errors={form.formState.errors}
        description={
          isEditMode
            ? "Update business information and save this rule set as a new version."
            : "Business information for this Match Stakes rule"
        }
        hideCode
      />

      <RuleMatchSetupSection
        control={form.control}
        participantCountName="participantCount"
        winnerCountName="winnerCount"
        winnerOptions={[...winnerOptionsByParticipant[participantCount]]}
        winnerError={form.formState.errors.winnerCount?.message}
        description="Choose participant count and winner count"
      />

      <SectionCard
        title="Base Payouts and Losses"
        description="Enter loser amounts and lower winner payouts. Rank 1 payout is auto-calculated."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Winners" className="!border-emerald-200 !bg-emerald-50/40">
            <div className="space-y-3">
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <div className="flex items-center rounded-lg bg-white px-3 text-sm font-medium text-emerald-700">
                  Rank 1
                </div>
                <CurrencyAmountInput value={topWinnerPayout} disabled min={0} />
              </div>

              {winnerPayouts.length === 0 ? (
                <div className="text-xs text-slate-500">
                  No additional winner payout fields for the current winner count.
                </div>
              ) : (
                winnerPayouts.map((item, index) => (
                  <div
                    key={`winner-${item.relativeRank}`}
                    className="grid grid-cols-[120px_1fr] gap-3"
                  >
                    <div className="flex items-center rounded-lg bg-white px-3 text-sm font-medium text-emerald-700">
                      Rank {item.relativeRank}
                    </div>
                    <Controller
                      control={form.control}
                      name={`winnerPayouts.${index}.amountVnd`}
                      render={({ field }) => (
                        <CurrencyAmountInput
                          value={field.value}
                          onChange={field.onChange}
                          min={0}
                        />
                      )}
                    />
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card title="Losers" className="!border-rose-200 !bg-rose-50/40">
            <div className="space-y-3">
              {losses.map((item, index) => (
                <div
                  key={`loss-${item.relativeRank}`}
                  className="grid grid-cols-[120px_1fr] gap-3"
                >
                  <div className="flex items-center rounded-lg bg-white px-3 text-sm font-medium text-rose-700">
                    Rank {item.relativeRank}
                  </div>
                  <Controller
                    control={form.control}
                    name={`losses.${index}.amountVnd`}
                    render={({ field }) => (
                      <CurrencyAmountInput
                        value={field.value}
                        onChange={field.onChange}
                        min={0}
                      />
                    )}
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {winnerPayoutErrorMessage ? (
          <div className="mt-2 text-xs text-red-600">{winnerPayoutErrorMessage}</div>
        ) : null}
        {lossErrorMessage ? <div className="mt-2 text-xs text-red-600">{lossErrorMessage}</div> : null}
        {topWinnerError ? <div className="mt-2 text-xs text-red-600">{topWinnerError}</div> : null}
        {!topWinnerError && isBalanced ? (
          <Typography.Text className="mt-2 block text-xs text-slate-600">{`Auto-calculated top payout: ${formatAmountVnd(topWinnerPayout)} VND`}</Typography.Text>
        ) : null}
      </SectionCard>

      <PenaltyList
        control={form.control}
        fields={penaltiesFieldArray.fields}
        errors={form.formState.errors}
        onAdd={() =>
          penaltiesFieldArray.append({
            absolutePlacement: 1,
            amountVnd: 0,
            destinationSelectorType: "BEST_PARTICIPANT"
          })
        }
        onRemove={penaltiesFieldArray.remove}
      />

      <ReviewSummaryCard
        module="MATCH_STAKES"
        isDefault={isDefault}
        rows={[
          {
            label: "Match setup",
            value: `${participantCount} players, ${winnerCount} winner${
              winnerCount > 1 ? "s" : ""
            }`
          },
          {
            label: "Losers",
            value: formatRankAmountList(losses, "-")
          },
          {
            label: "Winners",
            value: formatRankAmountList(payouts, "+")
          },
          {
            label: "Penalties",
            value: (
              <div className="space-y-1">
                {reviewPenaltyLines.map((line) => (
                  <div key={line} className="text-xs text-slate-600">
                    {line}
                  </div>
                ))}
              </div>
            )
          }
        ]}
        footer={
          <RuleFormFooter
            onCancel={handleCancel}
            submitLabel={isEditMode ? "Save as New Version" : "Create Match Stakes Rule"}
            submitLoading={submitLoading}
            submitDisabled={submitDisabled}
          />
        }
      />

      {!isBalanced ? (
        <Typography.Text type="danger">
          Submission is disabled until payouts and losses are balanced.
        </Typography.Text>
      ) : null}
    </form>
  );
};
