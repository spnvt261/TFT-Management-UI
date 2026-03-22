import { Button, Card, Collapse, Descriptions, Empty, List, Tag } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { useRuleSetVersionDetail } from "@/features/rules/hooks";
import {
  formatAmountVnd,
  formatPenaltyDestination,
  formatRankAmountLine,
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
  const navigate = useNavigate();
  const { ruleSetId, versionId } = useParams();
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
  const builderConfig = version.builderType === "MATCH_STAKES_PAYOUT" ? normalizeMatchStakesBuilderConfig(version.builderConfig) : null;
  const builderSummary = builderConfig ? summarizeMatchStakesBuilder(builderConfig) : null;

  return (
    <PageContainer>
      <PageHeader
        title={`Rule Version v${version.versionNo}`}
        subtitle="Business builder summary and compiled rules"
        actions={
          <>
            {builderConfig ? (
              <Button onClick={() => navigate(`/rules/${ruleSetId}/versions/new?fromVersionId=${version.id}`)}>
                Create New Version From This Config
              </Button>
            ) : null}
            <Button onClick={() => navigate(`/rules/${ruleSetId}/versions/${version.id}/edit`)}>Edit metadata</Button>
          </>
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
                <div className="text-sm text-slate-700">{formatRankAmountLine(builderConfig.payouts, "payout")}</div>
              </Card>

              <Card size="small" title="Losses">
                <div className="text-sm text-slate-700">{formatRankAmountLine(builderConfig.losses, "loss")}</div>
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
                        top{penalty.absolutePlacement} pays extra {formatAmountVnd(penalty.amountVnd)} to {formatPenaltyDestination(penalty.destinationSelectorType)}
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
            {version.participantCountMin} - {version.participantCountMax}
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
                            {action.actionType} - {formatAmountVnd(action.amountVnd)} VND
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
