import { Button, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate, useParams } from "react-router-dom";
import { ErrorState } from "@/components/states/ErrorState";
import { PageLoading } from "@/components/states/PageLoading";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionCard } from "@/components/layout/SectionCard";
import {
  RuleSetStatusBadges,
  RulesBreadcrumb,
  VersionRowActionMenu
} from "@/features/rules/components";
import {
  normalizeMatchStakesBuilderConfig,
  summarizeMatchStakesBuilder
} from "@/features/rules/builder-utils";
import { useRuleSetDetail } from "@/features/rules/hooks";
import { useIsMobile } from "@/hooks/useIsMobile";
import { formatDateTime } from "@/lib/format";
import { moduleLabels } from "@/lib/labels";
import type { RuleSetVersionListItemDto } from "@/types/api";

const VersionSummary = ({ version }: { version: RuleSetVersionListItemDto }) => {
  if (version.builderType === "MATCH_STAKES_PAYOUT") {
    const config = normalizeMatchStakesBuilderConfig(version.builderConfig);
    if (config) {
      const summary = summarizeMatchStakesBuilder(config);

      return (
        <div className="space-y-1 text-xs leading-5 text-slate-600">
          <div className="font-medium text-slate-800">{summary.headline}</div>
          <div>{summary.payouts}</div>
          <div>{summary.losses}</div>
          <div>{summary.penalties}</div>
        </div>
      );
    }
  }

  if (version.builderType) {
    return <span className="text-xs text-slate-500">Builder summary unavailable.</span>;
  }

  return <span className="text-xs text-slate-500">Raw mode version snapshot.</span>;
};

const MetaItem = ({ label, value }: { label: string; value: string }) => (
  <div className="space-y-1">
    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
    <div className="text-sm text-slate-700">{value}</div>
  </div>
);

export const RuleSetDetailPage = () => {
  const navigate = useNavigate();
  const { ruleSetId } = useParams();
  const isMobile = useIsMobile();
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
      width: 90,
      render: (value: number) => <span className="font-medium text-slate-800">v{value}</span>
    },
    {
      title: "Participants",
      key: "participantCount",
      width: 120,
      render: (_, version) => (
        <span className="text-sm text-slate-700">{version.participantCountMin}</span>
      )
    },
    {
      title: "Effective Window",
      key: "effectiveWindow",
      width: 240,
      render: (_, version) => (
        <div className="space-y-1 text-xs text-slate-600">
          <div>From: {formatDateTime(version.effectiveFrom)}</div>
          <div>To: {formatDateTime(version.effectiveTo)}</div>
        </div>
      )
    },
    {
      title: "Status",
      key: "status",
      width: 120,
      render: (_, version) => (
        <Tag color={version.isActive ? "green" : "default"}>
          {version.isActive ? "Active" : "Inactive"}
        </Tag>
      )
    },
    {
      title: "Business Summary",
      key: "summary",
      width: 420,
      render: (_, version) => (
        <div className="whitespace-normal break-words">
          <VersionSummary version={version} />
        </div>
      )
    },
    {
      title: "",
      key: "actions",
      width: 70,
      align: "center",
      render: (_, version) => (
        <VersionRowActionMenu
          isMobile={isMobile}
          onViewDetail={() => navigate(`/rules/${ruleSetId}/versions/${version.id}`)}
          onEditMetadata={() => navigate(`/rules/${ruleSetId}/versions/${version.id}/edit`)}
          onNewVersionFromConfig={
            version.builderType === "MATCH_STAKES_PAYOUT"
              ? () =>
                  navigate(
                    `/rules/${ruleSetId}/versions/new?fromVersionId=${version.id}`
                  )
              : undefined
          }
        />
      )
    }
  ];

  return (
    <PageContainer>
      <RulesBreadcrumb
        items={[
          { label: "Rules", to: "/rules" },
          { label: data.name }
        ]}
      />

      <header className="flex flex-wrap items-start justify-between gap-3 lg:gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 lg:text-2xl">
              {data.name}
            </h2>
            <RuleSetStatusBadges status={data.status} isDefault={data.isDefault} />
          </div>
          <p className="text-sm text-slate-500">
            {data.description || "No description provided."}
          </p>
        </div>

        <div className="flex w-full justify-end sm:w-auto">
          <Button onClick={() => navigate(`/rules/${ruleSetId}/edit`)}>
            Edit rule
          </Button>
        </div>
      </header>

      <SectionCard title={data.name} description={data.description || "No description provided."}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetaItem label="Module" value={moduleLabels[data.module]} />
          <MetaItem label="Created" value={formatDateTime(data.createdAt)} />
          <MetaItem label="Updated" value={formatDateTime(data.updatedAt)} />
        </div>
      </SectionCard>

      <SectionCard
        title={`Versions (${data.versions.length})`}
        description="Version history with business-focused summaries"
      >
        <div className="overflow-x-auto">
          <Table
            rowKey="id"
            dataSource={data.versions}
            columns={columns}
            pagination={false}
            size="middle"
            locale={{ emptyText: "No versions yet" }}
            scroll={{ x: 980 }}
          />
        </div>
      </SectionCard>
    </PageContainer>
  );
};
