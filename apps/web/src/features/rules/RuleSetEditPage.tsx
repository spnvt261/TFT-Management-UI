import { useMemo } from "react";
import { Alert, Tag } from "antd";
import { useParams } from "react-router-dom";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/layout/SectionCard";
import { ErrorState } from "@/components/states/ErrorState";
import { PageLoading } from "@/components/states/PageLoading";
import { GroupFundRuleCreateFlow } from "@/features/rules/GroupFundRuleCreateFlow";
import { MatchStakesRuleCreateFlow } from "@/features/rules/MatchStakesRuleCreateFlow";
import { RulesBreadcrumb } from "@/features/rules/components";
import { useRuleSetDetail, useRuleSetVersionDetail } from "@/features/rules/hooks";
import { normalizeMatchStakesBuilderConfig } from "@/features/rules/builder-utils";
import type {
  GroupFundRuleCreateFlowValues,
  MatchStakesRuleCreateFlowValues
} from "@/features/rules/schemas";
import { moduleLabels } from "@/lib/labels";
import type { RuleDto, RuleSetDetailDto } from "@/types/api";

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const toParticipantCount = (value: number | undefined): 3 | 4 =>
  value === 3 ? 3 : 4;

const getConditionNumber = (rule: RuleDto, key: string): number | null => {
  const condition = rule.conditions.find((item) => item.conditionKey === key);
  return toNumber(condition?.valueJson);
};

const buildMatchStakesInitialValues = (
  ruleSet: RuleSetDetailDto,
  latestVersionBuilderConfig: unknown
): {
  values: MatchStakesRuleCreateFlowValues;
  hasSourceConfig: boolean;
} => {
  const normalizedConfig = normalizeMatchStakesBuilderConfig(latestVersionBuilderConfig);

  if (!normalizedConfig) {
    return {
      values: {
        name: ruleSet.name,
        description: ruleSet.description ?? "",
        isDefault: ruleSet.isDefault,
        participantCount: 3,
        winnerCount: 1,
        winnerPayouts: [],
        losses: [
          { relativeRank: 2, amountVnd: 0 },
          { relativeRank: 3, amountVnd: 0 }
        ],
        penalties: []
      },
      hasSourceConfig: false
    };
  }

  return {
    values: {
      name: ruleSet.name,
      description: ruleSet.description ?? "",
      isDefault: ruleSet.isDefault,
      participantCount: normalizedConfig.participantCount,
      winnerCount: normalizedConfig.winnerCount,
      winnerPayouts: [...normalizedConfig.payouts]
        .filter((item) => item.relativeRank > 1)
        .sort((a, b) => a.relativeRank - b.relativeRank),
      losses: [...normalizedConfig.losses].sort(
        (a, b) => a.relativeRank - b.relativeRank
      ),
      penalties: (normalizedConfig.penalties ?? []).map((item) => ({
        absolutePlacement: item.absolutePlacement,
        amountVnd: item.amountVnd,
        destinationSelectorType:
          item.destinationSelectorType === "FUND_ACCOUNT"
            ? "FUND_ACCOUNT"
            : "BEST_PARTICIPANT"
      }))
    },
    hasSourceConfig: true
  };
};

const buildGroupFundInitialValues = (
  ruleSet: RuleSetDetailDto,
  latestVersionRules: RuleDto[] | undefined,
  participantCountHint: number | undefined
): GroupFundRuleCreateFlowValues => {
  const participantCount = toParticipantCount(participantCountHint);
  const contributionMap = new Map<number, number>();
  const penaltyMap = new Map<number, number>();

  for (const rule of latestVersionRules ?? []) {
    if (rule.ruleKind === "FUND_CONTRIBUTION") {
      const rank = getConditionNumber(rule, "subjectRelativeRank");
      const amount = toNumber(rule.actions[0]?.amountVnd);
      if (rank && amount !== null && amount >= 0) {
        contributionMap.set(rank, amount);
      }
    }

    if (rule.ruleKind === "ABSOLUTE_PLACEMENT_MODIFIER") {
      const placement = getConditionNumber(rule, "subjectAbsolutePlacement");
      const amount = toNumber(rule.actions[0]?.amountVnd);
      if (placement && amount !== null && amount >= 0) {
        penaltyMap.set(placement, amount);
      }
    }
  }

  return {
    name: ruleSet.name,
    description: ruleSet.description ?? "",
    isDefault: ruleSet.isDefault,
    participantCount,
    contributions: Array.from({ length: participantCount }, (_, index) => ({
      relativeRank: index + 1,
      amountVnd: contributionMap.get(index + 1) ?? 0
    })),
    penalties: [...penaltyMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([absolutePlacement, amountVnd]) => ({
        absolutePlacement,
        amountVnd
      }))
  };
};

export const RuleSetEditPage = () => {
  const { ruleSetId } = useParams();
  const detailQuery = useRuleSetDetail(ruleSetId);

  const latestVersion = useMemo(() => {
    const versions = detailQuery.data?.versions ?? [];
    return [...versions].sort((a, b) => b.versionNo - a.versionNo)[0];
  }, [detailQuery.data?.versions]);

  const latestVersionDetailQuery = useRuleSetVersionDetail(ruleSetId, latestVersion?.id);

  if (!ruleSetId) {
    return <ErrorState title="Missing rule set id" />;
  }

  if (detailQuery.isLoading) {
    return <PageLoading label="Loading rule set..." />;
  }

  if (detailQuery.isError || !detailQuery.data) {
    return <ErrorState onRetry={() => void detailQuery.refetch()} />;
  }

  if (latestVersion?.id && latestVersionDetailQuery.isLoading) {
    return <PageLoading label="Loading latest version for editing..." />;
  }

  if (latestVersion?.id && latestVersionDetailQuery.isError) {
    return <ErrorState onRetry={() => void latestVersionDetailQuery.refetch()} />;
  }

  const ruleSet = detailQuery.data;
  const matchStakesPrefill = buildMatchStakesInitialValues(
    ruleSet,
    latestVersion?.builderConfig
  );
  const groupFundPrefill = buildGroupFundInitialValues(
    ruleSet,
    latestVersionDetailQuery.data?.rules,
    latestVersion?.participantCountMin
  );

  return (
    <PageContainer>
      <RulesBreadcrumb
        items={[
          { label: "Rules", to: "/rules" },
          { label: ruleSet.name, to: `/rules/${ruleSetId}` },
          { label: "Edit" }
        ]}
      />

      <PageHeader
        title={`Edit ${moduleLabels[ruleSet.module]} Rule`}
        subtitle="Use the same guided flow as create. Submitting will save your changes as a new version."
      />

      <SectionCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            Editing <span className="font-medium text-slate-800">{ruleSet.name}</span>
            {latestVersion ? ` from latest version v${latestVersion.versionNo}` : ""}.
          </div>
          <Tag color="default">{`Module (locked): ${moduleLabels[ruleSet.module]}`}</Tag>
        </div>
      </SectionCard>

      {ruleSet.module === "MATCH_STAKES" && !matchStakesPrefill.hasSourceConfig ? (
        <Alert
          type="warning"
          showIcon
          message="Latest version config could not be prefilled"
          description="The form starts with safe defaults. Update values and save to create a new version."
        />
      ) : null}

      {ruleSet.module === "MATCH_STAKES" ? (
        <MatchStakesRuleCreateFlow
          editContext={{
            ruleSet,
            initialValues: matchStakesPrefill.values
          }}
        />
      ) : (
        <GroupFundRuleCreateFlow
          editContext={{
            ruleSet,
            initialValues: groupFundPrefill
          }}
        />
      )}
    </PageContainer>
  );
};
