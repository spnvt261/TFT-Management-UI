import { useEffect, useMemo, useState } from "react";
import {
  AppstoreOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FilterOutlined,
  PlusOutlined,
  UnorderedListOutlined,
  WalletOutlined
} from "@ant-design/icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, DatePicker, Input, Modal, Pagination, Select, Skeleton, Tag, Tooltip, message } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { toAppError } from "@/api/httpClient";
import { FormApiError } from "@/components/common/FormApiError";
import { AppBreadcrumb } from "@/components/layout/AppBreadcrumb";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/layout/SectionCard";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { useAuth } from "@/features/auth/AuthContext";
import { guardWritePermission } from "@/features/auth/permissions";
import {
  useCreateGroupFundContribution,
  useCreateGroupFundAdvance,
  useCreateGroupFundTransaction,
  useCreateGroupFundWithdrawal,
  useGroupFundHistory,
  useGroupFundLedger,
  useGroupFundMatches,
  useGroupFundSummary,
  useGroupFundTransactions,
  useGroupFundWithdrawals
} from "@/features/group-fund/hooks";
import {
  contributionSchema,
  manualTransactionSchema,
  withdrawalSchema,
  type ContributionValues,
  type ManualTransactionValues,
  type WithdrawalValues
} from "@/features/group-fund/schemas";
import { GroupFundHistoryFeed, type GroupFundHistoryFeedItem } from "@/features/group-fund/components/GroupFundHistoryFeed";
import { GroupFundAdvanceModal } from "@/features/group-fund/components/GroupFundAdvanceModal";
import { MatchDetailOverlay } from "@/features/matches/MatchDetailOverlay";
import { useActivePlayers } from "@/features/players/hooks";
import { CurrencyAmountInput } from "@/features/rules/create-flow/components/CurrencyAmountInput";
import { getErrorMessage } from "@/lib/error-messages";
import { formatDateTime, formatVnd, nowIso } from "@/lib/format";
import { groupFundTransactionLabels } from "@/lib/labels";
import type { GroupFundSummaryDto, GroupFundTransactionType } from "@/types/api";

type HistoryViewMode = "minimal" | "detail";
type FundHistoryMode = "unified" | "both" | "detailed";
type GroupFundPlayerSummary = GroupFundSummaryDto["players"][number];

const DEFAULT_PAGE_SIZE = 12;
const HISTORY_VIEW_MODE_STORAGE_KEY = "tft2.group-fund.history.view-mode";
const OBLIGATIONS_VISIBLE_STORAGE_KEY = "tft2.group-fund.obligations.visible";
const DEFAULT_HISTORY_VIEW_MODE: HistoryViewMode = "minimal";
const DEFAULT_FUND_HISTORY_MODE: FundHistoryMode = "unified";

const toMillis = (iso: string) => Date.parse(iso);

const toIsoValue = (value: Dayjs | null) => (value ? value.toISOString() : undefined);

const resolvePrepaidVnd = (player: GroupFundPlayerSummary) => Math.max(player.prepaidVnd, 0);

const getObligationAmountClassName = (value: number) => {
  if (value > 0) {
    return "text-rose-700";
  }

  if (value < 0) {
    return "text-emerald-700";
  }

  return "text-slate-700";
};

const getObligationToneClassName = (player: GroupFundPlayerSummary) => {
  const prepaidVnd = resolvePrepaidVnd(player);

  if (player.currentObligationVnd > 0) {
    return "border-rose-300 bg-rose-50/80";
  }

  if (prepaidVnd > 0 || player.currentObligationVnd < 0) {
    return "border-emerald-300 bg-emerald-50/80";
  }

  return "border-slate-300 bg-slate-50/80";
};

const getObligationStatusTag = (player: GroupFundPlayerSummary) => {
  const prepaidVnd = resolvePrepaidVnd(player);

  if (player.currentObligationVnd > 0) {
    return <Tag color="volcano">Owes fund</Tag>;
  }

  if (prepaidVnd > 0 || player.currentObligationVnd < 0) {
    return <Tag color="green">Prepaid credit</Tag>;
  }

  return <Tag>Settled</Tag>;
};

const formatMovementAmount = (amountVnd: number, movementType: "FUND_IN" | "FUND_OUT") =>
  `${movementType === "FUND_IN" ? "+" : "-"}${formatVnd(amountVnd)}`;

export const GroupFundPage = () => {
  const navigate = useNavigate();
  const { canWrite } = useAuth();
  const canWriteActions = canWrite();

  const [selectedMatchId, setSelectedMatchId] = useState<string>();
  const [historyViewMode, setHistoryViewMode] = useState<HistoryViewMode>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_HISTORY_VIEW_MODE;
    }

    const saved = window.localStorage.getItem(HISTORY_VIEW_MODE_STORAGE_KEY);
    return saved === "detail" ? "detail" : DEFAULT_HISTORY_VIEW_MODE;
  });
  const [showCurrentObligations, setShowCurrentObligations] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return window.localStorage.getItem(OBLIGATIONS_VISIBLE_STORAGE_KEY) !== "false";
  });
  const [fundHistoryMode, setFundHistoryMode] = useState<FundHistoryMode>(DEFAULT_FUND_HISTORY_MODE);

  const [filterOpen, setFilterOpen] = useState(false);
  const [from, setFrom] = useState<string>();
  const [to, setTo] = useState<string>();
  const [playerId, setPlayerId] = useState<string>();
  const [transactionType, setTransactionType] = useState<GroupFundTransactionType>();
  const [draftFrom, setDraftFrom] = useState<Dayjs | null>(null);
  const [draftTo, setDraftTo] = useState<Dayjs | null>(null);
  const [draftPlayerId, setDraftPlayerId] = useState<string>();
  const [draftTransactionType, setDraftTransactionType] = useState<GroupFundTransactionType>();

  const [withdrawalPage, setWithdrawalPage] = useState(1);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [matchPage, setMatchPage] = useState(1);
  const [transactionPage, setTransactionPage] = useState(1);

  const [contributionOpen, setContributionOpen] = useState(false);
  const [contributionApiError, setContributionApiError] = useState<string | null>(null);
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);
  const [withdrawalApiError, setWithdrawalApiError] = useState<string | null>(null);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [transactionApiError, setTransactionApiError] = useState<string | null>(null);
  const [fundAdvanceOpen, setFundAdvanceOpen] = useState(false);
  const [fundAdvanceApiError, setFundAdvanceApiError] = useState<string | null>(null);

  const summaryQuery = useGroupFundSummary({ from, to });
  const withdrawalsQuery = useGroupFundWithdrawals({ from, to, playerId, page: withdrawalPage, pageSize: DEFAULT_PAGE_SIZE });
  const ledgerQuery = useGroupFundLedger({ from, to, playerId, page: ledgerPage, pageSize: DEFAULT_PAGE_SIZE });
  const matchesQuery = useGroupFundMatches({ from, to, playerId, page: matchPage, pageSize: DEFAULT_PAGE_SIZE });
  const transactionsQuery = useGroupFundTransactions({
    from,
    to,
    playerId,
    transactionType,
    page: transactionPage,
    pageSize: DEFAULT_PAGE_SIZE
  });
  const unifiedHistoryQuery = useGroupFundHistory({
    from,
    to,
    playerId,
    page: 1,
    pageSize: 100
  });
  const playersQuery = useActivePlayers();

  const createContributionMutation = useCreateGroupFundContribution();
  const createWithdrawalMutation = useCreateGroupFundWithdrawal();
  const createTransactionMutation = useCreateGroupFundTransaction();
  const createFundAdvanceMutation = useCreateGroupFundAdvance();

  const {
    control: contributionControl,
    reset: resetContributionForm,
    handleSubmit: handleContributionSubmit,
    formState: { errors: contributionErrors }
  } = useForm<ContributionValues>({
    resolver: zodResolver(contributionSchema),
    defaultValues: {
      playerId: "",
      amountVnd: 0,
      note: "",
      postedAt: nowIso()
    }
  });

  const {
    control: withdrawalControl,
    reset: resetWithdrawalForm,
    handleSubmit: handleWithdrawalSubmit,
    formState: { errors: withdrawalErrors }
  } = useForm<WithdrawalValues>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: {
      playerId: "",
      amountVnd: 0,
      reason: "",
      postedAt: nowIso()
    }
  });

  const {
    control: transactionControl,
    watch: watchTransactionField,
    reset: resetTransactionForm,
    handleSubmit: handleTransactionSubmit,
    formState: { errors: transactionErrors }
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

  const selectedTransactionType = watchTransactionField("transactionType");
  const hasNonDefaultFilters = Boolean(from || to || playerId || transactionType);

  const transactionTypeOptions = useMemo(
    () => Object.entries(groupFundTransactionLabels).map(([value, label]) => ({ value, label })),
    []
  );
  const playerOptions = useMemo(
    () => (playersQuery.data ?? []).map((player) => ({ value: player.id, label: player.displayName })),
    [playersQuery.data]
  );
  const playerNameById = useMemo(
    () => new Map((playersQuery.data ?? []).map((player) => [player.id, player.displayName])),
    [playersQuery.data]
  );

  const sortedObligations = useMemo(() => {
    const next = [...(summaryQuery.data?.players ?? [])];
    next.sort((left, right) => {
      const leftPrepaid = resolvePrepaidVnd(left);
      const rightPrepaid = resolvePrepaidVnd(right);
      const leftBucket = left.currentObligationVnd > 0 ? 0 : leftPrepaid > 0 || left.currentObligationVnd < 0 ? 1 : 2;
      const rightBucket = right.currentObligationVnd > 0 ? 0 : rightPrepaid > 0 || right.currentObligationVnd < 0 ? 1 : 2;

      if (leftBucket !== rightBucket) {
        return leftBucket - rightBucket;
      }

      if (left.currentObligationVnd !== right.currentObligationVnd) {
        return right.currentObligationVnd - left.currentObligationVnd;
      }

      return left.playerName.localeCompare(right.playerName);
    });

    return next;
  }, [summaryQuery.data?.players]);

  const totalOutstandingObligationVnd = sortedObligations.reduce(
    (sum, player) => sum + Math.max(player.currentObligationVnd, 0),
    0
  );
  const totalContributedVnd = sortedObligations.reduce((sum, player) => sum + player.totalContributedVnd, 0);
  const totalPrepaidVnd = sortedObligations.reduce((sum, player) => sum + resolvePrepaidVnd(player), 0);

  const fundAdvanceRows = useMemo(() => {
    const summaryAdvanceRows = summaryQuery.data?.fundAdvances ?? [];
    if (summaryAdvanceRows.length > 0) {
      return summaryAdvanceRows
        .map((row) => ({
          playerId: row.playerId,
          playerName: row.playerName,
          advancedVnd: row.advancedVnd,
          outstandingVnd: row.outstandingVnd ?? Math.max(row.advancedVnd - (row.reimbursedVnd ?? 0), 0)
        }))
        .filter((row) => row.advancedVnd > 0 || row.outstandingVnd > 0);
    }

    return (summaryQuery.data?.players ?? [])
      .filter((player) => (player.totalFundAdvanceVnd ?? 0) > 0 || (player.outstandingFundAdvanceVnd ?? 0) > 0)
      .map((player) => ({
        playerId: player.playerId,
        playerName: player.playerName,
        advancedVnd: player.totalFundAdvanceVnd ?? 0,
        outstandingVnd: player.outstandingFundAdvanceVnd ?? 0
      }));
  }, [summaryQuery.data?.fundAdvances, summaryQuery.data?.players]);

  const totalFundAdvanceVnd =
    summaryQuery.data?.totalFundAdvanceVnd ??
    fundAdvanceRows.reduce((sum, row) => sum + Math.max(row.advancedVnd, 0), 0);
  const outstandingFundAdvanceVnd =
    summaryQuery.data?.outstandingFundAdvanceVnd ??
    fundAdvanceRows.reduce((sum, row) => sum + Math.max(row.outstandingVnd, 0), 0);

  const fallbackHistoryItems = useMemo<GroupFundHistoryFeedItem[]>(() => {
    const matchItems: GroupFundHistoryFeedItem[] = (matchesQuery.data?.data ?? []).map((matchItem) => ({
      id: `match:${matchItem.id}`,
      itemType: "MATCH",
      postedAt: matchItem.playedAt,
      matchId: matchItem.id,
      amountVnd: matchItem.totalFundInVnd - matchItem.totalFundOutVnd,
      note: matchItem.notePreview ?? null,
      fundInVnd: matchItem.totalFundInVnd,
      fundOutVnd: matchItem.totalFundOutVnd,
      matchTitle: `${matchItem.ruleSetName} (v${matchItem.ruleSetVersionNo})`
    }));

    const transactionItems: GroupFundHistoryFeedItem[] = (transactionsQuery.data?.data ?? []).map((item) => ({
      id: `transaction:${item.entryId}`,
      itemType: item.transactionType,
      postedAt: item.postedAt,
      playerId: item.playerId,
      playerName: item.playerName,
      actorName: item.playerName,
      amountVnd: item.transactionType === "WITHDRAWAL" || item.transactionType === "ADJUSTMENT_OUT" ? -item.amountVnd : item.amountVnd,
      note: item.reason,
      reason: item.reason,
      transactionType: item.transactionType
    }));

    return [...matchItems, ...transactionItems].sort((left, right) => {
      const diff = toMillis(right.postedAt) - toMillis(left.postedAt);
      if (diff !== 0) {
        return diff;
      }

      return right.id.localeCompare(left.id);
    });
  }, [matchesQuery.data?.data, transactionsQuery.data?.data]);

  const unifiedHistoryItems = useMemo<GroupFundHistoryFeedItem[]>(() => {
    const backendData = unifiedHistoryQuery.data?.data;
    if (Array.isArray(backendData)) {
      return [...backendData]
        .map((item) => ({
          ...item,
          matchTitle: item.itemType === "MATCH" ? item.note ?? "Match" : undefined
        }))
        .sort((left, right) => {
          const diff = toMillis(right.postedAt) - toMillis(left.postedAt);
          if (diff !== 0) {
            return diff;
          }

          const rightCreated = right.createdAt ? toMillis(right.createdAt) : 0;
          const leftCreated = left.createdAt ? toMillis(left.createdAt) : 0;
          if (rightCreated !== leftCreated) {
            return rightCreated - leftCreated;
          }

          return right.id.localeCompare(left.id);
        });
    }

    return fallbackHistoryItems;
  }, [fallbackHistoryItems, unifiedHistoryQuery.data]);

  const showUnifiedHistory = fundHistoryMode !== "detailed";
  const showDetailedHistorySections = fundHistoryMode !== "unified";

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(HISTORY_VIEW_MODE_STORAGE_KEY, historyViewMode);
    }
  }, [historyViewMode]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(OBLIGATIONS_VISIBLE_STORAGE_KEY, String(showCurrentObligations));
    }
  }, [showCurrentObligations]);

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
    setWithdrawalPage(1);
    setLedgerPage(1);
    setMatchPage(1);
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
    setWithdrawalPage(1);
    setLedgerPage(1);
    setMatchPage(1);
    setTransactionPage(1);
    setFilterOpen(false);
  };

  const openContributionModal = (targetPlayerId?: string) => {
    if (!guardWritePermission(canWriteActions)) {
      return;
    }

    const targetPlayer = sortedObligations.find((player) => player.playerId === targetPlayerId);
    const defaultAmountVnd = targetPlayer && targetPlayer.currentObligationVnd > 0 ? targetPlayer.currentObligationVnd : 0;

    setContributionApiError(null);
    resetContributionForm({
      playerId: targetPlayerId ?? "",
      amountVnd: defaultAmountVnd,
      note: "",
      postedAt: nowIso()
    });
    setContributionOpen(true);
  };

  const openWithdrawalModal = () => {
    if (!guardWritePermission(canWriteActions)) {
      return;
    }

    setWithdrawalApiError(null);
    resetWithdrawalForm({
      playerId: "",
      amountVnd: 0,
      reason: "",
      postedAt: nowIso()
    });
    setWithdrawalOpen(true);
  };

  const openTransactionModal = () => {
    if (!guardWritePermission(canWriteActions)) {
      return;
    }

    setTransactionApiError(null);
    resetTransactionForm({
      transactionType: "CONTRIBUTION",
      playerId: "",
      amountVnd: 0,
      reason: "",
      postedAt: nowIso()
    });
    setTransactionOpen(true);
  };

  const openFundAdvanceModal = () => {
    if (!guardWritePermission(canWriteActions)) {
      return;
    }

    setFundAdvanceApiError(null);
    setFundAdvanceOpen(true);
  };

  const activeFilterSummary = [
    from ? `From: ${formatDateTime(from)}` : "From: All time",
    to ? `To: ${formatDateTime(to)}` : "To: Now",
    playerId ? `Player: ${playerNameById.get(playerId) ?? "Unknown player"}` : "Player: All",
    transactionType ? `Manual type: ${groupFundTransactionLabels[transactionType]}` : "Manual type: All"
  ];

  return (
    <PageContainer>
      <AppBreadcrumb items={[{ label: "Group Fund", to: "/group-fund/fund" }, { label: "Fund" }]} />

      <PageHeader
        title="Group Fund / Fund"
        subtitle="Fund management first: see balance, update payments, process withdrawals, then review history."
        actions={
          canWriteActions ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/group-fund/new")}>
              Create match
            </Button>
          ) : null
        }
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Fund Balance</div>
            <div className="mt-2 flex items-center gap-2">
              <WalletOutlined className="text-brand-700" />
              <div className="text-3xl font-bold tracking-tight text-slate-900">
                {summaryQuery.isLoading && !summaryQuery.data ? "Loading..." : formatVnd(summaryQuery.data?.fundBalanceVnd ?? 0)}
              </div>
            </div>
          </div>

          {canWriteActions ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => openContributionModal()}>Mark paid</Button>
              <Button onClick={openFundAdvanceModal}>Record fund advance</Button>
              <Button onClick={openWithdrawalModal}>Withdraw from fund</Button>
              <Button onClick={openTransactionModal}>Manual transaction</Button>
            </div>
          ) : null}
        </div>

        {summaryQuery.isError ? (
          <div className="mt-4">
            <Alert
              type="error"
              showIcon
              message={getErrorMessage(toAppError(summaryQuery.error))}
              action={
                <Button size="small" onClick={() => void summaryQuery.refetch()}>
                  Retry
                </Button>
              }
            />
          </div>
        ) : summaryQuery.isLoading && !summaryQuery.data ? (
          <div className="mt-4">
            <Skeleton active paragraph={{ rows: 2 }} />
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Total matches</div>
              <div className="mt-1 text-base font-semibold text-slate-900">{summaryQuery.data?.totalMatches ?? 0}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Players tracked</div>
              <div className="mt-1 text-base font-semibold text-slate-900">{sortedObligations.length}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Outstanding obligation</div>
              <div className="mt-1 text-base font-semibold text-rose-700">{formatVnd(totalOutstandingObligationVnd)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Total contributed</div>
              <div className="mt-1 text-base font-semibold text-slate-900">{formatVnd(totalContributedVnd)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Total prepaid credit</div>
              <div className="mt-1 text-base font-semibold text-emerald-700">{formatVnd(totalPrepaidVnd)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Fund advances</div>
              <div className="mt-1 text-base font-semibold text-slate-900">{formatVnd(totalFundAdvanceVnd)}</div>
            </div>
          </div>
        )}

        <div className="mt-3 space-y-2">
          <Alert
            type={(summaryQuery.data?.fundBalanceVnd ?? 0) < 0 ? "warning" : "info"}
            showIcon
            message={`Balance can be negative. Current ${formatVnd(summaryQuery.data?.fundBalanceVnd ?? 0)} | Outstanding fund advances ${formatVnd(outstandingFundAdvanceVnd)}`}
          />

          {fundAdvanceRows.length > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Players who advanced fund money</div>
              <div className="mt-2 space-y-1.5">
                {fundAdvanceRows.map((row) => (
                  <div key={row.playerId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="font-medium text-slate-800">{row.playerName}</div>
                    <div className="text-xs text-slate-600">{`Advanced ${formatVnd(row.advancedVnd)} | Outstanding ${formatVnd(row.outstandingVnd)}`}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <SectionCard
        title="Current Obligations"
        description="Track who still owes, who is settled, and who has prepaid credit."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Tooltip title={showCurrentObligations ? "Hide obligations" : "Show obligations"}>
              <Button
                icon={showCurrentObligations ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                onClick={() => setShowCurrentObligations((previous) => !previous)}
              />
            </Tooltip>
            {canWriteActions ? <Button onClick={() => openContributionModal()}>Mark paid</Button> : null}
          </div>
        }
        className="overflow-hidden border-amber-400 shadow-xl shadow-amber-200/70"
        bodyClassName="bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50"
      >
        {!showCurrentObligations ? (
          <div className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-600">
            Current obligations are hidden. Fund balance above remains visible at all times.
          </div>
        ) : summaryQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : summaryQuery.isError ? (
          <ErrorState description={getErrorMessage(toAppError(summaryQuery.error))} onRetry={() => void summaryQuery.refetch()} />
        ) : sortedObligations.length === 0 ? (
          <EmptyState title="No player obligation data yet" description="Create Group Fund matches or contributions to populate this section." />
        ) : (
          <div className="space-y-2.5">
            {sortedObligations.map((player) => {
              const prepaidVnd = resolvePrepaidVnd(player);

              return (
                <div key={player.playerId} className={`rounded-xl border p-3.5 shadow-sm ${getObligationToneClassName(player)}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-base font-semibold text-slate-900">{player.playerName}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {getObligationStatusTag(player)}
                        {prepaidVnd > 0 ? <Tag color="green">{`Prepaid ${formatVnd(prepaidVnd)}`}</Tag> : null}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-slate-500">Current obligation</div>
                      <div className={`mt-1 text-xl font-bold ${getObligationAmountClassName(player.currentObligationVnd)}`}>
                        {formatVnd(player.currentObligationVnd)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-3">
                    <div className="rounded-lg border border-slate-200/80 bg-white/75 px-2.5 py-1.5">
                      {`Total contributed: ${formatVnd(player.totalContributedVnd)}`}
                    </div>
                    <div className="rounded-lg border border-slate-200/80 bg-white/75 px-2.5 py-1.5">
                      {`Net obligation: ${formatVnd(player.netObligationVnd)}`}
                    </div>
                    <div className="rounded-lg border border-slate-200/80 bg-white/75 px-2.5 py-1.5">
                      {`Prepaid: ${formatVnd(prepaidVnd)}`}
                    </div>
                  </div>

                  {canWriteActions ? (
                    <div className="mt-3 flex justify-end">
                      <Button size="small" onClick={() => openContributionModal(player.playerId)}>
                        Mark paid
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="History Controls"
        description="Apply filters once and review all history sections below."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-slate-200">
              <Button
                size="small"
                type={fundHistoryMode === "unified" ? "primary" : "text"}
                onClick={() => setFundHistoryMode("unified")}
              >
                Unified
              </Button>
              <Button
                size="small"
                type={fundHistoryMode === "both" ? "primary" : "text"}
                onClick={() => setFundHistoryMode("both")}
              >
                Both
              </Button>
              <Button
                size="small"
                type={fundHistoryMode === "detailed" ? "primary" : "text"}
                onClick={() => setFundHistoryMode("detailed")}
              >
                Detailed
              </Button>
            </div>
            <Tooltip title="Filter fund history">
              <Button icon={<FilterOutlined />} onClick={openFilterModal} />
            </Tooltip>
            <Button onClick={resetFilters} disabled={!hasNonDefaultFilters}>
              Reset filters
            </Button>
            <Tooltip title={historyViewMode === "minimal" ? "Switch to detail view" : "Switch to minimal view"}>
              <Button
                icon={historyViewMode === "minimal" ? <UnorderedListOutlined /> : <AppstoreOutlined />}
                onClick={() => setHistoryViewMode((previous) => (previous === "minimal" ? "detail" : "minimal"))}
              />
            </Tooltip>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-2 text-xs text-slate-600 md:grid-cols-2 xl:grid-cols-4">
          {activeFilterSummary.map((item) => (
            <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
              {item}
            </div>
          ))}
        </div>
      </SectionCard>

      {showUnifiedHistory ? (
        <SectionCard
          title="Fund History"
          description="Unified chronological feed across match-generated movements, manual transactions, and fund advances."
          actions={canWriteActions ? <Button onClick={openFundAdvanceModal}>Record fund advance</Button> : null}
        >
          {unifiedHistoryQuery.isError ? (
            <ErrorState description={getErrorMessage(toAppError(unifiedHistoryQuery.error))} onRetry={() => void unifiedHistoryQuery.refetch()} />
          ) : unifiedHistoryQuery.data === null && (matchesQuery.isLoading || transactionsQuery.isLoading) ? (
            <Skeleton active paragraph={{ rows: 7 }} />
          ) : (
            <div className="space-y-3">
              {unifiedHistoryQuery.data === null ? (
                <Alert
                  type="info"
                  showIcon
                  message="Using merged history from existing matches + transactions because unified backend feed endpoint is unavailable."
                />
              ) : null}
              <GroupFundHistoryFeed items={unifiedHistoryItems} viewMode={historyViewMode} onOpenMatch={(matchId) => setSelectedMatchId(matchId)} />
            </div>
          )}
        </SectionCard>
      ) : null}

      {showDetailedHistorySections ? <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard
          title="Withdrawal History"
          description="Fund outflow history, separated from match and manual-adjustment activity."
        >
          {withdrawalsQuery.isLoading ? (
            <Skeleton active paragraph={{ rows: 5 }} />
          ) : withdrawalsQuery.isError ? (
            <ErrorState description={getErrorMessage(toAppError(withdrawalsQuery.error))} onRetry={() => void withdrawalsQuery.refetch()} />
          ) : (withdrawalsQuery.data?.data ?? []).length === 0 ? (
            <EmptyState title="No withdrawals yet" description="Use 'Withdraw from fund' to record outgoing transactions." />
          ) : (
            <div className="space-y-2">
              {(withdrawalsQuery.data?.data ?? []).map((item) => (
                <div key={item.entryId} className="rounded-lg border border-rose-200 bg-rose-50/50 p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Tag color="red">Withdrawal</Tag>
                    <div className="text-xs font-medium text-slate-700">{formatDateTime(item.postedAt)}</div>
                  </div>
                  <div className="mt-1 flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{item.playerName ?? "System"}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{item.reason || "-"}</div>
                    </div>
                    <div className="text-right text-sm font-semibold text-rose-700">{formatVnd(item.amountVnd)}</div>
                  </div>
                </div>
              ))}

              <div className="flex justify-center pt-1">
                <Pagination
                  current={withdrawalsQuery.data?.meta?.page ?? withdrawalPage}
                  pageSize={withdrawalsQuery.data?.meta?.pageSize ?? DEFAULT_PAGE_SIZE}
                  total={withdrawalsQuery.data?.meta?.total ?? 0}
                  showSizeChanger={false}
                  onChange={setWithdrawalPage}
                />
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Fund Ledger" description="Every movement in/out of the fund with clear direction and reason.">
          {ledgerQuery.isLoading ? (
            <Skeleton active paragraph={{ rows: 5 }} />
          ) : ledgerQuery.isError ? (
            <ErrorState description={getErrorMessage(toAppError(ledgerQuery.error))} onRetry={() => void ledgerQuery.refetch()} />
          ) : (ledgerQuery.data?.data ?? []).length === 0 ? (
            <EmptyState title="No ledger entries" />
          ) : (
            <div className="space-y-2">
              {(ledgerQuery.data?.data ?? []).map((entry) => {
                const isFundIn = entry.movementType === "FUND_IN";

                return (
                  <button
                    key={entry.entryId}
                    className={`focus-ring w-full rounded-lg border p-2.5 text-left transition ${
                      isFundIn
                        ? "border-emerald-200 bg-emerald-50/50 hover:border-emerald-400"
                        : "border-rose-200 bg-rose-50/50 hover:border-rose-400"
                    }`}
                    onClick={() => entry.matchId && setSelectedMatchId(entry.matchId)}
                    disabled={!entry.matchId}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-medium text-slate-700">{formatDateTime(entry.postedAt)}</div>
                      <Tag color={isFundIn ? "green" : "red"}>{entry.movementType}</Tag>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-900">{entry.relatedPlayerName ?? "System"}</div>
                      <div className={`text-sm font-semibold ${isFundIn ? "text-emerald-700" : "text-rose-700"}`}>
                        {formatMovementAmount(entry.amountVnd, entry.movementType)}
                      </div>
                    </div>

                    <div className="mt-1 text-xs text-slate-500">{entry.entryReason}</div>
                    {historyViewMode === "detail" && entry.ruleCode ? (
                      <div className="mt-1 text-[11px] text-slate-500">{`Rule: ${entry.ruleCode} - ${entry.ruleName ?? "-"}`}</div>
                    ) : null}
                  </button>
                );
              })}

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
        </SectionCard>
      </div> : null}

      {showDetailedHistorySections ? <SectionCard
        title="Match History"
        description="Group Fund match timeline remains available, but now sits below fund-management controls."
        actions={
          canWriteActions ? (
            <Button size="small" type="link" onClick={() => navigate("/group-fund/new")}>
              Create match
            </Button>
          ) : null
        }
      >
        {matchesQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : matchesQuery.isError ? (
          <ErrorState description={getErrorMessage(toAppError(matchesQuery.error))} onRetry={() => void matchesQuery.refetch()} />
        ) : (matchesQuery.data?.data ?? []).length === 0 ? (
          <EmptyState title="No Group Fund matches yet" description="Create a match to build module history." />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
              {(matchesQuery.data?.data ?? []).map((matchItem) => (
                <button
                  key={matchItem.id}
                  className="focus-ring rounded-lg border border-slate-200 bg-white p-2.5 text-left transition hover:border-brand-500"
                  onClick={() => setSelectedMatchId(matchItem.id)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Tag className="!text-[11px]" color="blue">
                      {matchItem.ruleSetName}
                    </Tag>
                    <div className="text-xs font-medium text-slate-700">{formatDateTime(matchItem.playedAt)}</div>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{`Version v${matchItem.ruleSetVersionNo}`}</div>
                  <div className="mt-1 text-xs text-slate-500">{`Fund in ${formatVnd(matchItem.totalFundInVnd)} | Fund out ${formatVnd(matchItem.totalFundOutVnd)}`}</div>
                  {matchItem.notePreview ? <div className="mt-1 text-xs text-slate-500">{matchItem.notePreview}</div> : null}

                  {historyViewMode === "detail" ? (
                    <div className="mt-2 space-y-1">
                      {matchItem.participants.map((participant) => (
                        <div key={`${matchItem.id}-${participant.playerId}`} className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-slate-600">{`${participant.playerName} (Top ${participant.tftPlacement})`}</span>
                          <span className={getObligationAmountClassName(participant.settlementNetVnd)}>{formatVnd(participant.settlementNetVnd)}</span>
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
      </SectionCard> : null}

      {showDetailedHistorySections ? <SectionCard
        title="Manual Transactions"
        description="Adjustments and manual entries are kept here, separate from dedicated withdrawal history."
        actions={canWriteActions ? <Button onClick={openTransactionModal}>Create transaction</Button> : null}
      >
        {transactionsQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : transactionsQuery.isError ? (
          <ErrorState description={getErrorMessage(toAppError(transactionsQuery.error))} onRetry={() => void transactionsQuery.refetch()} />
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
                <div className="mt-1 text-xs text-slate-500">{item.reason || "-"}</div>

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
      </SectionCard> : null}

      <MatchDetailOverlay open={Boolean(selectedMatchId)} matchId={selectedMatchId} onClose={() => setSelectedMatchId(undefined)} />

      <Modal title="Filter Fund History" open={filterOpen} footer={null} onCancel={() => setFilterOpen(false)}>
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
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Manual transaction type</label>
            <Select
              allowClear
              value={draftTransactionType}
              options={transactionTypeOptions}
              onChange={(value) => setDraftTransactionType(value)}
              placeholder="All transaction types"
            />
          </div>

          <div className="flex justify-between gap-2 pt-1">
            <Button
              onClick={resetFilters}
              disabled={!hasNonDefaultFilters && !draftFrom && !draftTo && !draftPlayerId && !draftTransactionType}
            >
              Reset to default
            </Button>
            <Button type="primary" onClick={applyFilters}>
              Apply filters
            </Button>
          </div>
        </div>
      </Modal>

      <GroupFundAdvanceModal
        open={fundAdvanceOpen}
        canWrite={canWriteActions}
        loading={createFundAdvanceMutation.isPending}
        apiError={fundAdvanceApiError}
        playerOptions={playerOptions}
        onCancel={() => setFundAdvanceOpen(false)}
        onSubmit={async (payload) => {
          if (!guardWritePermission(canWriteActions)) {
            return;
          }

          setFundAdvanceApiError(null);

          try {
            await createFundAdvanceMutation.mutateAsync(payload);
            message.success("Fund advance recorded.");
            setFundAdvanceOpen(false);
          } catch (error) {
            setFundAdvanceApiError(getErrorMessage(toAppError(error)));
          }
        }}
      />

      <Modal title="Mark Player Paid Into Fund" open={contributionOpen && canWriteActions} footer={null} onCancel={() => setContributionOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={handleContributionSubmit(async (values) => {
            if (!guardWritePermission(canWriteActions)) {
              return;
            }

            setContributionApiError(null);

            try {
              await createContributionMutation.mutateAsync({
                playerId: values.playerId,
                amountVnd: Math.trunc(values.amountVnd),
                note: values.note?.trim() || null,
                postedAt: values.postedAt
              });
              message.success("Contribution recorded.");
              setContributionOpen(false);
            } catch (error) {
              setContributionApiError(getErrorMessage(toAppError(error)));
            }
          })}
        >
          <FormApiError message={contributionApiError} />

          <div>
            <label className="mb-1 block text-sm font-medium">Player</label>
            <Controller
              control={contributionControl}
              name="playerId"
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onChange={(value) => field.onChange(value ?? "")}
                  options={playerOptions}
                  size="large"
                  status={contributionErrors.playerId ? "error" : ""}
                  placeholder="Select player"
                />
              )}
            />
            {contributionErrors.playerId ? <div className="mt-1 text-xs text-red-600">{contributionErrors.playerId.message}</div> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Amount (VND)</label>
            <Controller
              control={contributionControl}
              name="amountVnd"
              render={({ field }) => (
                <CurrencyAmountInput
                  min={1}
                  value={field.value}
                  step={10000}
                  onChange={field.onChange}
                  className="w-full"
                  size="large"
                  status={contributionErrors.amountVnd ? "error" : ""}
                />
              )}
            />
            {contributionErrors.amountVnd ? <div className="mt-1 text-xs text-red-600">{contributionErrors.amountVnd.message}</div> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Posted at (optional)</label>
            <Controller
              control={contributionControl}
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
            <label className="mb-1 block text-sm font-medium">Note (optional)</label>
            <Controller
              control={contributionControl}
              name="note"
              render={({ field }) => <Input.TextArea {...field} rows={3} status={contributionErrors.note ? "error" : ""} />}
            />
            {contributionErrors.note ? <div className="mt-1 text-xs text-red-600">{contributionErrors.note.message}</div> : null}
          </div>

          <Button type="primary" htmlType="submit" loading={createContributionMutation.isPending}>
            Save contribution
          </Button>
        </form>
      </Modal>

      <Modal title="Withdraw From Fund" open={withdrawalOpen && canWriteActions} footer={null} onCancel={() => setWithdrawalOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={handleWithdrawalSubmit(async (values) => {
            if (!guardWritePermission(canWriteActions)) {
              return;
            }

            setWithdrawalApiError(null);

            try {
              await createWithdrawalMutation.mutateAsync({
                transactionType: "WITHDRAWAL",
                playerId: values.playerId,
                amountVnd: Math.trunc(values.amountVnd),
                reason: values.reason.trim(),
                postedAt: values.postedAt
              });
              message.success("Withdrawal recorded.");
              setWithdrawalOpen(false);
            } catch (error) {
              setWithdrawalApiError(getErrorMessage(toAppError(error)));
            }
          })}
        >
          <FormApiError message={withdrawalApiError} />

          <div>
            <label className="mb-1 block text-sm font-medium">Recipient player</label>
            <Controller
              control={withdrawalControl}
              name="playerId"
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onChange={(value) => field.onChange(value ?? "")}
                  options={playerOptions}
                  size="large"
                  status={withdrawalErrors.playerId ? "error" : ""}
                  placeholder="Select player"
                />
              )}
            />
            {withdrawalErrors.playerId ? <div className="mt-1 text-xs text-red-600">{withdrawalErrors.playerId.message}</div> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Amount (VND)</label>
            <Controller
              control={withdrawalControl}
              name="amountVnd"
              render={({ field }) => (
                <CurrencyAmountInput
                  min={1}
                  value={field.value}
                  step={10000}
                  onChange={field.onChange}
                  className="w-full"
                  size="large"
                  status={withdrawalErrors.amountVnd ? "error" : ""}
                />
              )}
            />
            {withdrawalErrors.amountVnd ? <div className="mt-1 text-xs text-red-600">{withdrawalErrors.amountVnd.message}</div> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Posted at (optional)</label>
            <Controller
              control={withdrawalControl}
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
              control={withdrawalControl}
              name="reason"
              render={({ field }) => <Input.TextArea {...field} rows={3} status={withdrawalErrors.reason ? "error" : ""} />}
            />
            {withdrawalErrors.reason ? <div className="mt-1 text-xs text-red-600">{withdrawalErrors.reason.message}</div> : null}
          </div>

          <Button type="primary" htmlType="submit" loading={createWithdrawalMutation.isPending}>
            Save withdrawal
          </Button>
        </form>
      </Modal>

      <Modal title="Create Manual Group Fund Transaction" open={transactionOpen && canWriteActions} footer={null} onCancel={() => setTransactionOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={handleTransactionSubmit(async (values) => {
            if (!guardWritePermission(canWriteActions)) {
              return;
            }

            setTransactionApiError(null);

            try {
              await createTransactionMutation.mutateAsync({
                transactionType: values.transactionType,
                playerId: values.playerId || null,
                amountVnd: Math.trunc(values.amountVnd),
                reason: values.reason.trim(),
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
              control={transactionControl}
              name="transactionType"
              render={({ field }) => <Select value={field.value} onChange={field.onChange} options={transactionTypeOptions} size="large" />}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Player</label>
            <Controller
              control={transactionControl}
              name="playerId"
              render={({ field }) => (
                <Select
                  allowClear
                  value={field.value || undefined}
                  onChange={(value) => field.onChange(value || "")}
                  disabled={
                    !(
                      selectedTransactionType === "CONTRIBUTION" ||
                      selectedTransactionType === "WITHDRAWAL" ||
                      selectedTransactionType === "FUND_ADVANCE"
                    )
                  }
                  options={playerOptions}
                  size="large"
                  status={transactionErrors.playerId ? "error" : ""}
                  placeholder="Select player"
                />
              )}
            />
            {transactionErrors.playerId ? <div className="mt-1 text-xs text-red-600">{transactionErrors.playerId.message}</div> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Amount (VND)</label>
            <Controller
              control={transactionControl}
              name="amountVnd"
              render={({ field }) => (
                <CurrencyAmountInput
                  min={1}
                  value={field.value}
                  step={10000}
                  onChange={field.onChange}
                  className="w-full"
                  size="large"
                  status={transactionErrors.amountVnd ? "error" : ""}
                />
              )}
            />
            {transactionErrors.amountVnd ? <div className="mt-1 text-xs text-red-600">{transactionErrors.amountVnd.message}</div> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Posted at (optional)</label>
            <Controller
              control={transactionControl}
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
              control={transactionControl}
              name="reason"
              render={({ field }) => <Input.TextArea {...field} rows={3} status={transactionErrors.reason ? "error" : ""} />}
            />
            {transactionErrors.reason ? <div className="mt-1 text-xs text-red-600">{transactionErrors.reason.message}</div> : null}
          </div>

          {selectedTransactionType === "ADJUSTMENT_IN" || selectedTransactionType === "ADJUSTMENT_OUT" ? (
            <Alert type="info" showIcon message="Player is optional for adjustment transaction types." />
          ) : null}

          <Button type="primary" htmlType="submit" loading={createTransactionMutation.isPending}>
            Create transaction
          </Button>
        </form>
      </Modal>
    </PageContainer>
  );
};
