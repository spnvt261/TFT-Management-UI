import { useEffect, useMemo, useState } from "react";
import { Button, Card, message } from "antd";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { FormApiError } from "@/components/common/FormApiError";
import { toAppError } from "@/api/httpClient";
import { getErrorMessage } from "@/lib/error-messages";
import type { CreateRuleSetVersionRequest, RuleInput, RuleSetDto } from "@/types/api";
import { formatAmountVnd } from "@/features/rules/builder-utils";
import {
  CurrencyAmountInput,
  RankPlacementSelect,
  ReviewSummaryCard,
  RuleBasicInfoSection,
  RuleFormFooter,
  RuleMatchSetupSection
} from "@/features/rules/create-flow/components";
import {
  buildRankAmounts,
  formatRankAmountList,
  sameRankAmounts,
  sumAmounts
} from "@/features/rules/create-flow/utils";
import {
  groupFundRuleCreateFlowSchema,
  type GroupFundRuleCreateFlowValues
} from "@/features/rules/schemas";
import {
  useCreateRuleSet,
  useUpdateRuleSet
} from "@/features/rules/hooks";

interface GroupFundRuleEditContext {
  ruleSet: RuleSetDto;
  initialValues?: Partial<GroupFundRuleCreateFlowValues>;
}

interface GroupFundRuleCreateFlowProps {
  editContext?: GroupFundRuleEditContext;
}

const defaultValues: GroupFundRuleCreateFlowValues = {
  name: "",
  description: "",
  isDefault: false,
  participantCount: 4,
  contributions: [
    { relativeRank: 1, amountVnd: 0 },
    { relativeRank: 2, amountVnd: 0 },
    { relativeRank: 3, amountVnd: 0 },
    { relativeRank: 4, amountVnd: 0 }
  ],
  penalties: []
};

const toContributionRules = (values: GroupFundRuleCreateFlowValues): RuleInput[] =>
  values.contributions
    .filter((item) => item.amountVnd > 0)
    .map((item) => ({
      code: `GF_CONTRIBUTION_RANK_${item.relativeRank}`,
      name: `Rank ${item.relativeRank} contribution`,
      description: `Rank ${item.relativeRank} contributes ${formatAmountVnd(item.amountVnd)} VND to group fund`,
      ruleKind: "FUND_CONTRIBUTION",
      priority: 100 + item.relativeRank,
      status: "ACTIVE",
      stopProcessingOnMatch: false,
      metadata: null,
      conditions: [
        {
          conditionKey: "participantCount",
          operator: "EQ",
          valueJson: values.participantCount,
          sortOrder: 1
        },
        {
          conditionKey: "module",
          operator: "EQ",
          valueJson: "GROUP_FUND",
          sortOrder: 2
        },
        {
          conditionKey: "subjectRelativeRank",
          operator: "EQ",
          valueJson: item.relativeRank,
          sortOrder: 3
        }
      ],
      actions: [
        {
          actionType: "TRANSFER",
          amountVnd: item.amountVnd,
          sourceSelectorType: "SUBJECT_PLAYER",
          sourceSelectorJson: {},
          destinationSelectorType: "FUND_ACCOUNT",
          destinationSelectorJson: {},
          descriptionTemplate: `Rank ${item.relativeRank} contribution to fund`,
          sortOrder: 1
        }
      ]
    }));

const toPenaltyRules = (values: GroupFundRuleCreateFlowValues): RuleInput[] =>
  values.penalties
    .filter((item) => item.amountVnd > 0)
    .map((item) => ({
      code: `GF_PENALTY_ABS_${item.absolutePlacement}`,
      name: `Placement ${item.absolutePlacement} extra fund penalty`,
      description: `Absolute placement ${item.absolutePlacement} pays extra ${formatAmountVnd(item.amountVnd)} VND to group fund`,
      ruleKind: "ABSOLUTE_PLACEMENT_MODIFIER",
      priority: 200 + item.absolutePlacement,
      status: "ACTIVE",
      stopProcessingOnMatch: false,
      metadata: null,
      conditions: [
        {
          conditionKey: "participantCount",
          operator: "EQ",
          valueJson: values.participantCount,
          sortOrder: 1
        },
        {
          conditionKey: "module",
          operator: "EQ",
          valueJson: "GROUP_FUND",
          sortOrder: 2
        },
        {
          conditionKey: "subjectAbsolutePlacement",
          operator: "EQ",
          valueJson: item.absolutePlacement,
          sortOrder: 3
        }
      ],
      actions: [
        {
          actionType: "TRANSFER",
          amountVnd: item.amountVnd,
          sourceSelectorType: "SUBJECT_PLAYER",
          sourceSelectorJson: {},
          destinationSelectorType: "FUND_ACCOUNT",
          destinationSelectorJson: {},
          descriptionTemplate: `Absolute placement ${item.absolutePlacement} extra fund penalty`,
          sortOrder: 1
        }
      ]
    }));

export const GroupFundRuleCreateFlow = ({
  editContext
}: GroupFundRuleCreateFlowProps = {}) => {
  const navigate = useNavigate();
  const isEditMode = Boolean(editContext);
  const createRuleSetMutation = useCreateRuleSet();
  const updateRuleSetMutation = useUpdateRuleSet(editContext?.ruleSet.id ?? "");

  const [apiError, setApiError] = useState<string | null>(null);

  const form = useForm<GroupFundRuleCreateFlowValues>({
    resolver: zodResolver(groupFundRuleCreateFlowSchema),
    mode: "onChange",
    defaultValues
  });

  const participantCount = useWatch({
    control: form.control,
    name: "participantCount"
  });
  const contributions = useWatch({ control: form.control, name: "contributions" }) ?? [];
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
    const expectedRows = buildRankAmounts(1, participantCount, contributions);
    if (!sameRankAmounts(contributions, expectedRows)) {
      form.setValue("contributions", expectedRows, { shouldValidate: true });
    }
  }, [contributions, form, participantCount]);

  const totalContribution = useMemo(() => sumAmounts(contributions), [contributions]);
  const activeContributionCount = useMemo(
    () => contributions.filter((item) => item.amountVnd > 0).length,
    [contributions]
  );
  const activePenaltyCount = useMemo(
    () => penalties.filter((item) => item.amountVnd > 0).length,
    [penalties]
  );
  const totalPenalty = useMemo(
    () =>
      sumAmounts(
        penalties.map((item) => ({
          relativeRank: item.absolutePlacement,
          amountVnd: item.amountVnd
        }))
      ),
    [penalties]
  );
  const reviewPenaltyLines = useMemo(
    () =>
      penalties.length
        ? penalties.map(
            (item) =>
              `Placement ${item.absolutePlacement}: +${formatAmountVnd(
                item.amountVnd
              )} VND to fund account`
          )
        : ["No extra penalties"],
    [penalties]
  );

  const createVersionPayload = (
    values: GroupFundRuleCreateFlowValues
  ): CreateRuleSetVersionRequest => ({
    participantCountMin: values.participantCount,
    participantCountMax: values.participantCount,
    effectiveTo: null,
    isActive: true,
    summaryJson: null,
    rules: [...toContributionRules(values), ...toPenaltyRules(values)]
  });

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
        module: "GROUP_FUND",
        name: values.name,
        status: "ACTIVE",
        isDefault: values.isDefault,
        description: values.description || null,
        ...versionPayload
      });

      if (createdRuleSet.latestVersion?.id) {
        message.success("Group Fund rule created successfully");
        navigate(`/rules/${createdRuleSet.id}/versions/${createdRuleSet.latestVersion.id}`);
      } else {
        message.success("Group Fund rule created successfully");
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

  const contributionErrorMessage =
    form.formState.errors.contributions &&
    !Array.isArray(form.formState.errors.contributions)
      ? String(form.formState.errors.contributions.message ?? "")
      : "";

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
            : "Business information for this Group Fund rule"
        }
        hideCode
      />

      <RuleMatchSetupSection
        control={form.control}
        participantCountName="participantCount"
        description="Configure participant count, contribution obligations, and optional placement penalties."
      >
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-sm font-semibold text-slate-700">
              Contribution by Relative Rank
            </div>
            <div className="space-y-3">
              {contributions.map((item, index) => (
                <Card key={`contribution-${item.relativeRank}`} size="small" className="!bg-slate-50">
                  <div className="grid grid-cols-[120px_1fr] gap-3">
                    <div className="flex items-center rounded-lg bg-white px-3 text-sm font-medium text-slate-700">
                      Rank {item.relativeRank}
                    </div>
                    <Controller
                      control={form.control}
                      name={`contributions.${index}.amountVnd`}
                      render={({ field }) => (
                        <CurrencyAmountInput
                          value={field.value}
                          onChange={field.onChange}
                          min={0}
                        />
                      )}
                    />
                  </div>
                </Card>
              ))}
            </div>
            {contributionErrorMessage ? (
              <div className="mt-2 text-xs text-red-600">{contributionErrorMessage}</div>
            ) : null}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-700">
                Special Penalties (Always to Fund Account)
              </div>
              <Button
                type="dashed"
                onClick={() =>
                  penaltiesFieldArray.append({
                    absolutePlacement: 1,
                    amountVnd: 0
                  })
                }
              >
                Add penalty
              </Button>
            </div>

            {penaltiesFieldArray.fields.length === 0 ? (
              <div className="text-sm text-slate-500">No extra penalties added.</div>
            ) : (
              <div className="space-y-3">
                {penaltiesFieldArray.fields.map((field, index) => (
                  <Card key={field.id} size="small" className="!bg-slate-50">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-xs font-medium text-slate-600">{`Penalty #${index + 1}`}</div>
                      <Button danger onClick={() => penaltiesFieldArray.remove(index)}>
                        Remove
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium">
                          Absolute placement
                        </label>
                        <Controller
                          control={form.control}
                          name={`penalties.${index}.absolutePlacement`}
                          render={({ field: formField }) => (
                            <RankPlacementSelect
                              value={formField.value}
                              onChange={formField.onChange}
                              min={1}
                              max={8}
                              optionLabel={(value) => `Top ${value}`}
                            />
                          )}
                        />
                        {form.formState.errors.penalties?.[index]?.absolutePlacement
                          ?.message ? (
                          <div className="mt-1 text-xs text-red-600">
                            {String(
                              form.formState.errors.penalties[index]?.absolutePlacement
                                ?.message
                            )}
                          </div>
                        ) : null}
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium">Amount</label>
                        <Controller
                          control={form.control}
                          name={`penalties.${index}.amountVnd`}
                          render={({ field: formField }) => (
                            <CurrencyAmountInput
                              value={formField.value}
                              onChange={formField.onChange}
                              min={0}
                            />
                          )}
                        />
                        {form.formState.errors.penalties?.[index]?.amountVnd?.message ? (
                          <div className="mt-1 text-xs text-red-600">
                            {String(form.formState.errors.penalties[index]?.amountVnd?.message)}
                          </div>
                        ) : null}
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium">Destination</label>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
                          Fund account
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {form.formState.errors.penalties &&
            !Array.isArray(form.formState.errors.penalties) ? (
              <div className="mt-2 text-xs text-red-600">
                {String(form.formState.errors.penalties.message ?? "")}
              </div>
            ) : null}
          </div>
        </div>
      </RuleMatchSetupSection>

      <ReviewSummaryCard
        module="GROUP_FUND"
        isDefault={isDefault}
        rows={[
          {
            label: "Match setup",
            value: `${participantCount} players`
          },
          {
            label: "Contributions",
            value: formatRankAmountList(contributions, "-")
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
          },
          {
            label: "Active contributors",
            value: `${activeContributionCount} rank${
              activeContributionCount === 1 ? "" : "s"
            } with amount > 0`
          },
          {
            label: "Active penalties",
            value: `${activePenaltyCount} placement${
              activePenaltyCount === 1 ? "" : "s"
            } with amount > 0`
          },
          {
            label: "Total to fund",
            value: `${formatAmountVnd(totalContribution + totalPenalty)} VND`
          }
        ]}
        footer={
          <RuleFormFooter
            onCancel={handleCancel}
            submitLabel={isEditMode ? "Save as New Version" : "Create Group Fund Rule"}
            submitLoading={submitLoading}
            submitDisabled={!form.formState.isValid}
          />
        }
      />
    </form>
  );
};
