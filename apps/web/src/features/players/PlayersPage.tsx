import { useMemo, useState } from "react";
import { Button, Input, Pagination, Segmented, Tag } from "antd";
import { useNavigate } from "react-router-dom";
import { useDeactivatePlayer, usePlayers, useUpdatePlayer } from "@/features/players/hooks";
import { useAuth } from "@/features/auth/AuthContext";
import { guardWritePermission } from "@/features/auth/permissions";
import { PageLoading } from "@/components/states/PageLoading";
import { ErrorState } from "@/components/states/ErrorState";
import { EmptyState } from "@/components/states/EmptyState";
import { ConfirmDanger } from "@/components/common/ConfirmDanger";
import type { PlayerDto } from "@/types/api";
import { AppBreadcrumb } from "@/components/layout/AppBreadcrumb";
import { FilterBar } from "@/components/layout/FilterBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/layout/SectionCard";

export const PlayersPage = () => {
  const [search, setSearch] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState<"all" | "active" | "inactive">("active");
  const [page, setPage] = useState(1);
  const [targetPlayer, setTargetPlayer] = useState<PlayerDto | null>(null);
  const navigate = useNavigate();
  const { canWrite } = useAuth();
  const canWriteActions = canWrite();

  const query = useMemo(
    () => ({
      page,
      pageSize: 12,
      search: search || undefined,
      isActive: isActiveFilter === "all" ? undefined : isActiveFilter === "active"
    }),
    [search, isActiveFilter, page]
  );

  const playersQuery = usePlayers(query);
  const deactivateMutation = useDeactivatePlayer();
  const reactivateMutation = useUpdatePlayer(targetPlayer?.id ?? "");

  if (playersQuery.isLoading) {
    return <PageLoading label="Loading players..." />;
  }

  if (playersQuery.isError) {
    return <ErrorState onRetry={() => void playersQuery.refetch()} />;
  }

  const players = playersQuery.data?.data ?? [];
  const meta = playersQuery.data?.meta;

  return (
    <PageContainer>
      <AppBreadcrumb items={[{ label: "Players" }]} />

      <PageHeader
        title="Players"
        subtitle="Manage active members for match entry and rule resolution."
        actions={
          <Button type="primary" disabled={!canWriteActions} onClick={() => canWriteActions && navigate("/players/new")}>
            New Player
          </Button>
        }
      />

      <FilterBar>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,380px)_auto] md:items-center md:justify-between">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search players"
            allowClear
          />
          <Segmented
            value={isActiveFilter}
            options={[
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
              { label: "All", value: "all" }
            ]}
            onChange={(value) => {
              setIsActiveFilter(value as typeof isActiveFilter);
              setPage(1);
            }}
          />
        </div>
      </FilterBar>

      <SectionCard title="Players" description="Search results with status and quick actions">
        {players.length === 0 ? (
          <EmptyState title="No players found" description="Try changing search or filters." />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {players.map((player) => (
                <div key={player.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-slate-900">{player.displayName}</div>
                      <Tag color={player.isActive ? "green" : "default"}>{player.isActive ? "Active" : "Inactive"}</Tag>
                    </div>

                    <div className="text-xs text-slate-500">Slug: {player.slug ?? "-"}</div>

                    <div className="flex gap-2">
                      <Button block disabled={!canWriteActions} onClick={() => canWriteActions && navigate(`/players/${player.id}/edit`)}>
                        Edit
                      </Button>
                      {player.isActive ? (
                        <Button block danger disabled={!canWriteActions} onClick={() => canWriteActions && setTargetPlayer(player)}>
                          Deactivate
                        </Button>
                      ) : (
                        <Button
                          block
                          type="primary"
                          disabled={!canWriteActions}
                          loading={reactivateMutation.isPending && targetPlayer?.id === player.id}
                          onClick={async () => {
                            if (!guardWritePermission(canWriteActions)) {
                              return;
                            }
                            setTargetPlayer(player);
                            await reactivateMutation.mutateAsync({ isActive: true });
                            setTargetPlayer(null);
                          }}
                        >
                          Reactivate
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-center">
              <Pagination
                current={meta?.page ?? page}
                pageSize={meta?.pageSize ?? 12}
                total={meta?.total ?? players.length}
                onChange={setPage}
                showSizeChanger={false}
              />
            </div>
          </>
        )}
      </SectionCard>

      <ConfirmDanger
        open={Boolean(targetPlayer?.isActive)}
        title="Deactivate player?"
        description={`This will mark ${targetPlayer?.displayName ?? "player"} as inactive and hide them from quick-entry choices.`}
        confirmText="Deactivate"
        confirmDisabled={!canWriteActions}
        loading={deactivateMutation.isPending}
        onCancel={() => setTargetPlayer(null)}
        onConfirm={async () => {
          if (!guardWritePermission(canWriteActions)) {
            return;
          }
          if (!targetPlayer) {
            return;
          }
          await deactivateMutation.mutateAsync(targetPlayer.id);
          setTargetPlayer(null);
        }}
      />
    </PageContainer>
  );
};
