import { Card, List, Typography } from "antd";
import { useState } from "react";
import { useDashboardOverview } from "@/features/dashboard/hooks";
import { PageLoading } from "@/components/states/PageLoading";
import { ErrorState } from "@/components/states/ErrorState";
import { EmptyState } from "@/components/states/EmptyState";
import { formatDateTime, formatVnd } from "@/lib/format";
import { MatchDetailOverlay } from "@/features/matches/MatchDetailOverlay";

export const DashboardPage = () => {
  const [selectedMatchId, setSelectedMatchId] = useState<string>();
  const overviewQuery = useDashboardOverview();

  if (overviewQuery.isLoading) {
    return <PageLoading label="Loading dashboard..." />;
  }

  if (overviewQuery.isError) {
    return <ErrorState onRetry={() => void overviewQuery.refetch()} />;
  }

  const data = overviewQuery.data;
  if (!data) {
    return <EmptyState title="No dashboard data" />;
  }

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="text-xs text-slate-500">Players</div>
          <div className="text-2xl font-bold">{data.playerCount}</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500">Total matches</div>
          <div className="text-2xl font-bold">{data.totalMatches}</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500">Match Stakes matches</div>
          <div className="text-2xl font-bold">{data.matchStakes.totalMatches}</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500">Group Fund balance</div>
          <div className="text-2xl font-bold">{formatVnd(data.groupFund.fundBalanceVnd)}</div>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Top Match Stakes Players">
          <List
            dataSource={data.matchStakes.topPlayers}
            locale={{ emptyText: "No data" }}
            renderItem={(item) => (
              <List.Item>
                <div className="flex w-full justify-between text-sm">
                  <span>{item.playerName}</span>
                  <span className={item.totalNetVnd >= 0 ? "text-green-700" : "text-red-700"}>{formatVnd(item.totalNetVnd)}</span>
                </div>
              </List.Item>
            )}
          />
        </Card>

        <Card title="Top Contributors">
          <List
            dataSource={data.groupFund.topContributors}
            locale={{ emptyText: "No data" }}
            renderItem={(item) => (
              <List.Item>
                <div className="flex w-full justify-between text-sm">
                  <span>{item.playerName}</span>
                  <span>{formatVnd(item.totalContributedVnd)}</span>
                </div>
              </List.Item>
            )}
          />
        </Card>
      </section>

      <Card title="Recent Matches">
        {data.recentMatches.length === 0 ? (
          <EmptyState title="No recent matches" />
        ) : (
          <List
            dataSource={data.recentMatches}
            renderItem={(match) => (
              <List.Item className="!px-0">
                <button
                  className="focus-ring w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-brand-500"
                  onClick={() => setSelectedMatchId(match.id)}
                >
                  <div className="flex items-center justify-between">
                    <Typography.Text strong>{match.ruleSetName}</Typography.Text>
                    <Typography.Text type="secondary" className="text-xs">
                      {formatDateTime(match.playedAt)}
                    </Typography.Text>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>{match.participants.map((participant) => `${participant.playerName} #${participant.tftPlacement}`).join(" | ")}</span>
                    <span>{formatVnd(match.totalTransferVnd)}</span>
                  </div>
                </button>
              </List.Item>
            )}
          />
        )}
      </Card>

      <MatchDetailOverlay open={Boolean(selectedMatchId)} matchId={selectedMatchId} onClose={() => setSelectedMatchId(undefined)} />
    </div>
  );
};
