import { Button, Card, Collapse, Empty, Tag } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { useRuleSetVersionDetail } from "@/features/rules/hooks";
import { PageLoading } from "@/components/states/PageLoading";
import { ErrorState } from "@/components/states/ErrorState";
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Rule Version {version.versionNo}</h2>
        <Button onClick={() => navigate(`/rules/${ruleSetId}/versions/${version.id}/edit`)}>Edit metadata</Button>
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <div className="text-xs text-slate-500">Participant range</div>
            <div className="font-medium">{version.participantCountMin} - {version.participantCountMax}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Effective from</div>
            <div className="font-medium">{formatDateTime(version.effectiveFrom)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Effective to</div>
            <div className="font-medium">{formatDateTime(version.effectiveTo)}</div>
          </div>
        </div>
        <div className="mt-3">
          <Tag color={version.isActive ? "green" : "default"}>{version.isActive ? "Active" : "Inactive"}</Tag>
        </div>
      </Card>

      <Card title={`Rules (${version.rules.length})`}>
        {version.rules.length === 0 ? (
          <Empty description="No rules" />
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
                    {rule.stopProcessingOnMatch ? <Tag color="blue">Stop on match</Tag> : null}
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
                          <div>{action.actionType} - {action.amountVnd.toLocaleString("vi-VN")} ?</div>
                          <div className="mt-1">{action.sourceSelectorType} ? {action.destinationSelectorType}</div>
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
      </Card>
    </div>
  );
};
