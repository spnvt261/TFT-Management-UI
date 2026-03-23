import { List, Typography } from "antd";
import { useState } from "react";
import { useDashboardOverview } from "@/features/dashboard/hooks";
import { PageLoading } from "@/components/states/PageLoading";
import { ErrorState } from "@/components/states/ErrorState";
import { EmptyState } from "@/components/states/EmptyState";
import { formatDateTime, formatVnd } from "@/lib/format";
import { MatchDetailOverlay } from "@/features/matches/MatchDetailOverlay";
import { AppBreadcrumb } from "@/components/layout/AppBreadcrumb";
import { MetricCard } from "@/components/layout/MetricCard";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/layout/SectionCard";

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
    <PageContainer>
      <AppBreadcrumb items={[{ label: "Dashboard" }]} />

      <PageHeader title="Dashboard" subtitle="Quick overview of players, modules, and latest matches." />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Players" value={data.playerCount} />
        <MetricCard label="Total matches" value={data.totalMatches} />
        <MetricCard label="Match Stakes matches" value={data.matchStakes.totalMatches} />
        <MetricCard label="Group Fund balance" value={formatVnd(data.groupFund.fundBalanceVnd)} />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard title="Top Match Stakes Players" description="Highest net balance performers">
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
        </SectionCard>

        <SectionCard title="Top Contributors" description="Largest Group Fund contributors">
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
        </SectionCard>
      </section>

      <SectionCard title="Recent Matches" description="Tap any item to view full match detail">
        {data.recentMatches.length === 0 ? (
          <EmptyState title="No recent matches" />
        ) : (
          <List
            dataSource={data.recentMatches}
            renderItem={(match) => (
              <List.Item className="!px-0">
                <button
                  className="focus-ring w-full rounded-xl border border-slate-200/90 bg-white p-3 text-left transition hover:border-brand-500"
                  onClick={() => setSelectedMatchId(match.id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <Typography.Text strong>{match.ruleSetName}</Typography.Text>
                    <Typography.Text type="secondary" className="text-xs">
                      {formatDateTime(match.playedAt)}
                    </Typography.Text>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span className="truncate">
                      {match.participants.map((participant) => `${participant.playerName} #${participant.tftPlacement}`).join(" | ")}
                    </span>
                    <span>{formatVnd(match.totalTransferVnd)}</span>
                  </div>
                </button>
              </List.Item>
            )}
          />
        )}
      </SectionCard>

      <MatchDetailOverlay open={Boolean(selectedMatchId)} matchId={selectedMatchId} onClose={() => setSelectedMatchId(undefined)} />
    </PageContainer>
  );
};
