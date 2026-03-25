import { useMemo, useState } from "react";
import { AppstoreOutlined, EyeInvisibleOutlined, EyeOutlined, FilterOutlined, PlusOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, DatePicker, Input, InputNumber, Modal, Pagination, Select, Skeleton, Tag, Tooltip, message } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { toAppError } from "@/api/httpClient";
import { FormApiError } from "@/components/common/FormApiError";
import { AppBreadcrumb } from "@/components/layout/AppBreadcrumb";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/layout/SectionCard";
import { useAuth } from "@/features/auth/AuthContext";
import { guardWritePermission } from "@/features/auth/permissions";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import {
  useCreateGroupFundTransaction,
  useGroupFundLedger,
  useGroupFundMatches,
  useGroupFundSummary,
  useGroupFundTransactions
} from "@/features/group-fund/hooks";
import { manualTransactionSchema, type ManualTransactionValues } from "@/features/group-fund/schemas";
import { MatchDetailOverlay } from "@/features/matches/MatchDetailOverlay";
import { useActivePlayers } from "@/features/players/hooks";
import { getErrorMessage } from "@/lib/error-messages";
import { formatDateTime, formatVnd, nowIso } from "@/lib/format";
import { groupFundTransactionLabels } from "@/lib/labels";
import type { GroupFundTransactionType } from "@/types/api";

type HistoryViewMode = "minimal" | "detail";

const DEFAULT_PAGE_SIZE = 12;

const getObligationClassName = (value: number) => {
  if (value > 0) {
    return "text-rose-700";
  }

  if (value < 0) {
    return "text-emerald-700";
  }

  return "text-slate-700";
};

const getObligationCardToneClassName = (value: number) => {
  if (value > 0) {
    return "border-rose-300 bg-rose-50/80";
  }

  if (value < 0) {
    return "border-emerald-300 bg-emerald-50/80";
  }

  return "border-slate-300 bg-slate-50/80";
};

const toIsoValue = (value: Dayjs | null) => (value ? value.toISOString() : undefined);

export const GroupFundPage = () => {
  const navigate = useNavigate();
  const { canWrite } = useAuth();
  const canWriteActions = canWrite();
  const [selectedMatchId, setSelectedMatchId] = useState<string>();

  const [historyViewMode, setHistoryViewMode] = useState<HistoryViewMode>("minimal");
  const [showFundSnapshot, setShowFundSnapshot] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [from, setFrom] = useState<string>();
  const [to, setTo] = useState<string>();
  const [playerId, setPlayerId] = useState<string>();
  const [transactionType, setTransactionType] = useState<GroupFundTransactionType>();
  const [draftFrom, setDraftFrom] = useState<Dayjs | null>(null);
  const [draftTo, setDraftTo] = useState<Dayjs | null>(null);
  const [draftPlayerId, setDraftPlayerId] = useState<string>();
  const [draftTransactionType, setDraftTransactionType] = useState<GroupFundTransactionType>();

  const [matchPage, setMatchPage] = useState(1);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [transactionPage, setTransactionPage] = useState(1);

  const [transactionOpen, setTransactionOpen] = useState(false);
  const [transactionApiError, setTransactionApiError] = useState<string | null>(null);

  const summaryQuery = useGroupFundSummary({ from, to });
  const matchesQuery = useGroupFundMatches({ from, to, playerId, page: matchPage, pageSize: DEFAULT_PAGE_SIZE });
  const ledgerQuery = useGroupFundLedger({ from, to, playerId, page: ledgerPage, pageSize: DEFAULT_PAGE_SIZE });
  const transactionsQuery = useGroupFundTransactions({
    from,
    to,
    playerId,
    transactionType,
    page: transactionPage,
    pageSize: DEFAULT_PAGE_SIZE
  });
  const playersQuery = useActivePlayers();
  const createTransactionMutation = useCreateGroupFundTransaction();

  const {
    control,
    watch,
    reset,
    handleSubmit,
    formState: { errors }
  } = useForm<ManualTransactionValues>({
    resolver: zodResolver(manualTransactionSchema),
    defaultValues: {
      transactionType: "CONTRIBUTION",
      playerId: "",
      amountVnd: 0,
      reason: "",
      postedAt: nowIso()
    }
  });

  const selectedTransactionType = watch("transactionType");
  const transactionTypeOptions = useMemo(
    () => Object.entries(groupFundTransactionLabels).map(([value, label]) => ({ value, label })),
    []
  );
  const playerOptions = useMemo(
    () => (playersQuery.data ?? []).map((player) => ({ value: player.id, label: player.displayName })),
    [playersQuery.data]
  );

  const hasNonDefaultFilters = Boolean(from || to || playerId || transactionType);

  const sortedObligations = useMemo(() => {
    const next = [...(summaryQuery.data?.players ?? [])];
    next.sort((left, right) => {
      if (left.currentObligationVnd !== right.currentObligationVnd) {
        return right.currentObligationVnd - left.currentObligationVnd;
      }

      return left.playerName.localeCompare(right.playerName);
    });

    return next;
  }, [summaryQuery.data?.players]);

  const totalObligation = sortedObligations.reduce((sum, player) => sum + player.currentObligationVnd, 0);
  const totalContributed = sortedObligations.reduce((sum, player) => sum + player.totalContributedVnd, 0);

  const openFilterModal = () => {
    setDraftFrom(from ? dayjs(from) : null);
    setDraftTo(to ? dayjs(to) : null);
    setDraftPlayerId(playerId);
    setDraftTransactionType(transactionType);
    setFilterOpen(true);
  };

  const applyFilters = () => {
    setFrom(toIsoValue(draftFrom));
    setTo(toIsoValue(draftTo));
    setPlayerId(draftPlayerId);
    setTransactionType(draftTransactionType);
    setMatchPage(1);
    setLedgerPage(1);
    setTransactionPage(1);
    setFilterOpen(false);
  };

  const resetFilters = () => {
    setFrom(undefined);
    setTo(undefined);
    setPlayerId(undefined);
    setTransactionType(undefined);
    setDraftFrom(null);
    setDraftTo(null);
    setDraftPlayerId(undefined);
    setDraftTransactionType(undefined);
    setMatchPage(1);
    setLedgerPage(1);
    setTransactionPage(1);
    setFilterOpen(false);
  };

  const openTransactionModal = () => {
    if (!guardWritePermission(canWriteActions)) {
      return;
    }

    setTransactionApiError(null);
    reset({
      transactionType: "CONTRIBUTION",
      playerId: "",
      amountVnd: 0,
      reason: "",
      postedAt: nowIso()
    });
    setTransactionOpen(true);
  };

  const historyError = matchesQuery.error ?? ledgerQuery.error ?? transactionsQuery.error;
  const historyIsError = matchesQuery.isError || ledgerQuery.isError || transactionsQuery.isError;

  return (
    <PageContainer>
      <AppBreadcrumb items={[{ label: "Group Fund" }]} />

      <PageHeader
        title="Group Fund"
        subtitle="Fund health overview: current obligations first, then detailed history."
        actions={
          <>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={!canWriteActions}
              onClick={() => canWriteActions && navigate("/group-fund/new")}
            >
              Create match
            </Button>
            <Button disabled={!canWriteActions} onClick={openTransactionModal}>
              Manual transaction
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Tooltip title={showFundSnapshot ? "Hide Fund Snapshot" : "Show Fund Snapshot"}>
          <Button
            icon={showFundSnapshot ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            onClick={() => setShowFundSnapshot((previous) => !previous)}
          />
        </Tooltip>
        <Tooltip title="Filter Group Fund history and summary">
          <Button icon={<FilterOutlined />} onClick={openFilterModal} />
        </Tooltip>
        <Button onClick={resetFilters} disabled={!hasNonDefaultFilters}>
          Reset filters
        </Button>
      </div>

      {showFundSnapshot ? (
        <SectionCard title="Fund Snapshot" description="Summary metrics for the selected date range and player filters.">
          {summaryQuery.isLoading ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : summaryQuery.isError ? (
            <ErrorState description={getErrorMessage(toAppError(summaryQuery.error))} onRetry={() => void summaryQuery.refetch()} />
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Fund balance</div>
                  <div className="mt-1 font-semibold text-slate-900">{formatVnd(summaryQuery.data?.fundBalanceVnd ?? 0)}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Total matches</div>
                  <div className="mt-1 font-semibold text-slate-900">{summaryQuery.data?.totalMatches ?? 0}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Players tracked</div>
                  <div className="mt-1 font-semibold text-slate-900">{sortedObligations.length}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Total obligations</div>
                  <div className={`mt-1 font-semibold ${getObligationClassName(totalObligation)}`}>{formatVnd(totalObligation)}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Total contributed</div>
                  <div className="mt-1 font-semibold text-slate-900">{formatVnd(totalContributed)}</div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <div>{`Range from: ${summaryQuery.data?.range.from ? formatDateTime(summaryQuery.data.range.from) : "All time"}`}</div>
                <div>{`Range to: ${summaryQuery.data?.range.to ? formatDateTime(summaryQuery.data.range.to) : "Now"}`}</div>
              </div>
            </div>
          )}
        </SectionCard>
      ) : null}

      <SectionCard
        title="Current Obligations"
        description="Current contribution and obligation status by player."
        className="overflow-hidden border-amber-400 shadow-xl shadow-amber-200/80"
        bodyClassName="bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50"
      >
        {summaryQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : summaryQuery.isError ? (
          <ErrorState description={getErrorMessage(toAppError(summaryQuery.error))} onRetry={() => void summaryQuery.refetch()} />
        ) : sortedObligations.length === 0 ? (
          <EmptyState title="No player data yet" description="Create Group Fund matches or manual transactions to see obligations." />
        ) : (
          <div className="space-y-2.5">
            {sortedObligations.map((player) => (
              <div key={player.playerId} className={`rounded-xl border p-3.5 shadow-sm ${getObligationCardToneClassName(player.currentObligationVnd)}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-base font-semibold text-slate-900">{player.playerName}</div>
                  <div className={`text-xl font-bold ${getObligationClassName(player.currentObligationVnd)}`}>{formatVnd(player.currentObligationVnd)}</div>
                </div>
                <div className="mt-1 text-xs text-slate-500">{`Contributed ${formatVnd(player.totalContributedVnd)}`}</div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="History"
        description="Match history, fund ledger movements, and manual transaction records."
        actions={
          <Tooltip title={historyViewMode === "minimal" ? "Switch to Detail View" : "Switch to Minimal View"}>
            <Button
              size="middle"
              icon={historyViewMode === "minimal" ? <UnorderedListOutlined /> : <AppstoreOutlined />}
              onClick={() => setHistoryViewMode((previous) => (previous === "minimal" ? "detail" : "minimal"))}
            />
          </Tooltip>
        }
      >
        {historyIsError ? (
          <ErrorState
            description={getErrorMessage(toAppError(historyError))}
            onRetry={() => {
              void matchesQuery.refetch();
              void ledgerQuery.refetch();
              void transactionsQuery.refetch();
            }}
          />
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-900">Match History</div>
                <Button size="small" type="link" disabled={!canWriteActions} onClick={() => canWriteActions && navigate("/group-fund/new")}>
                  Create match
                </Button>
              </div>

              {matchesQuery.isLoading ? (
                <Skeleton active paragraph={{ rows: 5 }} />
              ) : (matchesQuery.data?.data ?? []).length === 0 ? (
                <EmptyState title="No Group Fund matches yet" description="Create a match to start building Group Fund history." />
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:gap-2">
                    {(matchesQuery.data?.data ?? []).map((matchItem) => (
                      <button
                        key={matchItem.id}
                        className="focus-ring w-full rounded-lg border border-slate-200/90 bg-white p-2.5 text-left transition hover:border-brand-500 md:w-[calc(50%-0.25rem)] lg:w-[calc(33.333%-0.4rem)]"
                        onClick={() => setSelectedMatchId(matchItem.id)}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Tag className="!text-[11px]" color="blue">
                            {matchItem.ruleSetName}
                          </Tag>
                          <div className="text-xs font-medium text-slate-700">{formatDateTime(matchItem.playedAt)}</div>
                        </div>
                        <div className="mt-2 text-xs text-slate-500">{`Version v${matchItem.ruleSetVersionNo}`}</div>
                        <div className="mt-1 text-xs text-slate-500">{`Fund in ${formatVnd(matchItem.totalFundInVnd)} | Fund out ${formatVnd(matchItem.totalFundOutVnd)}`}</div>

                        {historyViewMode === "detail" ? (
                          <div className="mt-2 space-y-1">
                            {matchItem.participants.map((participant) => (
                              <div key={`${matchItem.id}-${participant.playerId}`} className="flex items-center justify-between gap-2 text-xs">
                                <span className="text-slate-600">{`${participant.playerName} (Top ${participant.tftPlacement})`}</span>
                                <span className={getObligationClassName(participant.settlementNetVnd)}>{formatVnd(participant.settlementNetVnd)}</span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </button>
                    ))}
                  </div>

                  <div className="flex justify-center pt-1">
                    <Pagination
                      current={matchesQuery.data?.meta?.page ?? matchPage}
                      pageSize={matchesQuery.data?.meta?.pageSize ?? DEFAULT_PAGE_SIZE}
                      total={matchesQuery.data?.meta?.total ?? 0}
                      showSizeChanger={false}
                      onChange={setMatchPage}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
              <div className="mb-2 text-sm font-semibold text-slate-900">Fund Ledger</div>

              {ledgerQuery.isLoading ? (
                <Skeleton active paragraph={{ rows: 5 }} />
              ) : (ledgerQuery.data?.data ?? []).length === 0 ? (
                <EmptyState title="No ledger entries" />
              ) : (
                <div className="space-y-2">
                  {(ledgerQuery.data?.data ?? []).map((entry) => (
                    <button
                      key={entry.entryId}
                      className="focus-ring w-full rounded-lg border border-slate-200 bg-white p-2.5 text-left transition hover:border-brand-500"
                      onClick={() => entry.matchId && setSelectedMatchId(entry.matchId)}
                      disabled={!entry.matchId}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-medium text-slate-700">{formatDateTime(entry.postedAt)}</div>
                        <Tag color={entry.movementType === "FUND_IN" ? "green" : "red"}>{entry.movementType}</Tag>
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">{entry.relatedPlayerName ?? "System"}</div>
                      <div className={`mt-1 text-sm font-semibold ${entry.movementType === "FUND_IN" ? "text-emerald-700" : "text-rose-700"}`}>
                        {formatVnd(entry.amountVnd)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{entry.entryReason}</div>

                      {historyViewMode === "detail" && entry.ruleCode ? (
                        <div className="mt-1 text-[11px] text-slate-500">{`Rule: ${entry.ruleCode} - ${entry.ruleName ?? "-"}`}</div>
                      ) : null}
                    </button>
                  ))}

                  <div className="flex justify-center pt-1">
                    <Pagination
                      current={ledgerQuery.data?.meta?.page ?? ledgerPage}
                      pageSize={ledgerQuery.data?.meta?.pageSize ?? DEFAULT_PAGE_SIZE}
                      total={ledgerQuery.data?.meta?.total ?? 0}
                      showSizeChanger={false}
                      onChange={setLedgerPage}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-900">Manual Transactions</div>
                <Button size="small" disabled={!canWriteActions} onClick={openTransactionModal}>
                  Create transaction
                </Button>
              </div>

              {transactionsQuery.isLoading ? (
                <Skeleton active paragraph={{ rows: 5 }} />
              ) : (transactionsQuery.data?.data ?? []).length === 0 ? (
                <EmptyState title="No manual transactions" />
              ) : (
                <div className="space-y-2">
                  {(transactionsQuery.data?.data ?? []).map((item) => (
                    <div key={item.entryId} className="rounded-lg border border-slate-200 bg-white p-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Tag color="blue">{groupFundTransactionLabels[item.transactionType]}</Tag>
                        <div className="text-xs font-medium text-slate-700">{formatDateTime(item.postedAt)}</div>
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">{item.playerName ?? "System"}</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">{formatVnd(item.amountVnd)}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.reason}</div>

                      {historyViewMode === "detail" ? (
                        <div className="mt-1 text-[11px] text-slate-500">{`Source: ${item.sourceType}`}</div>
                      ) : null}
                    </div>
                  ))}

                  <div className="flex justify-center pt-1">
                    <Pagination
                      current={transactionsQuery.data?.meta?.page ?? transactionPage}
                      pageSize={transactionsQuery.data?.meta?.pageSize ?? DEFAULT_PAGE_SIZE}
                      total={transactionsQuery.data?.meta?.total ?? 0}
                      showSizeChanger={false}
                      onChange={setTransactionPage}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </SectionCard>

      <MatchDetailOverlay open={Boolean(selectedMatchId)} matchId={selectedMatchId} onClose={() => setSelectedMatchId(undefined)} />

      <Modal title="Filter Group Fund" open={filterOpen} footer={null} onCancel={() => setFilterOpen(false)}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">From</label>
            <DatePicker className="w-full" value={draftFrom} onChange={(value) => setDraftFrom(value)} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">To</label>
            <DatePicker className="w-full" value={draftTo} onChange={(value) => setDraftTo(value)} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Player</label>
            <Select
              allowClear
              value={draftPlayerId}
              options={playerOptions}
              onChange={(value) => setDraftPlayerId(value)}
              placeholder="All players"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Transaction type</label>
            <Select
              allowClear
              value={draftTransactionType}
              options={transactionTypeOptions}
              onChange={(value) => setDraftTransactionType(value)}
              placeholder="All transaction types"
            />
          </div>

          <div className="flex justify-between gap-2 pt-1">
            <Button onClick={resetFilters} disabled={!hasNonDefaultFilters && !draftFrom && !draftTo && !draftPlayerId && !draftTransactionType}>
              Reset to default
            </Button>
            <Button type="primary" onClick={applyFilters}>
              Apply filters
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        title="Create Manual Group Fund Transaction"
        open={transactionOpen && canWriteActions}
        footer={null}
        onCancel={() => setTransactionOpen(false)}
      >
        <form
          className="space-y-4"
          onSubmit={handleSubmit(async (values) => {
            if (!guardWritePermission(canWriteActions)) {
              return;
            }
            setTransactionApiError(null);

            try {
              await createTransactionMutation.mutateAsync({
                transactionType: values.transactionType,
                playerId: values.playerId || null,
                amountVnd: Math.trunc(values.amountVnd),
                reason: values.reason,
                postedAt: values.postedAt
              });
              message.success("Transaction created.");
              setTransactionOpen(false);
            } catch (error) {
              setTransactionApiError(getErrorMessage(toAppError(error)));
            }
          })}
        >
          <FormApiError message={transactionApiError} />

          <div>
            <label className="mb-1 block text-sm font-medium">Type</label>
            <Controller
              control={control}
              name="transactionType"
              render={({ field }) => <Select value={field.value} onChange={field.onChange} options={transactionTypeOptions} size="large" />}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Player</label>
            <Controller
              control={control}
              name="playerId"
              render={({ field }) => (
                <Select
                  allowClear
                  value={field.value || undefined}
                  onChange={(value) => field.onChange(value || "")}
                  disabled={!(selectedTransactionType === "CONTRIBUTION" || selectedTransactionType === "WITHDRAWAL")}
                  options={playerOptions}
                  size="large"
                  status={errors.playerId ? "error" : ""}
                  placeholder="Select player"
                />
              )}
            />
            {errors.playerId ? <div className="mt-1 text-xs text-red-600">{errors.playerId.message}</div> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Amount (VND)</label>
            <Controller
              control={control}
              name="amountVnd"
              render={({ field }) => (
                <InputNumber
                  min={1}
                  precision={0}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? 0)}
                  className="w-full"
                  size="large"
                  status={errors.amountVnd ? "error" : ""}
                />
              )}
            />
            {errors.amountVnd ? <div className="mt-1 text-xs text-red-600">{errors.amountVnd.message}</div> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Posted at (optional)</label>
            <Controller
              control={control}
              name="postedAt"
              render={({ field }) => (
                <DatePicker
                  className="w-full"
                  showTime
                  value={field.value ? dayjs(field.value) : null}
                  onChange={(value) => field.onChange(value ? value.toISOString() : undefined)}
                />
              )}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Reason</label>
            <Controller
              control={control}
              name="reason"
              render={({ field }) => <Input.TextArea {...field} rows={3} status={errors.reason ? "error" : ""} />}
            />
            {errors.reason ? <div className="mt-1 text-xs text-red-600">{errors.reason.message}</div> : null}
          </div>

          {(selectedTransactionType === "ADJUSTMENT_IN" || selectedTransactionType === "ADJUSTMENT_OUT") ? (
            <Alert type="info" showIcon message="Player is optional for adjustment transaction types." />
          ) : null}

          <Button type="primary" htmlType="submit" loading={createTransactionMutation.isPending} disabled={!canWriteActions}>
            Create transaction
          </Button>
        </form>
      </Modal>
    </PageContainer>
  );
};
