import { useEffect, useMemo, useState } from "react";
import { FilterOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { Badge, Button, Checkbox, DatePicker, Input, Modal, Pagination, Radio, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import { useAllRuleSets, useRuleSetDetail } from "@/features/rules/hooks";
import { normalizeMatchStakesBuilderConfig, summarizeMatchStakesBuilder } from "@/features/rules/builder-utils";
import { RulesBreadcrumb } from "@/features/rules/components";
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

type StatusFilterValue = "ALL" | "ACTIVE" | "INACTIVE";
type DefaultFilterValue = "ALL" | "DEFAULT" | "NON_DEFAULT";

interface RuleListFilters {
  name: string;
  modules: ModuleType[];
  status: StatusFilterValue;
  defaultFilter: DefaultFilterValue;
  updatedFrom?: string;
  updatedTo?: string;
}

const createDefaultFilters = (): RuleListFilters => ({
  name: "",
  modules: [],
  status: "ALL",
  defaultFilter: "ALL",
  updatedFrom: undefined,
  updatedTo: undefined
});

const moduleOptions: Array<{ label: string; value: ModuleType }> = [
  { label: "Match Stakes", value: "MATCH_STAKES" },
  { label: "Group Fund", value: "GROUP_FUND" }
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

  const [page, setPage] = useState(1);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState<RuleListFilters>(() => createDefaultFilters());
  const [draftFilters, setDraftFilters] = useState<RuleListFilters>(() => createDefaultFilters());

  const ruleSetsQuery = useAllRuleSets();
  const allRuleSets = ruleSetsQuery.data ?? [];
  const trimmedName = filters.name.trim().toLowerCase();

  const filteredItems = useMemo(() => {
    const fromDate = filters.updatedFrom ? dayjs(filters.updatedFrom) : null;
    const toDate = filters.updatedTo ? dayjs(filters.updatedTo) : null;

    return allRuleSets.filter((item) => {
      if (filters.modules.length > 0 && !filters.modules.includes(item.module)) {
        return false;
      }

      if (filters.status !== "ALL" && item.status !== filters.status) {
        return false;
      }

      if (filters.defaultFilter === "DEFAULT" && !item.isDefault) {
        return false;
      }

      if (filters.defaultFilter === "NON_DEFAULT" && item.isDefault) {
        return false;
      }

      if (trimmedName.length > 0 && !item.name.toLowerCase().includes(trimmedName)) {
        return false;
      }

      const updatedAt = dayjs(item.updatedAt);
      if (fromDate && updatedAt.isBefore(fromDate, "day")) {
        return false;
      }

      if (toDate && updatedAt.isAfter(toDate, "day")) {
        return false;
      }

      return true;
    });
  }, [allRuleSets, filters.defaultFilter, filters.modules, filters.status, filters.updatedFrom, filters.updatedTo, trimmedName]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const items = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page]);

  const activeFilterCount = useMemo(() => {
    let count = 0;

    if (filters.name.trim().length > 0) {
      count += 1;
    }

    if (filters.modules.length > 0) {
      count += 1;
    }

    if (filters.status !== "ALL") {
      count += 1;
    }

    if (filters.defaultFilter !== "ALL") {
      count += 1;
    }

    if (filters.updatedFrom || filters.updatedTo) {
      count += 1;
    }

    return count;
  }, [filters]);

  const hasInvalidDraftDateRange = Boolean(
    draftFilters.updatedFrom && draftFilters.updatedTo && dayjs(draftFilters.updatedFrom).isAfter(dayjs(draftFilters.updatedTo), "day")
  );

  const openFilterModal = () => {
    setDraftFilters(filters);
    setIsFilterModalOpen(true);
  };

  const clearAppliedFilters = () => {
    const next = createDefaultFilters();
    setFilters(next);
    setDraftFilters(next);
    setPage(1);
  };

  if (ruleSetsQuery.isLoading) {
    return <PageLoading label="Loading rule sets..." />;
  }

  if (ruleSetsQuery.isError) {
    return <ErrorState onRetry={() => void ruleSetsQuery.refetch()} />;
  }

  const columns: ColumnsType<RuleSetDto> = [
    {
      title: "Rule Set",
      dataIndex: "name",
      key: "name",
      width: 200,
      render: (_, record) => (
        <div>
          <Button
            type="link"
            className="!h-auto !px-0 !font-medium underline"
            onClick={() => navigate(`/rules/${record.id}`)}
          >
            {record.name}
          </Button>
          <div className="text-xs text-slate-500 truncate max-w-[200px]">
            {record.description || "No description"}
          </div>
        </div>
      )
    },
    {
      title: "Tags",
      key: "tags",
      width: 200,
      render: (_, record) => (
        <div className="flex flex-wrap gap-1">
          <Tag>{moduleLabels[record.module]}</Tag>
          <Tag color={record.status === "ACTIVE" ? "green" : "default"}>
            {ruleStatusLabels[record.status]}
          </Tag>
          {record.isDefault ? <Tag color="blue">Default</Tag> : null}
        </div>
      )
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
      <RulesBreadcrumb items={[{ label: "Rules" }]} />

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
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-600">
            {activeFilterCount === 0 ? "Showing all rules" : `${activeFilterCount} filter(s) applied`}
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 ? <Button onClick={clearAppliedFilters}>Clear filters</Button> : null}
            <Badge count={activeFilterCount} size="small">
              <Button icon={<FilterOutlined />} onClick={openFilterModal}>
                Filters
              </Button>
            </Badge>
          </div>
        </div>
      </FilterBar>

      <Modal
        title="Filter rules"
        open={isFilterModalOpen}
        destroyOnHidden
        onCancel={() => setIsFilterModalOpen(false)}
        footer={[
          <Button
            key="reset"
            onClick={() => {
              setDraftFilters(createDefaultFilters());
            }}
          >
            Reset
          </Button>,
          <Button key="cancel" onClick={() => setIsFilterModalOpen(false)}>
            Cancel
          </Button>,
          <Button
            key="apply"
            type="primary"
            disabled={hasInvalidDraftDateRange}
            onClick={() => {
              if (hasInvalidDraftDateRange) {
                return;
              }

              setFilters(draftFilters);
              setPage(1);
              setIsFilterModalOpen(false);
            }}
          >
            Apply
          </Button>
        ]}
      >
        <div className="space-y-4">
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Rule name</div>
            <Input
              allowClear
              placeholder="Search by name"
              value={draftFilters.name}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  name: event.target.value
                }))
              }
            />
          </div>

          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Modules</div>
            <Checkbox.Group
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
              value={draftFilters.modules}
              options={moduleOptions}
              onChange={(value) =>
                setDraftFilters((current) => ({
                  ...current,
                  modules: value as ModuleType[]
                }))
              }
            />
          </div>

          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Status</div>
            <Radio.Group
              value={draftFilters.status}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  status: event.target.value as StatusFilterValue
                }))
              }
              options={[
                { label: "All", value: "ALL" },
                { label: "Active", value: "ACTIVE" },
                { label: "Inactive", value: "INACTIVE" }
              ]}
            />
          </div>

          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Default</div>
            <Radio.Group
              value={draftFilters.defaultFilter}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  defaultFilter: event.target.value as DefaultFilterValue
                }))
              }
              options={[
                { label: "All", value: "ALL" },
                { label: "Default", value: "DEFAULT" },
                { label: "Non-default", value: "NON_DEFAULT" }
              ]}
            />
          </div>

          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Updated date</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DatePicker
                className="w-full"
                placeholder="From date"
                value={draftFilters.updatedFrom ? dayjs(draftFilters.updatedFrom) : null}
                onChange={(value) =>
                  setDraftFilters((current) => ({
                    ...current,
                    updatedFrom: value ? value.format("YYYY-MM-DD") : undefined
                  }))
                }
              />
              <DatePicker
                className="w-full"
                placeholder="To date"
                value={draftFilters.updatedTo ? dayjs(draftFilters.updatedTo) : null}
                onChange={(value) =>
                  setDraftFilters((current) => ({
                    ...current,
                    updatedTo: value ? value.format("YYYY-MM-DD") : undefined
                  }))
                }
              />
            </div>
            {hasInvalidDraftDateRange ? (
              <div className="mt-1 text-xs text-red-600">From date must be before or equal to To date.</div>
            ) : null}
          </div>
        </div>
      </Modal>

      <SectionCard title="Results" description="Business-focused listing with latest version snapshots">
        {items.length === 0 ? (
          <EmptyState
            title="No rules found"
            description="Try a different filter/search or create a new rule."
            actionLabel="Create Match Stakes Rule"
            onAction={() => navigate("/rules/new?module=MATCH_STAKES")}
          />
        ) : isMobile ? (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Button
                      type="link"
                      className="!h-auto !px-0 !font-semibold"
                      onClick={() => navigate(`/rules/${item.id}`)}
                    >
                      {item.name}
                    </Button>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    <Tag>{moduleLabels[item.module]}</Tag>
                    <Tag color={item.status === "ACTIVE" ? "green" : "default"}>{ruleStatusLabels[item.status]}</Tag>
                    {item.isDefault ? <Tag color="blue">Default</Tag> : null}
                  </div>
                </div>

                <div className="mt-2 text-sm text-slate-600 truncate">
                  {item.description || "No description"}
                </div>
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
            current={page}
            pageSize={pageSize}
            total={filteredItems.length}
            showSizeChanger={false}
            onChange={setPage}
          />
        </div>
      </SectionCard>
    </PageContainer>
  );
};
