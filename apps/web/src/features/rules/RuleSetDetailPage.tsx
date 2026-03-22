import { Button, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate, useParams } from "react-router-dom";
import { useRuleSetDetail } from "@/features/rules/hooks";
import { normalizeMatchStakesBuilderConfig, summarizeMatchStakesBuilder } from "@/features/rules/builder-utils";
import { ErrorState } from "@/components/states/ErrorState";
import { PageLoading } from "@/components/states/PageLoading";
import { MetricCard } from "@/components/layout/MetricCard";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/layout/SectionCard";
import { formatDateTime } from "@/lib/format";
import { moduleLabels, ruleStatusLabels } from "@/lib/labels";
import type { RuleSetVersionListItemDto } from "@/types/api";

const VersionSummary = ({ version }: { version: RuleSetVersionListItemDto }) => {
  if (version.builderType === "MATCH_STAKES_PAYOUT") {
    const config = normalizeMatchStakesBuilderConfig(version.builderConfig);
    if (config) {
      const summary = summarizeMatchStakesBuilder(config);

      return (
        <div className="space-y-1 text-xs text-slate-600">
          <div className="font-medium text-slate-800">{summary.headline}</div>
          <div>payouts: {summary.payouts}</div>
          <div>losses: {summary.losses}</div>
          <div>penalties: {summary.penalties}</div>
        </div>
      );
    }

    return <span className="text-xs text-slate-500">Builder config present but unreadable.</span>;
  }

  if (version.builderType) {
    return <span className="text-xs text-slate-500">Builder type: {version.builderType}</span>;
  }

  return <span className="text-xs text-slate-500">Raw mode version (compiled rules only).</span>;
};

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

  const columns: ColumnsType<RuleSetVersionListItemDto> = [
    {
      title: "Version",
      dataIndex: "versionNo",
      key: "versionNo",
      width: 100,
      render: (value: number) => <span className="font-medium">v{value}</span>
    },
    {
      title: "Participants",
      key: "participantRange",
      width: 140,
      render: (_, version) => `${version.participantCountMin}-${version.participantCountMax}`
    },
    {
      title: "Effective Window",
      key: "effectiveWindow",
      width: 260,
      render: (_, version) => (
        <div className="text-xs text-slate-600">
          <div>From: {formatDateTime(version.effectiveFrom)}</div>
          <div>To: {formatDateTime(version.effectiveTo)}</div>
        </div>
      )
    },
    {
      title: "Status",
      key: "status",
      width: 180,
      render: (_, version) => (
        <div className="flex flex-wrap gap-1">
          <Tag color={version.isActive ? "green" : "default"}>{version.isActive ? "Active" : "Inactive"}</Tag>
          {version.builderType ? <Tag color="geekblue">{version.builderType}</Tag> : <Tag>RAW</Tag>}
        </div>
      )
    },
    {
      title: "Business Summary",
      key: "summary",
      render: (_, version) => <VersionSummary version={version} />
    },
    {
      title: "Actions",
      key: "actions",
      width: 330,
      render: (_, version) => (
        <div className="flex gap-2">
          <Button onClick={() => navigate(`/rules/${ruleSetId}/versions/${version.id}`)}>View detail</Button>
          {version.builderType === "MATCH_STAKES_PAYOUT" ? (
            <Button onClick={() => navigate(`/rules/${ruleSetId}/versions/new?fromVersionId=${version.id}`)}>
              New Version From Config
            </Button>
          ) : null}
          <Button onClick={() => navigate(`/rules/${ruleSetId}/versions/${version.id}/edit`)}>Edit metadata</Button>
        </div>
      )
    }
  ];

  return (
    <PageContainer>
      <PageHeader
        title={data.name}
        subtitle="Rule set metadata and version history"
        actions={
          <>
            <Button onClick={() => navigate(`/rules/${ruleSetId}/edit`)}>Edit metadata</Button>
            <Button type="primary" onClick={() => navigate(`/rules/${ruleSetId}/versions/new`)}>
              Create version
            </Button>
          </>
        }
      />

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Module" value={moduleLabels[data.module]} />
        <MetricCard label="Code" value={data.code} />
        <MetricCard label="Status" value={ruleStatusLabels[data.status]} />
        <MetricCard label="Default" value={data.isDefault ? "Yes" : "No"} />
      </section>

      <SectionCard title="Metadata">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs text-slate-500">Description</div>
            <div className="mt-1 text-sm text-slate-700">{data.description || "No description"}</div>
          </div>

          <div className="text-xs text-slate-500">
            <div>Created: {formatDateTime(data.createdAt)}</div>
            <div>Updated: {formatDateTime(data.updatedAt)}</div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title={`Versions (${data.versions.length})`}
        description="Builder metadata and compiled-rule snapshots"
      >
        <Table
          rowKey="id"
          dataSource={data.versions}
          columns={columns}
          pagination={false}
          locale={{ emptyText: "No versions yet" }}
          scroll={{ x: 1100 }}
        />
      </SectionCard>
    </PageContainer>
  );
};
