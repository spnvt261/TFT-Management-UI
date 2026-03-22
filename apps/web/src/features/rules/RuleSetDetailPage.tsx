import { Button, Card, List, Tag } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { useRuleSetDetail } from "@/features/rules/hooks";
import { PageLoading } from "@/components/states/PageLoading";
import { ErrorState } from "@/components/states/ErrorState";
import { formatDateTime } from "@/lib/format";

export const RuleSetDetailPage = () => {
  const navigate = useNavigate();
  const { ruleSetId } = useParams();
  const detailQuery = useRuleSetDetail(ruleSetId);

  if (!ruleSetId) {
    return <ErrorState title="Missing rule set id" />;
  }

  if (detailQuery.isLoading) {
    return <PageLoading label="Loading rule set detail..." />;
  }

  if (detailQuery.isError || !detailQuery.data) {
    return <ErrorState onRetry={() => void detailQuery.refetch()} />;
  }

  const data = detailQuery.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{data.name}</h2>
        <div className="flex gap-2">
          <Button onClick={() => navigate(`/rules/${ruleSetId}/edit`)}>Edit metadata</Button>
          <Button type="primary" onClick={() => navigate(`/rules/${ruleSetId}/versions/new`)}>New version</Button>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <div className="text-xs text-slate-500">Code</div>
            <div className="font-medium">{data.code}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Module</div>
            <div className="font-medium">{data.module}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Status</div>
            <div className="font-medium">{data.status}</div>
          </div>
        </div>
        <div className="mt-3 text-sm text-slate-600">{data.description || "No description"}</div>
      </Card>

      <Card title={`Versions (${data.versions.length})`}>
        <List
          dataSource={data.versions}
          renderItem={(version) => (
            <List.Item
              actions={[
                <Button key="view" onClick={() => navigate(`/rules/${ruleSetId}/versions/${version.id}`)}>
                  View
                </Button>,
                <Button key="edit" onClick={() => navigate(`/rules/${ruleSetId}/versions/${version.id}/edit`)}>
                  Edit metadata
                </Button>
              ]}
            >
              <List.Item.Meta
                title={
                  <div className="flex items-center gap-2">
                    <span>{`Version ${version.versionNo}`}</span>
                    <Tag color={version.isActive ? "green" : "default"}>{version.isActive ? "Active" : "Inactive"}</Tag>
                  </div>
                }
                description={`Participants ${version.participantCountMin}-${version.participantCountMax} | Effective from ${formatDateTime(version.effectiveFrom)}`}
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
};
