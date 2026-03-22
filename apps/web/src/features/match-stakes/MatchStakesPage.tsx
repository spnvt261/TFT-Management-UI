import { useMemo, useState } from "react";
import { Button, Card, DatePicker, List, Pagination, Tabs, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useMatchStakesLedger, useMatchStakesMatches, useMatchStakesSummary } from "@/features/match-stakes/hooks";
import { formatDateTime, formatVnd } from "@/lib/format";
import { PageLoading } from "@/components/states/PageLoading";
import { ErrorState } from "@/components/states/ErrorState";
import { EmptyState } from "@/components/states/EmptyState";
import { MatchDetailOverlay } from "@/features/matches/MatchDetailOverlay";
import { QuickMatchEntry } from "@/features/quick-match/QuickMatchEntry";

export const MatchStakesPage = () => {
  const [selectedMatchId, setSelectedMatchId] = useState<string>();
  const [quickOpen, setQuickOpen] = useState(false);
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Match Stakes</h2>
        <Button type="primary" icon={<PlusOutlined />} className="hidden md:inline-flex" onClick={() => setQuickOpen(true)}>
          Quick add match
        </Button>
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card>
          <div className="text-xs text-slate-500">Total matches</div>
          <div className="text-2xl font-bold">{summaryQuery.data?.totalMatches ?? 0}</div>
        </Card>
        <Card className="lg:col-span-2">
          <div className="text-xs text-slate-500">Per-player net balance</div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(summaryQuery.data?.players ?? []).map((player) => (
              <div key={player.playerId} className="rounded-xl bg-slate-50 p-3 text-sm">
                <div className="font-medium">{player.playerName}</div>
                <div className={player.totalNetVnd >= 0 ? "text-green-700" : "text-red-700"}>{formatVnd(player.totalNetVnd)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-3 text-sm font-medium">Debt suggestions</div>
        {summaryQuery.data?.debtSuggestions?.length ? (
          <pre className="overflow-auto rounded-xl bg-slate-50 p-3 text-xs">{JSON.stringify(summaryQuery.data.debtSuggestions, null, 2)}</pre>
        ) : (
          <div className="text-sm text-slate-500">No debt suggestions currently returned by backend.</div>
        )}
      </Card>

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
                      className="focus-ring w-full rounded-2xl border border-slate-200 bg-white p-3 text-left"
                      onClick={() => entry.matchId && setSelectedMatchId(entry.matchId)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-slate-500">{formatDateTime(entry.postedAt)}</div>
                        <div className="text-sm font-semibold">{formatVnd(entry.amountVnd)}</div>
                      </div>
                      <div className="mt-1 text-sm font-medium">
                        {entry.sourcePlayerName || "Fund/System"} ? {entry.destinationPlayerName || "Fund/System"}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{entry.entryReason}</div>
                    </button>
                  ))}
                  <div className="flex justify-center">
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
                          className="focus-ring w-full rounded-2xl border border-slate-200 p-3 text-left"
                          onClick={() => setSelectedMatchId(item.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold">{formatDateTime(item.playedAt)}</div>
                            <Tag>{`v${item.ruleSetVersionNo}`}</Tag>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{item.ruleSetName}</div>
                          <div className="mt-2 text-xs">{item.participants.map((participant) => `${participant.playerName} #${participant.tftPlacement}`).join(" | ")}</div>
                          <div className="mt-1 text-xs text-slate-500">Transfer: {formatVnd(item.totalTransferVnd)}</div>
                        </button>
                      </List.Item>
                    )}
                  />
                  <div className="flex justify-center">
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

      <Button
        type="primary"
        shape="circle"
        size="large"
        icon={<PlusOutlined />}
        className="fixed bottom-6 right-6 z-20 h-14 w-14 shadow-lg md:hidden"
        aria-label="Quick add match stakes match"
        onClick={() => setQuickOpen(true)}
      />

      <QuickMatchEntry open={quickOpen} module="MATCH_STAKES" onClose={() => setQuickOpen(false)} />
      <MatchDetailOverlay open={Boolean(selectedMatchId)} matchId={selectedMatchId} onClose={() => setSelectedMatchId(undefined)} />
    </div>
  );
};
