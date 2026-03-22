import { useMemo, useState } from "react";
import { Button, Card, Pagination, Segmented, Select, Tag } from "antd";
import { useNavigate } from "react-router-dom";
import { useRuleSets } from "@/features/rules/hooks";
import { PageLoading } from "@/components/states/PageLoading";
import { ErrorState } from "@/components/states/ErrorState";
import { EmptyState } from "@/components/states/EmptyState";

export const RulesListPage = () => {
  const navigate = useNavigate();
  const [module, setModule] = useState<"ALL" | "MATCH_STAKES" | "GROUP_FUND">("ALL");
  const [status, setStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [defaultFilter, setDefaultFilter] = useState<"ALL" | "DEFAULT" | "NON_DEFAULT">("ALL");
  const [page, setPage] = useState(1);

  const query = useMemo(
    () => ({
      module: module === "ALL" ? undefined : module,
      status: status === "ALL" ? undefined : status,
      isDefault: defaultFilter === "ALL" ? undefined : defaultFilter === "DEFAULT",
      page,
      pageSize: 12
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Rules</h2>
        <Button type="primary" onClick={() => navigate("/rules/new")}>New Rule Set</Button>
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Select
            value={module}
            onChange={(value) => {
              setModule(value);
              setPage(1);
            }}
            options={[
              { label: "All modules", value: "ALL" },
              { label: "Match Stakes", value: "MATCH_STAKES" },
              { label: "Group Fund", value: "GROUP_FUND" }
            ]}
          />

          <Segmented
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
      </Card>

      {items.length === 0 ? (
        <EmptyState title="No rule sets" description="Create your first rule set." actionLabel="Create" onAction={() => navigate("/rules/new")} />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {items.map((item) => (
            <Card key={item.id} className="!rounded-2xl">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{item.name}</div>
                  <div className="flex gap-1">
                    <Tag>{item.module}</Tag>
                    <Tag color={item.status === "ACTIVE" ? "green" : "default"}>{item.status}</Tag>
                    {item.isDefault ? <Tag color="blue">Default</Tag> : null}
                  </div>
                </div>
                <div className="text-xs text-slate-500">Code: {item.code}</div>
                <div className="text-sm text-slate-600">{item.description || "No description"}</div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={() => navigate(`/rules/${item.id}`)}>Detail</Button>
                  <Button onClick={() => navigate(`/rules/${item.id}/edit`)}>Edit</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-center">
        <Pagination
          current={meta?.page ?? page}
          pageSize={meta?.pageSize ?? 12}
          total={meta?.total ?? 0}
          showSizeChanger={false}
          onChange={setPage}
        />
      </div>
    </div>
  );
};
