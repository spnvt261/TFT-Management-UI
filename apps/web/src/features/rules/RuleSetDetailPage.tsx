import { ArrowLeftOutlined, EditOutlined } from "@ant-design/icons";
import { Button, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorState } from "@/components/states/ErrorState";
import { PageLoading } from "@/components/states/PageLoading";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionCard } from "@/components/layout/SectionCard";
import {
  RuleSetStatusBadges,
  RulesBreadcrumb
} from "@/features/rules/components";
import {
  normalizeMatchStakesBuilderConfig,
  summarizeMatchStakesBuilder
} from "@/features/rules/builder-utils";
import { useRuleSetDetail } from "@/features/rules/hooks";
import { useAuth } from "@/features/auth/AuthContext";
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
  const location = useLocation();
  const navigate = useNavigate();
  const { canWrite } = useAuth();
  const { ruleSetId } = useParams();
  const detailQuery = useRuleSetDetail(ruleSetId);
  const searchParams = new URLSearchParams(location.search);
  const returnToParam = searchParams.get("returnTo");
  const returnLabelParam = searchParams.get("returnLabel")?.trim();
  const returnTo = returnToParam && returnToParam.startsWith("/") ? returnToParam : null;
  const backTo = returnTo ?? "/rules";
  const backLabel = returnTo ? `Back to ${returnLabelParam || "previous screen"}` : "Back";
  const versionDetailPath = (versionId: string) => `/rules/${ruleSetId}/versions/${versionId}${location.search}`;

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
      render: (value: number, version) => (
        <Button
          type="link"
          
          className="!px-0 font-medium underline"
          onClick={() => navigate(versionDetailPath(version.id))}
        >
          v{value}
        </Button>
      )
    },
    {
      title: "Participants",
      key: "participantCount",
      width: 100,
      render: (_, version) => (
        <span className="text-sm text-slate-700">{version.participantCountMin}</span>
      )
    },
    {
      title: "Effective Window",
      key: "effectiveWindow",
      width: 150,
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
      width: 240,
      render: (_, version) => (
        <div className="whitespace-normal break-words">
          <VersionSummary version={version} />
        </div>
      )
    },
    {
      title: "Actions",
      key: "actions",
      width: 130,
      render: (_, version) => (
        <Button onClick={() => navigate(versionDetailPath(version.id))}>
          View detail
        </Button>
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

      <header className="mb-4 flex w-full justify-end">
        <div className="flex gap-2">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(backTo)}>
            {backLabel}
          </Button>
          <Button
            type="primary"
            icon={<EditOutlined />}
            disabled={!canWrite()}
            onClick={() => navigate(`/rules/${ruleSetId}/edit`)}
          >
            Edit rule
          </Button>
        </div>
      </header>

      <SectionCard
        title={data.name}
        description={data.description || "No description provided."}
        actions={<RuleSetStatusBadges status={data.status} isDefault={data.isDefault} />}
      >
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
            scroll={{ x: 1080 }}
          />
        </div>
      </SectionCard>
    </PageContainer>
  );
};
