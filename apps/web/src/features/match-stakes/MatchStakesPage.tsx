import { useEffect, useMemo, useState } from "react";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  DatePicker,
  Drawer,
  Input,
  InputNumber,
  List,
  Modal,
  Pagination,
  Select,
  Skeleton,
  Table,
  Tabs,
  Tag,
  Tooltip,
  message
} from "antd";
import type { TableColumnsType } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useNavigate } from "react-router-dom";
import { toAppError } from "@/api/httpClient";
import { FormApiError } from "@/components/common/FormApiError";
import { AppBreadcrumb } from "@/components/layout/AppBreadcrumb";
import { MetricCard } from "@/components/layout/MetricCard";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/layout/SectionCard";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import {
  useCloseDebtPeriod,
  useCreateDebtPeriod,
  useCreateDebtSettlement,
  useCurrentDebtPeriod,
  useDebtPeriodDetail,
  useDebtPeriods,
  useMatchStakesMatches
} from "@/features/match-stakes/hooks";
import { MatchDetailOverlay } from "@/features/matches/MatchDetailOverlay";
import { useIsMobile } from "@/hooks/useIsMobile";
import { getErrorMessage } from "@/lib/error-messages";
import { formatDateTime, formatVnd } from "@/lib/format";
import { debtPeriodStatusLabels, getEnumLabel, matchStatusLabels } from "@/lib/labels";
import type { CreateDebtSettlementLineRequest, DebtPeriodPlayerSummaryDto, MatchListItemDto } from "@/types/api";

type SettlementLineForm = {
  localId: number;
  payerPlayerId?: string;
  receiverPlayerId?: string;
  amountVnd?: number;
  note: string;
};

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

const renderMatchCard = (item: MatchListItemDto, onOpen: (matchId: string) => void) => (
  <button
    key={item.id}
    className="focus-ring w-full rounded-xl border border-slate-200/90 bg-white p-3 text-left transition hover:border-brand-500"
    onClick={() => onOpen(item.id)}
  >
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="text-sm font-semibold">{formatDateTime(item.playedAt)}</div>
      <div className="flex items-center gap-2">
        <Tag>{`v${item.ruleSetVersionNo}`}</Tag>
        <Tag>{getEnumLabel(matchStatusLabels, item.status)}</Tag>
        {item.confirmationMode === "MANUAL_ADJUSTED" ? <Tag color="orange">Manual</Tag> : <Tag color="blue">Engine</Tag>}
      </div>
    </div>

    <div className="mt-1 text-xs text-slate-500">{item.ruleSetName}</div>
    <div className="mt-2 text-xs text-slate-600">
      {item.participants.map((participant) => `${participant.playerName} #${participant.tftPlacement}`).join(" | ")}
    </div>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
      <span>{`Participants: ${item.participantCount}`}</span>
      <span>{`Transfer: ${formatVnd(item.totalTransferVnd)}`}</span>
    </div>
    {item.notePreview ? <div className="mt-1 text-xs text-slate-500">{item.notePreview}</div> : null}
  </button>
);

export const MatchStakesPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [selectedMatchId, setSelectedMatchId] = useState<string>();
  const [matchesPage, setMatchesPage] = useState(1);
  const [periodsPage, setPeriodsPage] = useState(1);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>();
  const [periodDrawerOpen, setPeriodDrawerOpen] = useState(false);

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

  const currentPeriodQuery = useCurrentDebtPeriod();
  const periodsQuery = useDebtPeriods({ page: periodsPage, pageSize: 12 });

  const currentPeriod = currentPeriodQuery.data;
  const openPeriod = currentPeriod?.period;
  const openPeriodId = openPeriod?.id;

  const currentPeriodDetailQuery = useDebtPeriodDetail(openPeriodId);
  const matchesQuery = useMatchStakesMatches({ periodId: openPeriodId, page: matchesPage, pageSize: 12 }, Boolean(openPeriodId));
  const selectedPeriodDetailQuery = useDebtPeriodDetail(selectedPeriodId);

  const createSettlementMutation = useCreateDebtSettlement();
  const closePeriodMutation = useCloseDebtPeriod();
  const createPeriodMutation = useCreateDebtPeriod();

  useEffect(() => {
    setMatchesPage(1);
  }, [openPeriodId]);

  const sortedPlayers = useMemo(() => sortOutstandingPlayers(currentPeriod?.players ?? []), [currentPeriod?.players]);
  const currentSummary = currentPeriod?.summary;
  const hasOutstanding = hasAnyOutstandingBalance(
    currentSummary?.totalOutstandingReceiveVnd ?? 0,
    currentSummary?.totalOutstandingPayVnd ?? 0
  );

  const settlementPlayerOptions = sortedPlayers.map((player) => ({
    label: player.playerName,
    value: player.playerId
  }));

  const settlementFormValid = settlementLines.length > 0 && settlementLines.every(isSettlementLineValid);
  const canSubmitSettlement = Boolean(openPeriodId) && settlementFormValid && !createSettlementMutation.isPending;

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
    setClosePeriodOpen(true);
  };

  const outstandingColumns: TableColumnsType<DebtPeriodPlayerSummaryDto> = [
    { title: "Player", dataIndex: "playerName", key: "playerName", render: (value: string) => <span className="font-semibold text-slate-900">{value}</span> },
    { title: "Matches", dataIndex: "totalMatches", key: "totalMatches", width: 120 },
    { title: "Accrued", dataIndex: "accruedNetVnd", key: "accruedNetVnd", render: (value: number) => <span className={getOutstandingClassName(value)}>{formatVnd(value)}</span> },
    { title: "Settled Paid", dataIndex: "settledPaidVnd", key: "settledPaidVnd", render: (value: number) => formatVnd(value) },
    { title: "Settled Received", dataIndex: "settledReceivedVnd", key: "settledReceivedVnd", render: (value: number) => formatVnd(value) },
    { title: "Outstanding", dataIndex: "outstandingNetVnd", key: "outstandingNetVnd", render: (value: number) => <span className={`text-base font-semibold ${getOutstandingClassName(value)}`}>{formatVnd(value)}</span> }
  ];

  if (currentPeriodQuery.isError) {
    return (
      <PageContainer>
        <AppBreadcrumb items={[{ label: "Match Stakes" }]} />
        <PageHeader
          title="Match Stakes"
          subtitle="Track debt periods, cumulative balances, settlements, and match history."
          actions={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/match-stakes/new")}>Create match</Button>}
        />
        <ErrorState description={getErrorMessage(toAppError(currentPeriodQuery.error))} onRetry={() => void currentPeriodQuery.refetch()} />
      </PageContainer>
    );
  }

  const matchesMeta = matchesQuery.data?.meta;
  const periodsMeta = periodsQuery.data?.meta;

  return (
    <PageContainer>
      <AppBreadcrumb items={[{ label: "Match Stakes" }]} />

      <PageHeader
        title="Match Stakes"
        subtitle="Debt-period tracking with cumulative outstanding balances and real settlement history."
        actions={
          <>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/match-stakes/new")}>
              Create match
            </Button>
            {openPeriod ? <Button onClick={openSettlementModal}>Record settlement</Button> : null}
            {openPeriod?.status === "OPEN" ? (
              <Tooltip
                title={
                  hasOutstanding
                    ? "Outstanding balances are not zero. Record settlements until fully settled before closing."
                    : "Close this debt period"
                }
              >
                <span>
                  <Button onClick={openClosePeriodModal} disabled={hasOutstanding}>
                    Close period
                  </Button>
                </span>
              </Tooltip>
            ) : null}
            {!openPeriod ? <Button onClick={openCreatePeriodModal}>New debt period</Button> : null}
          </>
        }
      />

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <SectionCard title="Current debt period" description="The currently active debt period for Match Stakes">
          {currentPeriodQuery.isLoading ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : !openPeriod ? (
            <EmptyState
              title="No open debt period"
              description="Create a new debt period to start tracking cumulative balances and settlements."
              actionLabel="New debt period"
              onAction={openCreatePeriodModal}
            />
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Tag color={openPeriod.status === "OPEN" ? "green" : "default"}>{getEnumLabel(debtPeriodStatusLabels, openPeriod.status)}</Tag>
                <span className="text-sm font-semibold text-slate-900">{`Period #${openPeriod.periodNo}`}</span>
              </div>

              <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">Opened at</div>
                  <div className="font-medium text-slate-900">{formatDateTime(openPeriod.openedAt)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">Closed at</div>
                  <div className="font-medium text-slate-900">{formatDateTime(openPeriod.closedAt)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">Title</div>
                  <div className="font-medium text-slate-900">{openPeriod.title || "-"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">Note</div>
                  <div className="font-medium text-slate-900">{openPeriod.note || "-"}</div>
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetricCard label="Total Matches" value={currentSummary?.totalMatches ?? 0} />
          <MetricCard label="Total Players" value={currentSummary?.totalPlayers ?? 0} />
          <MetricCard
            label="Outstanding To Receive"
            value={formatVnd(currentSummary?.totalOutstandingReceiveVnd ?? 0)}
            valueClassName="text-green-700"
          />
          <MetricCard
            label="Outstanding To Pay"
            value={formatVnd(currentSummary?.totalOutstandingPayVnd ?? 0)}
            valueClassName="text-red-700"
          />
        </div>
      </section>

      <SectionCard title="Outstanding balances" description="Cumulative balance for the current debt period">
        {currentPeriodQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : !openPeriod ? (
          <EmptyState
            title="No open period summary"
            description="Open a new debt period to start tracking player outstanding balances."
            actionLabel="New debt period"
            onAction={openCreatePeriodModal}
          />
        ) : sortedPlayers.length === 0 ? (
          <EmptyState title="No players in this period yet" description="Create matches in this period to build outstanding balances." />
        ) : isMobile ? (
          <div className="space-y-3">
            {sortedPlayers.map((player) => (
              <div key={player.playerId} className="rounded-xl border border-slate-200 bg-slate-50/90 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-900">{player.playerName}</div>
                  <div className={`text-base font-semibold ${getOutstandingClassName(player.outstandingNetVnd)}`}>
                    {formatVnd(player.outstandingNetVnd)}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>
                    <div className="text-slate-500">Matches</div>
                    <div className="font-medium text-slate-900">{player.totalMatches}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Accrued</div>
                    <div className={getOutstandingClassName(player.accruedNetVnd)}>{formatVnd(player.accruedNetVnd)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Settled Paid</div>
                    <div>{formatVnd(player.settledPaidVnd)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Settled Received</div>
                    <div>{formatVnd(player.settledReceivedVnd)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Table rowKey="playerId" columns={outstandingColumns} dataSource={sortedPlayers} pagination={false} size="small" scroll={{ x: 900 }} />
        )}
      </SectionCard>

      <SectionCard title="History" description="Matches, settlements, and debt period history">
        <Tabs
          items={[
            {
              key: "matches",
              label: "Matches",
              children: !openPeriod ? (
                <EmptyState
                  title="No open debt period"
                  description="Create or open a debt period to view match history scoped to that period."
                  actionLabel="New debt period"
                  onAction={openCreatePeriodModal}
                />
              ) : matchesQuery.isLoading ? (
                <Skeleton active paragraph={{ rows: 4 }} />
              ) : matchesQuery.isError ? (
                <ErrorState description={getErrorMessage(toAppError(matchesQuery.error))} onRetry={() => void matchesQuery.refetch()} />
              ) : (matchesQuery.data?.data ?? []).length === 0 ? (
                <EmptyState title="No matches in this period yet" description="Create a match to begin period history." />
              ) : (
                <div className="space-y-3">
                  {(matchesQuery.data?.data ?? []).map((item) => renderMatchCard(item, setSelectedMatchId))}
                  <div className="flex justify-center pt-1">
                    <Pagination
                      current={matchesMeta?.page ?? matchesPage}
                      pageSize={matchesMeta?.pageSize ?? 12}
                      total={matchesMeta?.total ?? 0}
                      showSizeChanger={false}
                      onChange={setMatchesPage}
                    />
                  </div>
                </div>
              )
            },
            {
              key: "settlements",
              label: "Settlements",
              children: !openPeriod ? (
                <EmptyState
                  title="No open debt period"
                  description="Create a debt period before recording settlement payments."
                  actionLabel="New debt period"
                  onAction={openCreatePeriodModal}
                />
              ) : currentPeriodDetailQuery.isLoading ? (
                <Skeleton active paragraph={{ rows: 4 }} />
              ) : currentPeriodDetailQuery.isError ? (
                <ErrorState
                  description={getErrorMessage(toAppError(currentPeriodDetailQuery.error))}
                  onRetry={() => void currentPeriodDetailQuery.refetch()}
                />
              ) : (currentPeriodDetailQuery.data?.settlements ?? []).length === 0 ? (
                <EmptyState
                  title="No settlements recorded"
                  description="Use Record settlement to log real-world payments in this debt period."
                  actionLabel="Record settlement"
                  onAction={openSettlementModal}
                />
              ) : (
                <div className="space-y-3">
                  {(currentPeriodDetailQuery.data?.settlements ?? []).map((settlement) => (
                    <div key={settlement.id} className="rounded-xl border border-slate-200/90 bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-900">{formatDateTime(settlement.postedAt)}</div>
                        <Tag>{`${settlement.lines.length} lines`}</Tag>
                      </div>
                      {settlement.note ? <div className="mt-1 text-xs text-slate-500">{settlement.note}</div> : null}
                      <div className="mt-3 space-y-2">
                        {settlement.lines.map((line) => (
                          <div key={line.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                              <span className="font-medium text-slate-900">{`${line.payerPlayerName} -> ${line.receiverPlayerName}`}</span>
                              <span className="font-semibold text-slate-900">{formatVnd(line.amountVnd)}</span>
                            </div>
                            {line.note ? <div className="mt-1 text-xs text-slate-500">{line.note}</div> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            },
            {
              key: "periods",
              label: "Period History",
              children: periodsQuery.isLoading ? (
                <Skeleton active paragraph={{ rows: 5 }} />
              ) : periodsQuery.isError ? (
                <ErrorState description={getErrorMessage(toAppError(periodsQuery.error))} onRetry={() => void periodsQuery.refetch()} />
              ) : (periodsQuery.data?.data ?? []).length === 0 ? (
                <EmptyState
                  title="No debt periods yet"
                  description="Create the first debt period to start tracking outstanding balances."
                  actionLabel="New debt period"
                  onAction={openCreatePeriodModal}
                />
              ) : (
                <div className="space-y-3">
                  <List
                    dataSource={periodsQuery.data?.data ?? []}
                    renderItem={(period) => (
                      <List.Item className="!px-0">
                        <button
                          className="focus-ring w-full rounded-xl border border-slate-200/90 bg-white p-3 text-left transition hover:border-brand-500"
                          onClick={() => {
                            setSelectedPeriodId(period.id);
                            setPeriodDrawerOpen(true);
                          }}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-slate-900">{`Period #${period.periodNo}`}</div>
                            <div className="flex items-center gap-2">
                              <Tag color={period.status === "OPEN" ? "green" : "default"}>{getEnumLabel(debtPeriodStatusLabels, period.status)}</Tag>
                              {openPeriodId === period.id ? <Tag color="blue">Current</Tag> : null}
                            </div>
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {`Opened: ${formatDateTime(period.openedAt)} | Closed: ${formatDateTime(period.closedAt)}`}
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4">
                            <div>{`Matches: ${period.totalMatches}`}</div>
                            <div>{`Players: ${period.totalPlayers}`}</div>
                            <div className="text-green-700">{`Receive: ${formatVnd(period.totalOutstandingReceiveVnd)}`}</div>
                            <div className="text-red-700">{`Pay: ${formatVnd(period.totalOutstandingPayVnd)}`}</div>
                          </div>
                        </button>
                      </List.Item>
                    )}
                  />
                  <div className="flex justify-center pt-1">
                    <Pagination
                      current={periodsMeta?.page ?? periodsPage}
                      pageSize={periodsMeta?.pageSize ?? 12}
                      total={periodsMeta?.total ?? 0}
                      showSizeChanger={false}
                      onChange={setPeriodsPage}
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

      <Modal
        title={openPeriod ? `Record settlement - Period #${openPeriod.periodNo}` : "Record settlement"}
        open={settlementOpen}
        okText="Record settlement"
        okButtonProps={{ loading: createSettlementMutation.isPending, disabled: !canSubmitSettlement }}
        onOk={async () => {
          if (!openPeriodId || !canSubmitSettlement) {
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
              periodId: openPeriodId,
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
        title={openPeriod ? `Close Period #${openPeriod.periodNo}` : "Close period"}
        open={closePeriodOpen}
        okText="Close period"
        okButtonProps={{
          loading: closePeriodMutation.isPending,
          disabled: !openPeriodId || hasOutstanding
        }}
        onOk={async () => {
          if (!openPeriodId || hasOutstanding) {
            return;
          }

          setClosePeriodApiError(null);

          try {
            await closePeriodMutation.mutateAsync({
              periodId: openPeriodId,
              payload: {
                note: closePeriodNote.trim() || null
              }
            });
            message.success("Debt period closed.");
            setClosePeriodOpen(false);
          } catch (error) {
            setClosePeriodApiError(getErrorMessage(toAppError(error)));
          }
        }}
        onCancel={() => setClosePeriodOpen(false)}
      >
        <div className="space-y-3">
          <FormApiError message={closePeriodApiError} />

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <div>{`Outstanding to receive: ${formatVnd(currentSummary?.totalOutstandingReceiveVnd ?? 0)}`}</div>
            <div>{`Outstanding to pay: ${formatVnd(currentSummary?.totalOutstandingPayVnd ?? 0)}`}</div>
          </div>

          {hasOutstanding ? (
            <Alert type="warning" showIcon message="Outstanding balances are not zero. Record settlements before closing this period." />
          ) : (
            <Alert type="success" showIcon message="All balances are settled. This period can be closed." />
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">Close note (optional)</label>
            <Input.TextArea value={closePeriodNote} rows={3} maxLength={400} onChange={(event) => setClosePeriodNote(event.target.value)} />
          </div>
        </div>
      </Modal>

      <Drawer
        title={selectedPeriodId ? "Debt period detail" : "Period detail"}
        open={periodDrawerOpen}
        onClose={() => setPeriodDrawerOpen(false)}
        width={isMobile ? "100%" : 640}
      >
        {selectedPeriodDetailQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : selectedPeriodDetailQuery.isError ? (
          <ErrorState
            description={getErrorMessage(toAppError(selectedPeriodDetailQuery.error))}
            onRetry={() => void selectedPeriodDetailQuery.refetch()}
          />
        ) : selectedPeriodDetailQuery.data ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-900">{`Period #${selectedPeriodDetailQuery.data.period.periodNo}`}</div>
                <Tag color={selectedPeriodDetailQuery.data.period.status === "OPEN" ? "green" : "default"}>
                  {getEnumLabel(debtPeriodStatusLabels, selectedPeriodDetailQuery.data.period.status)}
                </Tag>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {`Opened: ${formatDateTime(selectedPeriodDetailQuery.data.period.openedAt)} | Closed: ${formatDateTime(
                  selectedPeriodDetailQuery.data.period.closedAt
                )}`}
              </div>
              <div className="mt-2 text-xs text-slate-500">{selectedPeriodDetailQuery.data.period.title || "No title"}</div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-slate-200 p-2">{`Matches: ${selectedPeriodDetailQuery.data.summary.totalMatches}`}</div>
              <div className="rounded-lg border border-slate-200 p-2">{`Players: ${selectedPeriodDetailQuery.data.summary.totalPlayers}`}</div>
              <div className="rounded-lg border border-slate-200 p-2 text-green-700">
                {`Receive: ${formatVnd(selectedPeriodDetailQuery.data.summary.totalOutstandingReceiveVnd)}`}
              </div>
              <div className="rounded-lg border border-slate-200 p-2 text-red-700">
                {`Pay: ${formatVnd(selectedPeriodDetailQuery.data.summary.totalOutstandingPayVnd)}`}
              </div>
            </div>

            <SectionCard title="Players" className="!rounded-xl" bodyClassName="!px-3 !py-3">
              {(selectedPeriodDetailQuery.data.players ?? []).length === 0 ? (
                <div className="text-sm text-slate-500">No player summary data.</div>
              ) : (
                <div className="space-y-2">
                  {sortOutstandingPlayers(selectedPeriodDetailQuery.data.players).map((player) => (
                    <div key={player.playerId} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900">{player.playerName}</span>
                        <span className={`text-sm font-semibold ${getOutstandingClassName(player.outstandingNetVnd)}`}>
                          {formatVnd(player.outstandingNetVnd)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Settlements" className="!rounded-xl" bodyClassName="!px-3 !py-3">
              {(selectedPeriodDetailQuery.data.settlements ?? []).length === 0 ? (
                <div className="text-sm text-slate-500">No settlements recorded in this period.</div>
              ) : (
                <div className="space-y-2">
                  {(selectedPeriodDetailQuery.data.settlements ?? []).map((settlement) => (
                    <div key={settlement.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <div className="text-xs text-slate-500">{formatDateTime(settlement.postedAt)}</div>
                      <div className="mt-1 text-xs text-slate-700">{`${settlement.lines.length} settlement lines`}</div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        ) : (
          <EmptyState title="Select a period" />
        )}
      </Drawer>
    </PageContainer>
  );
};
