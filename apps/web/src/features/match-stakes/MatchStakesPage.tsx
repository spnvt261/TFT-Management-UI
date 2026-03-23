import { useState } from "react";
import { Button, DatePicker, List, Pagination, Tabs, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { useMatchStakesLedger, useMatchStakesMatches, useMatchStakesSummary } from "@/features/match-stakes/hooks";
import { formatDateTime, formatVnd } from "@/lib/format";
import { PageLoading } from "@/components/states/PageLoading";
import { ErrorState } from "@/components/states/ErrorState";
import { EmptyState } from "@/components/states/EmptyState";
import { MatchDetailOverlay } from "@/features/matches/MatchDetailOverlay";
import { AppBreadcrumb } from "@/components/layout/AppBreadcrumb";
import { FilterBar } from "@/components/layout/FilterBar";
import { MetricCard } from "@/components/layout/MetricCard";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/layout/SectionCard";

export const MatchStakesPage = () => {
  const navigate = useNavigate();
  const [selectedMatchId, setSelectedMatchId] = useState<string>();
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState<string>();
  const [to, setTo] = useState<string>();

  const summaryQuery = useMatchStakesSummary({ from, to });
  const ledgerQuery = useMatchStakesLedger({ from, to, page, pageSize: 12 });
  const matchesQuery = useMatchStakesMatches({ from, to, page, pageSize: 12 });

  const loading = summaryQuery.isLoading || ledgerQuery.isLoading || matchesQuery.isLoading;
  const hasError = summaryQuery.isError || ledgerQuery.isError || matchesQuery.isError;

  const matchMeta = matchesQuery.data?.meta;
  const ledgerMeta = ledgerQuery.data?.meta;

  if (loading) {
    return <PageLoading label="Loading Match Stakes..." />;
  }

  if (hasError) {
    return (
      <ErrorState
        onRetry={() => {
          void summaryQuery.refetch();
          void ledgerQuery.refetch();
          void matchesQuery.refetch();
        }}
      />
    );
  }

  return (
    <PageContainer>
      <AppBreadcrumb items={[{ label: "Match Stakes" }]} />

      <PageHeader
        title="Match Stakes"
        subtitle="Monitor standings, debt movement, and settlement history."
        actions={
          <Button className="hidden md:inline-flex" type="primary" icon={<PlusOutlined />} onClick={() => navigate("/match-stakes/new")}>
            Create match
          </Button>
        }
      />

      <FilterBar>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,220px)_minmax(0,220px)_auto] md:items-center">
          <DatePicker
            className="w-full"
            placeholder="From date"
            value={from ? dayjs(from) : null}
            onChange={(value) => setFrom(value ? value.toISOString() : undefined)}
          />
          <DatePicker
            className="w-full"
            placeholder="To date"
            value={to ? dayjs(to) : null}
            onChange={(value) => setTo(value ? value.toISOString() : undefined)}
          />
          <div className="md:justify-self-end">
            <Button
              onClick={() => {
                setFrom(undefined);
                setTo(undefined);
                setPage(1);
              }}
            >
              Clear filters
            </Button>
          </div>
        </div>
      </FilterBar>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-[300px_1fr]">
        <MetricCard label="Total matches" value={summaryQuery.data?.totalMatches ?? 0} />
        <SectionCard title="Per-player net balance" bodyClassName="pt-4">
          {(summaryQuery.data?.players ?? []).length === 0 ? (
            <EmptyState title="No player net balance data" />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {(summaryQuery.data?.players ?? []).map((player) => (
                <div key={player.playerId} className="rounded-xl border border-slate-200 bg-slate-50/90 p-3.5">
                  <div className="text-sm font-semibold text-slate-900">{player.playerName}</div>
                  <div className={player.totalNetVnd >= 0 ? "mt-2 text-base font-semibold text-green-700" : "mt-2 text-base font-semibold text-red-700"}>
                    {formatVnd(player.totalNetVnd)}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">Matches: {player.totalMatches}</div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </section>

      <SectionCard title="Debt suggestions" description="Provided by backend summary payload">
        {summaryQuery.data?.debtSuggestions?.length ? (
          <pre className="overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
            {JSON.stringify(summaryQuery.data.debtSuggestions, null, 2)}
          </pre>
        ) : (
          <div className="text-sm text-slate-500">No debt suggestions currently returned by backend.</div>
        )}
      </SectionCard>

      <SectionCard title="History" description="Debt movements and match history">
        <Tabs
          items={[
            {
              key: "ledger",
              label: "Debt Movement",
              children:
                (ledgerQuery.data?.data ?? []).length === 0 ? (
                  <EmptyState title="No ledger entries" />
                ) : (
                  <div className="space-y-3">
                    {(ledgerQuery.data?.data ?? []).map((entry) => (
                      <button
                        key={entry.entryId}
                        className="focus-ring w-full rounded-xl border border-slate-200/90 bg-white p-3 text-left transition hover:border-brand-500"
                        onClick={() => entry.matchId && setSelectedMatchId(entry.matchId)}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs text-slate-500">{formatDateTime(entry.postedAt)}</div>
                          <div className="text-sm font-semibold">{formatVnd(entry.amountVnd)}</div>
                        </div>
                        <div className="mt-1 text-sm font-medium">
                          {entry.sourcePlayerName || "Fund/System"} -&gt; {entry.destinationPlayerName || "Fund/System"}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{entry.entryReason}</div>
                      </button>
                    ))}
                    <div className="flex justify-center pt-1">
                      <Pagination
                        current={ledgerMeta?.page ?? page}
                        pageSize={ledgerMeta?.pageSize ?? 12}
                        total={ledgerMeta?.total ?? 0}
                        showSizeChanger={false}
                        onChange={setPage}
                      />
                    </div>
                  </div>
                )
            },
            {
              key: "matches",
              label: "Match History",
              children:
                (matchesQuery.data?.data ?? []).length === 0 ? (
                  <EmptyState title="No matches" />
                ) : (
                  <div className="space-y-3">
                    <List
                      dataSource={matchesQuery.data?.data ?? []}
                      renderItem={(item) => (
                        <List.Item className="!px-0">
                          <button
                            className="focus-ring w-full rounded-xl border border-slate-200/90 bg-white p-3 text-left transition hover:border-brand-500"
                            onClick={() => setSelectedMatchId(item.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold">{formatDateTime(item.playedAt)}</div>
                              <Tag>{`v${item.ruleSetVersionNo}`}</Tag>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">{item.ruleSetName}</div>
                            <div className="mt-2 text-xs text-slate-600">
                              {item.participants.map((participant) => `${participant.playerName} #${participant.tftPlacement}`).join(" | ")}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">Transfer: {formatVnd(item.totalTransferVnd)}</div>
                          </button>
                        </List.Item>
                      )}
                    />
                    <div className="flex justify-center pt-1">
                      <Pagination
                        current={matchMeta?.page ?? page}
                        pageSize={matchMeta?.pageSize ?? 12}
                        total={matchMeta?.total ?? 0}
                        showSizeChanger={false}
                        onChange={setPage}
                      />
                    </div>
                  </div>
                )
            }
          ]}
        />
      </SectionCard>

      <Button
        type="primary"
        shape="circle"
        size="large"
        icon={<PlusOutlined />}
        className="fixed bottom-6 right-6 z-20 h-14 w-14 shadow-lg md:hidden"
        aria-label="Create match stakes match"
        onClick={() => navigate("/match-stakes/new")}
      />

      <MatchDetailOverlay open={Boolean(selectedMatchId)} matchId={selectedMatchId} onClose={() => setSelectedMatchId(undefined)} />
    </PageContainer>
  );
};
