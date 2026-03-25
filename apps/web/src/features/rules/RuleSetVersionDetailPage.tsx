import { Button, Card, Collapse, Descriptions, Empty, List, Tag } from "antd";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { RulesBreadcrumb } from "@/features/rules/components";
import { useRuleSetDetail, useRuleSetVersionDetail } from "@/features/rules/hooks";
import {
  formatAmountVnd,
  formatPenaltyDestination,
  normalizeMatchStakesBuilderConfig,
  summarizeMatchStakesBuilder
} from "@/features/rules/builder-utils";
import { ErrorState } from "@/components/states/ErrorState";
import { PageLoading } from "@/components/states/PageLoading";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/layout/SectionCard";
import { formatDateTime } from "@/lib/format";

export const RuleSetVersionDetailPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { ruleSetId, versionId } = useParams();
  const ruleSetQuery = useRuleSetDetail(ruleSetId);
  const versionQuery = useRuleSetVersionDetail(ruleSetId, versionId);

  if (!ruleSetId || !versionId) {
    return <ErrorState title="Missing params" />;
  }

  if (versionQuery.isLoading) {
    return <PageLoading label="Loading version..." />;
  }

  if (versionQuery.isError || !versionQuery.data) {
    return <ErrorState onRetry={() => void versionQuery.refetch()} />;
  }

  const version = versionQuery.data;
  const ruleSetLabel = ruleSetQuery.data?.name ?? "Rule Set";
  const builderConfig = version.builderType === "MATCH_STAKES_PAYOUT" ? normalizeMatchStakesBuilderConfig(version.builderConfig) : null;
  const builderSummary = builderConfig ? summarizeMatchStakesBuilder(builderConfig) : null;
  const participantLabel =
    version.participantCountMin === version.participantCountMax
      ? `${version.participantCountMin}`
      : `${version.participantCountMin} - ${version.participantCountMax}`;
  const formatAmountDong = (amount: number) => `${formatAmountVnd(amount)}đ`;

  return (
    <PageContainer>
      <RulesBreadcrumb
        items={[
          { label: "Rules", to: "/rules" },
          { label: ruleSetLabel, to: `/rules/${ruleSetId}${location.search}` },
          { label: `Version v${version.versionNo}` }
        ]}
      />

      <PageHeader
        title={`Rule Version v${version.versionNo}`}
        subtitle="Business builder summary and compiled rules"
        actions={
          <Button onClick={() => navigate(`/rules/${ruleSetId}${location.search}`)}>
            Back
          </Button>
        }
      />

      {builderConfig ? (
        <SectionCard>
          <div className="text-sm text-slate-600">
            Versions are immutable. To change payouts/losses/penalties, create a new version prefilled from this config.
          </div>
        </SectionCard>
      ) : null}

      {builderConfig ? (
        <SectionCard title="Business Summary" description="MATCH_STAKES builder configuration">
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-900">{builderSummary?.headline}</div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Card size="small" title="Payouts">
                <div className="space-y-2">
                  {builderConfig.payouts
                    .slice()
                    .sort((a, b) => a.relativeRank - b.relativeRank)
                    .map((item) => (
                      <div
                        key={`payout-${item.relativeRank}`}
                        className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2"
                      >
                        <div className="text-sm font-medium text-emerald-900">{`Rank ${item.relativeRank}`}</div>
                        <div className="text-sm font-semibold text-emerald-700">{`+${formatAmountDong(item.amountVnd)}`}</div>
                      </div>
                    ))}
                </div>
              </Card>

              <Card size="small" title="Losses">
                <div className="space-y-2">
                  {builderConfig.losses
                    .slice()
                    .sort((a, b) => a.relativeRank - b.relativeRank)
                    .map((item) => (
                      <div
                        key={`loss-${item.relativeRank}`}
                        className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-3 py-2"
                      >
                        <div className="text-sm font-medium text-rose-900">{`Rank ${item.relativeRank}`}</div>
                        <div className="text-sm font-semibold text-rose-700">{`-${formatAmountDong(item.amountVnd)}`}</div>
                      </div>
                    ))}
                </div>
              </Card>
            </div>

            <Card size="small" title="Penalties">
              {builderConfig.penalties?.length ? (
                <List
                  size="small"
                  dataSource={builderConfig.penalties}
                  renderItem={(penalty) => (
                    <List.Item>
                      <div className="text-sm text-slate-700">
                        top{penalty.absolutePlacement} pays extra {formatAmountDong(penalty.amountVnd)} to {formatPenaltyDestination(penalty.destinationSelectorType)}
                      </div>
                    </List.Item>
                  )}
                />
              ) : (
                <div className="text-sm text-slate-500">No penalties</div>
              )}
            </Card>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Business Summary">
          <div className="text-sm text-slate-500">
            {version.builderType
              ? `Builder type ${version.builderType} is present but config could not be parsed.`
              : "This version was created in raw mode and has no builder summary."}
          </div>
        </SectionCard>
      )}

      <SectionCard title="Metadata">
        <Descriptions size="small" column={{ xs: 1, md: 2 }}>
          <Descriptions.Item label="Version">v{version.versionNo}</Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={version.isActive ? "green" : "default"}>{version.isActive ? "Active" : "Inactive"}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Participants">
            {participantLabel}
          </Descriptions.Item>
          <Descriptions.Item label="Builder type">{version.builderType || "RAW"}</Descriptions.Item>
          <Descriptions.Item label="Effective from">{formatDateTime(version.effectiveFrom)}</Descriptions.Item>
          <Descriptions.Item label="Effective to">{formatDateTime(version.effectiveTo)}</Descriptions.Item>
          <Descriptions.Item label="Created at">{formatDateTime(version.createdAt)}</Descriptions.Item>
        </Descriptions>
      </SectionCard>

      <SectionCard title={`Compiled Rules (${version.rules.length})`} description="Low-level rules generated or stored in this version">
        {version.rules.length === 0 ? (
          <Empty description="No compiled rules" />
        ) : (
          <Collapse
            items={version.rules.map((rule, index) => ({
              key: rule.id ?? `${index}`,
              label: `${rule.code} - ${rule.name}`,
              children: (
                <div className="space-y-3">
                  <div className="text-sm text-slate-600">{rule.description || "No description"}</div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <Tag>Kind: {rule.ruleKind}</Tag>
                    <Tag>Priority: {rule.priority}</Tag>
                    <Tag>Status: {rule.status}</Tag>
                    <Tag color={rule.stopProcessingOnMatch ? "blue" : "default"}>
                      Stop processing: {rule.stopProcessingOnMatch ? "Yes" : "No"}
                    </Tag>
                  </div>

                  <Card size="small" title={`Conditions (${rule.conditions.length})`}>
                    <div className="space-y-2">
                      {rule.conditions.map((condition, conditionIndex) => (
                        <div key={condition.id ?? `${conditionIndex}`} className="rounded-lg bg-slate-50 p-2 text-xs">
                          <div>
                            {condition.conditionKey} {condition.operator}
                          </div>
                          <pre className="mt-1 overflow-auto whitespace-pre-wrap">{JSON.stringify(condition.valueJson, null, 2)}</pre>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card size="small" title={`Actions (${rule.actions.length})`}>
                    <div className="space-y-2">
                      {rule.actions.map((action, actionIndex) => (
                        <div key={action.id ?? `${actionIndex}`} className="rounded-lg bg-slate-50 p-2 text-xs">
                          <div>
                            {action.actionType} - {formatAmountDong(action.amountVnd)}
                          </div>
                          <div className="mt-1">
                            {action.sourceSelectorType} to {action.destinationSelectorType}
                          </div>
                          {action.descriptionTemplate ? <div className="mt-1">{action.descriptionTemplate}</div> : null}
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )
            }))}
          />
        )}
      </SectionCard>
    </PageContainer>
  );
};
