import { useEffect, useMemo, useState } from "react";
import {
  AppstoreOutlined,
  DeleteOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FilterOutlined,
  PlusOutlined,
  UnorderedListOutlined
} from "@ant-design/icons";
import { Alert, Button, DatePicker, Input, InputNumber, Modal, Select, Skeleton, Tag, Tooltip, message } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useNavigate } from "react-router-dom";
import { toAppError } from "@/api/httpClient";
import { FormApiError } from "@/components/common/FormApiError";
import { AppBreadcrumb } from "@/components/layout/AppBreadcrumb";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/layout/SectionCard";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import {
  useAllDebtPeriods,
  useCloseDebtPeriod,
  useCreateDebtPeriod,
  useCreateDebtSettlement,
  useCurrentDebtPeriod,
  useDebtPeriodTimeline
} from "@/features/match-stakes/hooks";
import { MatchDetailOverlay } from "@/features/matches/MatchDetailOverlay";
import { getErrorMessage } from "@/lib/error-messages";
import { formatDateTime, formatVnd } from "@/lib/format";
import { debtPeriodStatusLabels, getEnumLabel } from "@/lib/labels";
import type { CreateDebtSettlementLineRequest, DebtPeriodPlayerSummaryDto, DebtPeriodTimelinePlayerRowDto } from "@/types/api";

type SettlementLineForm = {
  localId: number;
  payerPlayerId?: string;
  receiverPlayerId?: string;
  amountVnd?: number;
  note: string;
};

type HistoryViewMode = "minimal" | "detail";

const HISTORY_VIEW_MODE_STORAGE_KEY = "tft2.match-stakes.history.view-mode";

const createSettlementLine = (localId: number): SettlementLineForm => ({
  localId,
  note: ""
});

const getOutstandingClassName = (amount: number) => {
  if (amount > 0) {
    return "text-green-700";
  }

  if (amount < 0) {
    return "text-red-700";
  }

  return "text-slate-700";
};

const getDebtCardToneClassName = (amount: number) => {
  if (amount > 0) {
    return "border-emerald-300 bg-emerald-50/80";
  }

  if (amount < 0) {
    return "border-rose-300 bg-rose-50/80";
  }

  return "border-amber-300 bg-amber-50/80";
};

const sortOutstandingPlayers = (players: DebtPeriodPlayerSummaryDto[]) => {
  const next = [...players];

  next.sort((left, right) => {
    const leftBucket = left.outstandingNetVnd > 0 ? 0 : left.outstandingNetVnd < 0 ? 1 : 2;
    const rightBucket = right.outstandingNetVnd > 0 ? 0 : right.outstandingNetVnd < 0 ? 1 : 2;

    if (leftBucket !== rightBucket) {
      return leftBucket - rightBucket;
    }

    if (leftBucket === 0 && left.outstandingNetVnd !== right.outstandingNetVnd) {
      return right.outstandingNetVnd - left.outstandingNetVnd;
    }

    if (leftBucket === 1 && left.outstandingNetVnd !== right.outstandingNetVnd) {
      return left.outstandingNetVnd - right.outstandingNetVnd;
    }

    return left.playerName.localeCompare(right.playerName);
  });

  return next;
};

const sortTimelineRows = (rows: DebtPeriodTimelinePlayerRowDto[]) => {
  const next = [...rows];

  next.sort((left, right) => left.playerName.localeCompare(right.playerName));

  return next;
};

const isSettlementLineValid = (line: SettlementLineForm) => {
  if (!line.payerPlayerId || !line.receiverPlayerId) {
    return false;
  }

  if (line.payerPlayerId === line.receiverPlayerId) {
    return false;
  }

  if (!line.amountVnd || line.amountVnd <= 0) {
    return false;
  }

  return true;
};

const hasAnyOutstandingBalance = (totalOutstandingReceiveVnd: number, totalOutstandingPayVnd: number) =>
  totalOutstandingReceiveVnd !== 0 || totalOutstandingPayVnd !== 0;

const formatSignedVnd = (value: number) => (value > 0 ? `+${formatVnd(value)}` : formatVnd(value));

const getTimelinePlacementRank = (row: DebtPeriodTimelinePlayerRowDto) => {
  if (typeof row.tftPlacement === "number") {
    return row.tftPlacement;
  }

  if (typeof row.relativeRank === "number") {
    return row.relativeRank;
  }

  return null;
};

const getTimelinePlacementLabel = (row: DebtPeriodTimelinePlayerRowDto) => {
  if (row.placementLabel) {
    return row.placementLabel;
  }

  const rank = getTimelinePlacementRank(row);
  if (typeof rank === "number") {
    return `top${rank}`;
  }

  return null;
};

const getPlacementToneClassName = (row: DebtPeriodTimelinePlayerRowDto) => {
  const rank = getTimelinePlacementRank(row);
  if (rank === 1) {
    return "text-amber-600";
  }

  if (rank === 2) {
    return "text-sky-600";
  }

  if (rank === 3) {
    return "text-emerald-600";
  }

  return "text-slate-500";
};

export const MatchStakesPage = () => {
  const navigate = useNavigate();

  const [selectedMatchId, setSelectedMatchId] = useState<string>();
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>();
  const [showDebtPeriodDetail, setShowDebtPeriodDetail] = useState(false);
  const [periodFilterOpen, setPeriodFilterOpen] = useState(false);
  const [historyViewMode, setHistoryViewMode] = useState<HistoryViewMode>(() => {
    if (typeof window === "undefined") {
      return "minimal";
    }

    const saved = window.localStorage.getItem(HISTORY_VIEW_MODE_STORAGE_KEY);
    return saved === "detail" ? "detail" : "minimal";
  });

  const [settlementOpen, setSettlementOpen] = useState(false);
  const [settlementApiError, setSettlementApiError] = useState<string | null>(null);
  const [settlementPostedAt, setSettlementPostedAt] = useState<Dayjs | null>(dayjs());
  const [settlementNote, setSettlementNote] = useState("");
  const [settlementLines, setSettlementLines] = useState<SettlementLineForm[]>([createSettlementLine(1)]);
  const [settlementLineSeed, setSettlementLineSeed] = useState(2);

  const [createPeriodOpen, setCreatePeriodOpen] = useState(false);
  const [createPeriodApiError, setCreatePeriodApiError] = useState<string | null>(null);
  const [createPeriodTitle, setCreatePeriodTitle] = useState("");
  const [createPeriodNote, setCreatePeriodNote] = useState("");

  const [closePeriodOpen, setClosePeriodOpen] = useState(false);
  const [closePeriodApiError, setClosePeriodApiError] = useState<string | null>(null);
  const [closePeriodNote, setClosePeriodNote] = useState("");
  const [closePeriodConfirmText, setClosePeriodConfirmText] = useState("");

  const currentPeriodQuery = useCurrentDebtPeriod();
  const allPeriodsQuery = useAllDebtPeriods();
  const selectedPeriodTimelineQuery = useDebtPeriodTimeline(selectedPeriodId);

  const createSettlementMutation = useCreateDebtSettlement();
  const closePeriodMutation = useCloseDebtPeriod();
  const createPeriodMutation = useCreateDebtPeriod();

  const openPeriodId = currentPeriodQuery.data?.period?.id;
  const hasOpenPeriod = Boolean(openPeriodId);

  const allPeriods = allPeriodsQuery.data ?? [];

  useEffect(() => {
    if (allPeriods.length === 0) {
      setSelectedPeriodId(undefined);
      return;
    }

    setSelectedPeriodId((current) => {
      if (current && allPeriods.some((period) => period.id === current)) {
        return current;
      }

      if (openPeriodId && allPeriods.some((period) => period.id === openPeriodId)) {
        return openPeriodId;
      }

      return allPeriods[0].id;
    });
  }, [allPeriods, openPeriodId]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(HISTORY_VIEW_MODE_STORAGE_KEY, historyViewMode);
    }
  }, [historyViewMode]);

  const selectedTimeline = selectedPeriodTimelineQuery.data;
  const selectedPeriod = selectedTimeline?.period;
  const selectedSummary = selectedTimeline?.summary;
  const sortedPlayers = useMemo(() => sortOutstandingPlayers(selectedTimeline?.players ?? []), [selectedTimeline?.players]);
  const initialPlayers = useMemo(
    () => sortTimelineRows(selectedTimeline?.initialRows ?? []),
    [selectedTimeline?.initialRows]
  );

  const settlementPlayerOptions = sortedPlayers.map((player) => ({
    label: player.playerName,
    value: player.playerId
  }));

  const closePeriodTargetId = selectedPeriod?.status === "OPEN" ? selectedPeriod.id : undefined;
  const hasOutstanding = hasAnyOutstandingBalance(
    selectedSummary?.totalOutstandingReceiveVnd ?? 0,
    selectedSummary?.totalOutstandingPayVnd ?? 0
  );

  const settlementFormValid = settlementLines.length > 0 && settlementLines.every(isSettlementLineValid);
  const canSubmitSettlement = Boolean(closePeriodTargetId) && settlementFormValid && !createSettlementMutation.isPending;
  const expectedCloseConfirmText = selectedPeriod ? `Close Period ${selectedPeriod.periodNo}` : "";
  const canConfirmClosePeriod = Boolean(expectedCloseConfirmText) && closePeriodConfirmText.trim() === expectedCloseConfirmText;

  const openSettlementModal = () => {
    setSettlementApiError(null);
    setSettlementPostedAt(dayjs());
    setSettlementNote("");
    setSettlementLines([createSettlementLine(1)]);
    setSettlementLineSeed(2);
    setSettlementOpen(true);
  };

  const openCreatePeriodModal = () => {
    setCreatePeriodApiError(null);
    setCreatePeriodTitle("");
    setCreatePeriodNote("");
    setCreatePeriodOpen(true);
  };

  const openClosePeriodModal = () => {
    setClosePeriodApiError(null);
    setClosePeriodNote("");
    setClosePeriodConfirmText("");
    setClosePeriodOpen(true);
  };

  const periodSelectOptions = allPeriods.map((period) => ({
    value: period.id,
    label: `Period #${period.periodNo} - ${getEnumLabel(debtPeriodStatusLabels, period.status)}`
  }));

  return (
    <PageContainer>
      <AppBreadcrumb items={[{ label: "Match Stakes" }]} />

      <PageHeader
        title="Match Stakes"
        subtitle="Simple debt notebook by period: current totals first, then match-by-match accumulation."
        actions={
          <>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/match-stakes/new")}>
              Create match
            </Button>
            {selectedPeriod?.status === "OPEN" ? (
              <Tooltip title="Close this period (requires confirmation in modal).">
                <span>
                  <Button onClick={openClosePeriodModal}>
                    Close period
                  </Button>
                </span>
              </Tooltip>
            ) : null}
            {!hasOpenPeriod ? <Button onClick={openCreatePeriodModal}>New debt period</Button> : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Tooltip title={showDebtPeriodDetail ? "Hide Debt Period detail" : "Show Debt Period detail"}>
          <Button
            icon={showDebtPeriodDetail ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            onClick={() => setShowDebtPeriodDetail((previous) => !previous)}
          />
        </Tooltip>
        <Tooltip title="Filter Debt Period">
          <Button icon={<FilterOutlined />} onClick={() => setPeriodFilterOpen(true)} />
        </Tooltip>
      </div>

      {showDebtPeriodDetail ? (
        <SectionCard title="Debt Period" description="Selected debt period metadata.">
          {allPeriodsQuery.isLoading || currentPeriodQuery.isLoading ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : currentPeriodQuery.isError ? (
            <ErrorState description={getErrorMessage(toAppError(currentPeriodQuery.error))} onRetry={() => void currentPeriodQuery.refetch()} />
          ) : allPeriodsQuery.isError ? (
            <ErrorState description={getErrorMessage(toAppError(allPeriodsQuery.error))} onRetry={() => void allPeriodsQuery.refetch()} />
          ) : allPeriods.length === 0 ? (
            <EmptyState
              title="No debt periods yet"
              description="Create a debt period to start tracking debt accumulation by match."
              actionLabel="New debt period"
              onAction={openCreatePeriodModal}
            />
          ) : (
            <div className="space-y-3">
              {!hasOpenPeriod ? (
                <Alert
                  type="info"
                  showIcon
                  message="No open debt period right now. You can still review historical periods below."
                  action={
                    <Button size="small" onClick={openCreatePeriodModal}>
                      New debt period
                    </Button>
                  }
                />
              ) : null}

              {!selectedPeriodId ? (
                <EmptyState title="Select a debt period" description="Use filter button to choose one period." />
              ) : selectedPeriodTimelineQuery.isLoading ? (
                <Skeleton active paragraph={{ rows: 4 }} />
              ) : selectedPeriodTimelineQuery.isError ? (
                <ErrorState
                  description={getErrorMessage(toAppError(selectedPeriodTimelineQuery.error))}
                  onRetry={() => void selectedPeriodTimelineQuery.refetch()}
                />
              ) : selectedPeriod ? (
                <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Period</div>
                    <div className="mt-1 font-semibold text-slate-900">{`#${selectedPeriod.periodNo}`}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Opened</div>
                    <div className="mt-1 font-semibold text-slate-900">{formatDateTime(selectedPeriod.openedAt)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Total matches</div>
                    <div className="mt-1 font-semibold text-slate-900">{selectedSummary?.totalMatches ?? 0}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Status</div>
                    <div className="mt-1">
                      <Tag color={selectedPeriod.status === "OPEN" ? "green" : "default"}>
                        {getEnumLabel(debtPeriodStatusLabels, selectedPeriod.status)}
                      </Tag>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Closed</div>
                    <div className="mt-1 font-semibold text-slate-900">{formatDateTime(selectedPeriod.closedAt)}</div>
                  </div>
                </div>
              ) : (
                <EmptyState title="Selected period not found" />
              )}
            </div>
          )}
        </SectionCard>
      ) : null}

      <SectionCard
        title="Current Debt"
        description="Outstanding net debt per player for the selected period."
        className="border-amber-400 shadow-xl shadow-amber-200/80 overflow-hidden"
        bodyClassName="bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50"
      >
        {!selectedPeriodId ? (
          <EmptyState title="Select a debt period" />
        ) : selectedPeriodTimelineQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : selectedPeriodTimelineQuery.isError ? (
          <ErrorState
            description={getErrorMessage(toAppError(selectedPeriodTimelineQuery.error))}
            onRetry={() => void selectedPeriodTimelineQuery.refetch()}
          />
        ) : sortedPlayers.length === 0 ? (
          <EmptyState title="No players in this period yet" description="Create matches to start accumulating debt." />
        ) : (
          <div className="space-y-2.5">
            {sortedPlayers.map((player) => (
              <div key={player.playerId} className={`rounded-xl border p-3.5 shadow-sm ${getDebtCardToneClassName(player.outstandingNetVnd)}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-base font-semibold text-slate-900">{player.playerName}</div>
                  <div className={`text-xl font-bold ${getOutstandingClassName(player.outstandingNetVnd)}`}>{formatSignedVnd(player.outstandingNetVnd)}</div>
                </div>
                <div className="mt-1 text-xs text-slate-500">{`Accrued ${formatVnd(player.accruedNetVnd)} | Paid ${formatVnd(player.settledPaidVnd)} | Received ${formatVnd(player.settledReceivedVnd)}`}</div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="History"
        description="Debt accumulation by match."
        actions={
          <Tooltip title={historyViewMode === "minimal" ? "Switch to Detail View" : "Switch to Minimal View"}>
            <Button
              size="middle"
              shape="default"
              icon={historyViewMode === "minimal" ? <UnorderedListOutlined/> : <AppstoreOutlined />}
              onClick={() => setHistoryViewMode((prev) => (prev === "minimal" ? "detail" : "minimal"))}
            />
          </Tooltip>
        }
      >
        {!selectedPeriodId ? (
          <EmptyState title="Select a debt period" />
        ) : selectedPeriodTimelineQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : selectedPeriodTimelineQuery.isError ? (
          <ErrorState
            description={getErrorMessage(toAppError(selectedPeriodTimelineQuery.error))}
            onRetry={() => void selectedPeriodTimelineQuery.refetch()}
          />
        ) : (
          <div className="space-y-2.5">
            <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:gap-2">
              {(selectedTimeline?.history ?? []).map((historyItem) => (
                <button
                  key={historyItem.matchId}
                  className="focus-ring w-full rounded-lg border border-slate-200/90 bg-white p-2.5 text-left transition hover:border-brand-500 md:w-[calc(50%-0.25rem)] lg:w-[calc(33.333%-0.4rem)]"
                  onClick={() => setSelectedMatchId(historyItem.matchId)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Tag className="!text-[11px]" color="blue">
                      {historyItem.label ?? (historyItem.matchNo ? `Match ${historyItem.matchNo}` : "Match")}
                    </Tag>
                    <div className="text-xs font-medium text-slate-700">{formatDateTime(historyItem.playedAt)}</div>
                  </div>

                  <div className="mt-2 space-y-1.5">
                    {sortTimelineRows(historyItem.players).map((row) => (
                      <div key={`${historyItem.matchId}-${row.playerId}`} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 text-sm font-medium text-slate-900">{row.playerName}</div>
                          <div className={`text-sm font-semibold ${getOutstandingClassName(row.cumulativeNetVnd)}`}>{formatSignedVnd(row.cumulativeNetVnd)}</div>
                        </div>

                        {historyViewMode === "detail" ? (
                          <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                            <div className={`font-medium ${getPlacementToneClassName(row)}`}>
                              {getTimelinePlacementLabel(row) ? getTimelinePlacementLabel(row) : "-"}
                            </div>
                            <div className={getOutstandingClassName(row.matchNetVnd)}>{`Match ${formatSignedVnd(row.matchNetVnd)}`}</div>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </button>
              ))}
            </div>

            {(selectedTimeline?.history ?? []).length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm text-slate-600">No matches in this period yet.</div>
            ) : null}

            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-2.5">
              <div className="text-sm font-semibold text-slate-900">Initial debt</div>
              {(initialPlayers ?? []).length === 0 ? (
                <div className="mt-2 text-sm text-slate-500">No players yet.</div>
              ) : (
                <div className="mt-2 space-y-1">
                  {initialPlayers.map((player) => (
                    <div key={player.playerId} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-600">{player.playerName}</span>
                      <span className="font-medium text-slate-600">{formatSignedVnd(player.cumulativeNetVnd)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SectionCard>

      <MatchDetailOverlay open={Boolean(selectedMatchId)} matchId={selectedMatchId} onClose={() => setSelectedMatchId(undefined)} />

      <Modal title="Filter Debt Period" open={periodFilterOpen} footer={null} onCancel={() => setPeriodFilterOpen(false)}>
        <div className="space-y-3">
          {allPeriodsQuery.isLoading ? (
            <Skeleton active paragraph={{ rows: 3 }} />
          ) : allPeriods.length === 0 ? (
            <EmptyState title="No debt periods yet" description="Create a debt period first." />
          ) : (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Period</label>
                <Select
                  value={selectedPeriodId}
                  options={periodSelectOptions}
                  onChange={(value) => {
                    setSelectedPeriodId(value);
                    setPeriodFilterOpen(false);
                  }}
                  placeholder="Select debt period"
                  className="w-full"
                />
              </div>
              {selectedPeriod ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-600">
                  <div>{`Period #${selectedPeriod.periodNo}`}</div>
                  <div>{`Opened: ${formatDateTime(selectedPeriod.openedAt)}`}</div>
                  <div>{`Matches: ${selectedSummary?.totalMatches ?? 0}`}</div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </Modal>

      <Modal
        title={selectedPeriod ? `Record settlement - Period #${selectedPeriod.periodNo}` : "Record settlement"}
        open={settlementOpen}
        okText="Record settlement"
        okButtonProps={{ loading: createSettlementMutation.isPending, disabled: !canSubmitSettlement }}
        onOk={async () => {
          if (!closePeriodTargetId || !canSubmitSettlement) {
            return;
          }

          setSettlementApiError(null);

          const payloadLines: CreateDebtSettlementLineRequest[] = settlementLines.map((line) => ({
            payerPlayerId: line.payerPlayerId as string,
            receiverPlayerId: line.receiverPlayerId as string,
            amountVnd: Math.trunc(line.amountVnd as number),
            note: line.note.trim() || null
          }));

          try {
            await createSettlementMutation.mutateAsync({
              periodId: closePeriodTargetId,
              payload: {
                postedAt: settlementPostedAt ? settlementPostedAt.toISOString() : undefined,
                note: settlementNote.trim() || null,
                lines: payloadLines
              }
            });

            message.success("Settlement recorded.");
            setSettlementOpen(false);
          } catch (error) {
            setSettlementApiError(getErrorMessage(toAppError(error)));
          }
        }}
        onCancel={() => setSettlementOpen(false)}
      >
        <div className="space-y-3">
          <FormApiError message={settlementApiError} />

          <div>
            <label className="mb-1 block text-sm font-medium">Posted at (optional)</label>
            <DatePicker className="w-full" showTime value={settlementPostedAt} onChange={(value) => setSettlementPostedAt(value)} allowClear />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Note (optional)</label>
            <Input.TextArea value={settlementNote} rows={2} maxLength={400} onChange={(event) => setSettlementNote(event.target.value)} />
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-slate-900">Settlement lines</div>
            <Button
              size="small"
              onClick={() => {
                setSettlementLines((previous) => [...previous, createSettlementLine(settlementLineSeed)]);
                setSettlementLineSeed((previous) => previous + 1);
              }}
            >
              Add line
            </Button>
          </div>

          <div className="space-y-3">
            {settlementLines.map((line, index) => {
              const lineInvalid = !isSettlementLineValid(line);

              return (
                <div key={line.localId} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{`Line ${index + 1}`}</div>
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      disabled={settlementLines.length <= 1}
                      onClick={() => setSettlementLines((previous) => previous.filter((candidate) => candidate.localId !== line.localId))}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Payer</label>
                      <Select
                        value={line.payerPlayerId}
                        placeholder="Select payer"
                        options={settlementPlayerOptions}
                        onChange={(value) =>
                          setSettlementLines((previous) =>
                            previous.map((candidate) =>
                              candidate.localId === line.localId
                                ? {
                                    ...candidate,
                                    payerPlayerId: value
                                  }
                                : candidate
                            )
                          )
                        }
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Receiver</label>
                      <Select
                        value={line.receiverPlayerId}
                        placeholder="Select receiver"
                        options={settlementPlayerOptions}
                        onChange={(value) =>
                          setSettlementLines((previous) =>
                            previous.map((candidate) =>
                              candidate.localId === line.localId
                                ? {
                                    ...candidate,
                                    receiverPlayerId: value
                                  }
                                : candidate
                            )
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[220px_1fr] sm:items-end">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Amount (VND)</label>
                      <InputNumber
                        className="w-full"
                        min={1}
                        precision={0}
                        step={10000}
                        value={line.amountVnd}
                        onChange={(value) =>
                          setSettlementLines((previous) =>
                            previous.map((candidate) =>
                              candidate.localId === line.localId
                                ? {
                                    ...candidate,
                                    amountVnd: typeof value === "number" ? value : undefined
                                  }
                                : candidate
                            )
                          )
                        }
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Line note (optional)</label>
                      <Input
                        value={line.note}
                        maxLength={250}
                        onChange={(event) =>
                          setSettlementLines((previous) =>
                            previous.map((candidate) =>
                              candidate.localId === line.localId
                                ? {
                                    ...candidate,
                                    note: event.target.value
                                  }
                                : candidate
                            )
                          )
                        }
                      />
                    </div>
                  </div>

                  {lineInvalid ? (
                    <div className="mt-2 text-xs text-red-600">Payer and receiver must be different, and amount must be greater than 0.</div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {!settlementFormValid ? <Alert type="warning" showIcon message="Please complete all settlement lines before submitting." /> : null}
        </div>
      </Modal>

      <Modal
        title="Create new debt period"
        open={createPeriodOpen}
        okText="Create period"
        okButtonProps={{ loading: createPeriodMutation.isPending }}
        onOk={async () => {
          setCreatePeriodApiError(null);

          try {
            await createPeriodMutation.mutateAsync({
              title: createPeriodTitle.trim() || null,
              note: createPeriodNote.trim() || null
            });
            message.success("Debt period created.");
            setCreatePeriodOpen(false);
          } catch (error) {
            setCreatePeriodApiError(getErrorMessage(toAppError(error)));
          }
        }}
        onCancel={() => setCreatePeriodOpen(false)}
      >
        <div className="space-y-3">
          <FormApiError message={createPeriodApiError} />

          <div>
            <label className="mb-1 block text-sm font-medium">Title (optional)</label>
            <Input value={createPeriodTitle} maxLength={150} onChange={(event) => setCreatePeriodTitle(event.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Note (optional)</label>
            <Input.TextArea value={createPeriodNote} rows={3} maxLength={400} onChange={(event) => setCreatePeriodNote(event.target.value)} />
          </div>
        </div>
      </Modal>

      <Modal
        title={selectedPeriod ? `Close Period #${selectedPeriod.periodNo}` : "Close period"}
        open={closePeriodOpen}
        okText="Close period"
        okButtonProps={{
          loading: closePeriodMutation.isPending,
          disabled: !closePeriodTargetId || !canConfirmClosePeriod
        }}
        onOk={async () => {
          if (!closePeriodTargetId || !canConfirmClosePeriod) {
            return;
          }

          setClosePeriodApiError(null);

          try {
            await closePeriodMutation.mutateAsync({
              periodId: closePeriodTargetId,
              payload: {
                note: closePeriodNote.trim() || null
              }
            });
            message.success("Debt period closed.");
            setClosePeriodOpen(false);
          } catch (error) {
            const appError = toAppError(error);
            if (appError.code === "DEBT_PERIOD_OUTSTANDING_NOT_ZERO") {
              setClosePeriodApiError("Cannot close this period because outstanding balances are not zero.");
              return;
            }

            setClosePeriodApiError(getErrorMessage(appError));
          }
        }}
        onCancel={() => setClosePeriodOpen(false)}
      >
        <div className="space-y-3">
          <FormApiError message={closePeriodApiError} />

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <div>{`Outstanding to receive: ${formatVnd(selectedSummary?.totalOutstandingReceiveVnd ?? 0)}`}</div>
            <div>{`Outstanding to pay: ${formatVnd(selectedSummary?.totalOutstandingPayVnd ?? 0)}`}</div>
          </div>

          {hasOutstanding ? <Alert type="warning" showIcon message="Outstanding may still be non-zero. Backend can reject close request." /> : null}
          {!hasOutstanding ? <Alert type="success" showIcon message="All balances are settled. This period can be closed." /> : null}

          <div>
            <label className="mb-1 block text-sm font-medium">Confirmation</label>
            <div className="mb-1 text-xs text-slate-500">{`Type exactly: ${expectedCloseConfirmText}`}</div>
            <Input value={closePeriodConfirmText} onChange={(event) => setClosePeriodConfirmText(event.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Close note (optional)</label>
            <Input.TextArea value={closePeriodNote} rows={3} maxLength={400} onChange={(event) => setClosePeriodNote(event.target.value)} />
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
};
