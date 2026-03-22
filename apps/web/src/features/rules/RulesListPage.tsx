import { useMemo, useState } from "react";
import { Button, Pagination, Segmented, Table, Tabs, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import { useRuleSetDetail, useRuleSets } from "@/features/rules/hooks";
import { normalizeMatchStakesBuilderConfig, summarizeMatchStakesBuilder } from "@/features/rules/builder-utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { InlineLoading } from "@/components/states/InlineLoading";
import { PageLoading } from "@/components/states/PageLoading";
import { FilterBar } from "@/components/layout/FilterBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/layout/SectionCard";
import { formatDateTime } from "@/lib/format";
import { moduleLabels, ruleStatusLabels } from "@/lib/labels";
import type { ModuleType, RuleSetDto } from "@/types/api";

const pageSize = 12;

type ModuleTabValue = ModuleType | "ALL";

const moduleTabs: Array<{ key: ModuleTabValue; label: string }> = [
  { key: "MATCH_STAKES", label: "Match Stakes" },
  { key: "GROUP_FUND", label: "Group Fund" },
  { key: "ALL", label: "All Modules" }
];

const LatestVersionSummary = ({ ruleSetId }: { ruleSetId: string }) => {
  const detailQuery = useRuleSetDetail(ruleSetId);

  if (detailQuery.isLoading) {
    return <InlineLoading />;
  }

  if (detailQuery.isError || !detailQuery.data || detailQuery.data.versions.length === 0) {
    return <span className="text-xs text-slate-500">No versions yet</span>;
  }

  const latestVersion = detailQuery.data.versions[0];

  if (latestVersion.builderType === "MATCH_STAKES_PAYOUT") {
    const config = normalizeMatchStakesBuilderConfig(latestVersion.builderConfig);
    if (config) {
      const summary = summarizeMatchStakesBuilder(config);
      return (
        <div className="space-y-1 text-xs text-slate-600">
          <div className="font-medium text-slate-800">{summary.headline}</div>
          <div>{`Latest: ${summary.payouts} | ${summary.losses}`}</div>
        </div>
      );
    }
  }

  return <span className="text-xs text-slate-500">Latest version exists (business summary unavailable)</span>;
};

export const RulesListPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [module, setModule] = useState<ModuleTabValue>("MATCH_STAKES");
  const [status, setStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [defaultFilter, setDefaultFilter] = useState<"ALL" | "DEFAULT" | "NON_DEFAULT">("ALL");
  const [page, setPage] = useState(1);

  const query = useMemo(
    () => ({
      module: module === "ALL" ? undefined : module,
      status: status === "ALL" ? undefined : status,
      isDefault: defaultFilter === "ALL" ? undefined : defaultFilter === "DEFAULT",
      page,
      pageSize
    }),
    [module, status, defaultFilter, page]
  );

  const ruleSetsQuery = useRuleSets(query);

  if (ruleSetsQuery.isLoading) {
    return <PageLoading label="Loading rule sets..." />;
  }

  if (ruleSetsQuery.isError) {
    return <ErrorState onRetry={() => void ruleSetsQuery.refetch()} />;
  }

  const items = ruleSetsQuery.data?.data ?? [];
  const meta = ruleSetsQuery.data?.meta;

  const columns: ColumnsType<RuleSetDto> = [
    {
      title: "Rule Set",
      dataIndex: "name",
      key: "name",
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-900">{record.name}</div>
          <div className="text-xs text-slate-500">{record.code}</div>
          <div className="text-xs text-slate-500">{record.description || "No description"}</div>
        </div>
      )
    },
    {
      title: "Module",
      dataIndex: "module",
      key: "module",
      width: 140,
      render: (value: RuleSetDto["module"]) => <Tag>{moduleLabels[value]}</Tag>
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (value: RuleSetDto["status"]) => <Tag color={value === "ACTIVE" ? "green" : "default"}>{ruleStatusLabels[value]}</Tag>
    },
    {
      title: "Default",
      dataIndex: "isDefault",
      key: "isDefault",
      width: 110,
      render: (value: boolean) => (value ? <Tag color="blue">Default</Tag> : <span className="text-xs text-slate-400">No</span>)
    },
    {
      title: "Latest Version",
      key: "latestVersion",
      render: (_, record) => <LatestVersionSummary ruleSetId={record.id} />
    },
    {
      title: "Updated",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 200,
      render: (value: string, record) => (
        <div className="text-xs text-slate-600">
          <div>{formatDateTime(value)}</div>
          <div>Created: {formatDateTime(record.createdAt)}</div>
        </div>
      )
    },
    {
      title: "Actions",
      key: "actions",
      width: 130,
      render: (_, record) => <Button onClick={() => navigate(`/rules/${record.id}`)}>View detail</Button>
    }
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Rules"
        subtitle="Manage business rules by module with builder-based Match Stakes summaries"
        actions={
          <>
            <Button type="primary" onClick={() => navigate("/rules/new?module=MATCH_STAKES")}>
              Create Match Stakes Rule
            </Button>
            <Button onClick={() => navigate("/rules/new?module=GROUP_FUND")}>Create Group Fund Rule</Button>
          </>
        }
      />

      <FilterBar>
        <div className="space-y-3">
          <Tabs
            activeKey={module}
            onChange={(value) => {
              setModule(value as ModuleTabValue);
              setPage(1);
            }}
            items={moduleTabs.map((item) => ({ key: item.key, label: item.label }))}
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Segmented
              block
              value={status}
              onChange={(value) => {
                setStatus(value as typeof status);
                setPage(1);
              }}
              options={[
                { label: "All", value: "ALL" },
                { label: "Active", value: "ACTIVE" },
                { label: "Inactive", value: "INACTIVE" }
              ]}
            />

            <Segmented
              block
              value={defaultFilter}
              onChange={(value) => {
                setDefaultFilter(value as typeof defaultFilter);
                setPage(1);
              }}
              options={[
                { label: "All", value: "ALL" },
                { label: "Default", value: "DEFAULT" },
                { label: "Non-default", value: "NON_DEFAULT" }
              ]}
            />
          </div>
        </div>
      </FilterBar>

      <SectionCard title="Results" description="Business-focused listing with latest version snapshots">
        {items.length === 0 ? (
          <EmptyState
            title="No rules found"
            description="Try a different filter or create a new rule."
            actionLabel="Create Match Stakes Rule"
            onAction={() => navigate("/rules/new?module=MATCH_STAKES")}
          />
        ) : isMobile ? (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{item.name}</div>
                    <div className="text-xs text-slate-500">{item.code}</div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    <Tag>{moduleLabels[item.module]}</Tag>
                    <Tag color={item.status === "ACTIVE" ? "green" : "default"}>{ruleStatusLabels[item.status]}</Tag>
                    {item.isDefault ? <Tag color="blue">Default</Tag> : null}
                  </div>
                </div>

                <div className="mt-2 text-sm text-slate-600">{item.description || "No description"}</div>
                <div className="mt-2 rounded-lg bg-slate-50 p-2">
                  <LatestVersionSummary ruleSetId={item.id} />
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Updated: {formatDateTime(item.updatedAt)} | Created: {formatDateTime(item.createdAt)}
                </div>
                <div className="mt-3">
                  <Button block onClick={() => navigate(`/rules/${item.id}`)}>
                    View detail
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Table rowKey="id" dataSource={items} columns={columns} pagination={false} size="middle" />
        )}

        <div className="mt-4 flex justify-center">
          <Pagination
            current={meta?.page ?? page}
            pageSize={meta?.pageSize ?? pageSize}
            total={meta?.total ?? 0}
            showSizeChanger={false}
            onChange={setPage}
          />
        </div>
      </SectionCard>
    </PageContainer>
  );
};
