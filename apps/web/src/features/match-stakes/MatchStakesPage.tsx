import { useEffect, useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  DeleteOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FilterOutlined,
  PlusOutlined
} from "@ant-design/icons";
import { Alert, Button, DatePicker, Input, InputNumber, Modal, Segmented, Select, Skeleton, Tag, Tooltip, message } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useNavigate } from "react-router-dom";
import { toAppError } from "@/api/httpClient";
import { matchStakesApi } from "@/api/matchStakesApi";
import { queryKeys } from "@/api/queryKeys";
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
  useAllDebtPeriods,
  useCreateMatchStakesHistoryEvent,
  useCloseDebtPeriod,
  useCreateDebtPeriod,
  useCreateDebtSettlement,
  useCurrentDebtPeriod,
  useDebtPeriodDetail,
  useDebtPeriodTimeline,
  useMatchStakesHistory,
  useInfiniteDebtPeriodHistory,
  useResetMatchStakesHistoryEvent
} from "@/features/match-stakes/hooks";
import { MatchStakesHistoryEventModal } from "@/features/match-stakes/components/MatchStakesHistoryEventModal";
import { MatchStakesHistoryFeed, type MatchStakesHistoryFeedItem } from "@/features/match-stakes/components/MatchStakesHistoryFeed";
import { MatchDetailOverlay, type MatchStakesDetailContext } from "@/features/matches/MatchDetailOverlay";
import { useActivePlayers } from "@/features/players/hooks";
import { getErrorMessage } from "@/lib/error-messages";
import { formatDateTime, formatVnd } from "@/lib/format";
import { debtPeriodStatusLabels, getEnumLabel } from "@/lib/labels";
import type {
  CreateMatchStakesHistoryEventRequest,
  CreateDebtSettlementLineRequest,
  DebtPeriodDetailDto,
  DebtPeriodPlayerSummaryDto,
  DebtPeriodTimelineDto,
  DebtPeriodTimelineMatchDto,
  DebtPeriodTimelinePlayerRowDto,
  MatchStakesHistoryItemDto
} from "@/types/api";

type SettlementLineForm = {
  localId: number;
  payerPlayerId?: string;
  receiverPlayerId?: string;
  amountVnd?: number;
  note: string;
};

type CurrentDebtViewMode = "after-advance" | "match-only";
type HistoryViewMode = "minimal" | "detail";
type CloseBalanceDraft = Record<string, number>;
type CurrentDebtDisplayPlayer = DebtPeriodPlayerSummaryDto & {
  displayOutstandingVnd: number;
  matchOnlyNetFromMatchesVnd: number;
};

const CURRENT_DEBT_VIEW_MODE_STORAGE_KEY = "tft2.matchStakes.currentDebtViewMode";
const DEFAULT_CURRENT_DEBT_VIEW_MODE: CurrentDebtViewMode = "match-only";
const HISTORY_VIEW_MODE_STORAGE_KEY = "tft2.match-stakes.history.view-mode";
const DEFAULT_HISTORY_VIEW_MODE: HistoryViewMode = "minimal";
const ALL_PERIODS_FILTER_VALUE = "__ALL_PERIODS__";

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

const sortByNetAmount = <T extends { playerName: string }>(items: T[], getAmount: (item: T) => number) => {
  const next = [...items];

  next.sort((left, right) => {
    const leftAmount = getAmount(left);
    const rightAmount = getAmount(right);
    const leftBucket = leftAmount > 0 ? 0 : leftAmount < 0 ? 1 : 2;
    const rightBucket = rightAmount > 0 ? 0 : rightAmount < 0 ? 1 : 2;

    if (leftBucket !== rightBucket) {
      return leftBucket - rightBucket;
    }

    if (leftBucket === 0 && leftAmount !== rightAmount) {
      return rightAmount - leftAmount;
    }

    if (leftBucket === 1 && leftAmount !== rightAmount) {
      return leftAmount - rightAmount;
    }

    return left.playerName.localeCompare(right.playerName);
  });

  return next;
};

const sortOutstandingPlayers = (players: DebtPeriodPlayerSummaryDto[]) => sortByNetAmount(players, (player) => player.outstandingNetVnd);

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
    const placementMatch = row.placementLabel.match(/top\s*(\d+)/i);
    if (placementMatch) {
      return `Top${placementMatch[1]}`;
    }

    return row.placementLabel;
  }

  const rank = getTimelinePlacementRank(row);
  if (typeof rank === "number") {
    return `Top${rank}`;
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

const toMillis = (iso: string) => Date.parse(iso);

const sortHistoryDesc = (history: DebtPeriodTimelineMatchDto[]) => {
  const next = [...history];
  next.sort((left, right) => {
    const leftMatchNo = typeof left.matchNo === "number" ? left.matchNo : Number.MAX_SAFE_INTEGER;
    const rightMatchNo = typeof right.matchNo === "number" ? right.matchNo : Number.MAX_SAFE_INTEGER;
    if (leftMatchNo !== rightMatchNo && Number.isFinite(leftMatchNo) && Number.isFinite(rightMatchNo)) {
      return rightMatchNo - leftMatchNo;
    }

    return toMillis(right.playedAt) - toMillis(left.playedAt);
  });

  return next;
};

const sortHistoryFeedDesc = (items: MatchStakesHistoryFeedItem[]) => {
  const next = [...items];
  next.sort((left, right) => {
    const postedDiff = toMillis(right.postedAt) - toMillis(left.postedAt);
    if (postedDiff !== 0) {
      return postedDiff;
    }

    const rightCreated = right.createdAt ? toMillis(right.createdAt) : 0;
    const leftCreated = left.createdAt ? toMillis(left.createdAt) : 0;
    if (rightCreated !== leftCreated) {
      return rightCreated - leftCreated;
    }

    return right.id.localeCompare(left.id);
  });
  return next;
};

const mapTimelineMatchesToHistoryItems = (
  timeline: DebtPeriodTimelineDto | undefined
): MatchStakesHistoryFeedItem[] =>
  (timeline?.history ?? []).map((historyItem) => ({
    id: `match:${historyItem.matchId}`,
    itemType: "MATCH",
    postedAt: historyItem.playedAt,
    periodId: timeline?.period.id ?? null,
    periodNo: timeline?.period.periodNo ?? null,
    matchId: historyItem.matchId,
    matchNo: historyItem.matchNo,
    label: historyItem.label,
    matchRows: historyItem.players
  }));

const mapTimelineEventsToHistoryItems = (
  timeline: DebtPeriodTimelineDto | undefined
): MatchStakesHistoryFeedItem[] =>
  (timeline?.events ?? []).map((eventItem) => ({
    id: eventItem.id,
    itemType: eventItem.itemType,
    eventType: eventItem.eventType ?? null,
    eventStatus: eventItem.eventStatus ?? null,
    resetAt: eventItem.resetAt ?? null,
    resetReason: eventItem.resetReason ?? null,
    postedAt: eventItem.postedAt,
    periodId: timeline?.period.id ?? null,
    periodNo: timeline?.period.periodNo ?? null,
    matchId: eventItem.matchId ?? null,
    matchNo: eventItem.matchNo ?? null,
    label: eventItem.label ?? null,
    playerId: eventItem.playerId ?? null,
    playerName: eventItem.playerName ?? null,
    amountVnd: eventItem.amountVnd ?? null,
    note: eventItem.note ?? null,
    reason: eventItem.reason ?? null,
    advancerPlayerId: eventItem.advancerPlayerId ?? null,
    participantPlayerIds: eventItem.participantPlayerIds ?? [],
    impactMode: eventItem.impactMode ?? null,
    affectsDebt: eventItem.affectsDebt ?? null,
    balanceBeforeVnd: eventItem.balanceBeforeVnd ?? null,
    balanceAfterVnd: eventItem.balanceAfterVnd ?? null,
    metadata: eventItem.metadata ?? null,
    matchRows: eventItem.rows
  }));

const mapSettlementToHistoryItems = (
  detail: DebtPeriodDetailDto | undefined,
  timeline: DebtPeriodTimelineDto | undefined
): MatchStakesHistoryFeedItem[] =>
  (detail?.settlements ?? []).map((settlement) => ({
    id: `settlement:${settlement.id}`,
    itemType: "DEBT_SETTLEMENT",
    postedAt: settlement.postedAt,
    createdAt: settlement.createdAt,
    periodId: detail?.period.id ?? null,
    periodNo: detail?.period.periodNo ?? timeline?.period.periodNo ?? null,
    amountVnd: settlement.lines.reduce((sum, line) => sum + line.amountVnd, 0),
    note: settlement.note ?? null,
    settlementLines: settlement.lines.map((line) => ({
      payerPlayerId: line.payerPlayerId,
      payerPlayerName: line.payerPlayerName,
      receiverPlayerId: line.receiverPlayerId,
      receiverPlayerName: line.receiverPlayerName,
      amountVnd: line.amountVnd,
      note: line.note
    }))
  }));

type MatchStakesHistoryUnifiedCompatItem = MatchStakesHistoryItemDto & {
  eventType?: string | null;
  title?: string | null;
  description?: string | null;
  player?: { id: string; name: string } | null;
  secondaryPlayer?: { id: string; name: string } | null;
  outstandingBeforeVnd?: number | null;
  outstandingAfterVnd?: number | null;
  debtPeriodId?: string | null;
  metadata?: unknown;
  matchRows?: DebtPeriodTimelinePlayerRowDto[];
};

type TimelineMatchLookup = {
  matchNo: number | null;
  label: string | null;
  rows: DebtPeriodTimelinePlayerRowDto[];
};
type MatchStakesPlayerImpact = NonNullable<MatchStakesHistoryItemDto["playerImpacts"]>[number];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const toOptionalNumber = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const toOptionalString = (value: unknown): string | null => (typeof value === "string" && value.trim().length > 0 ? value : null);
const toOptionalBoolean = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);
const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];

const normalizeHistoryItemType = (
  itemType: MatchStakesHistoryUnifiedCompatItem["itemType"] | string | null | undefined,
  eventType: string | null | undefined,
  matchId: string | null | undefined
): MatchStakesHistoryItemDto["itemType"] => {
  const normalizedItemType = typeof itemType === "string" ? itemType.toUpperCase() : null;
  const normalizedEventType = typeof eventType === "string" ? eventType.toUpperCase() : null;

  if (
    normalizedItemType === "MATCH" ||
    normalizedItemType === "DEBT_SETTLEMENT" ||
    normalizedItemType === "ADVANCE" ||
    normalizedItemType === "NOTE"
  ) {
    return normalizedItemType as MatchStakesHistoryItemDto["itemType"];
  }

  if (normalizedItemType === "MATCH_STAKES_ADVANCE") {
    return "ADVANCE";
  }

  if (normalizedItemType === "MATCH_STAKES_NOTE") {
    return "NOTE";
  }

  if (normalizedEventType === "MATCH_STAKES_ADVANCE") {
    return "ADVANCE";
  }

  if (normalizedEventType === "MATCH_STAKES_NOTE") {
    return "NOTE";
  }

  if (matchId) {
    return "MATCH";
  }

  return "NOTE";
};

const getImpactDelta = (impact: MatchStakesPlayerImpact) => {
  if (typeof impact.amountVnd === "number" && Number.isFinite(impact.amountVnd)) {
    return impact.amountVnd;
  }

  if (typeof impact.debtBeforeVnd === "number" && typeof impact.debtAfterVnd === "number") {
    return impact.debtAfterVnd - impact.debtBeforeVnd;
  }

  return null;
};

const pickAdvanceActorFromPlayerImpacts = (playerImpacts: MatchStakesHistoryItemDto["playerImpacts"]) => {
  if (!Array.isArray(playerImpacts) || playerImpacts.length === 0) {
    return null;
  }

  let candidate: { id: string | null; name: string | null; delta: number } | null = null;
  for (const impact of playerImpacts) {
    const delta = getImpactDelta(impact);
    if (delta === null || delta <= 0) {
      continue;
    }

    if (!candidate || delta > candidate.delta) {
      candidate = {
        id: impact.playerId ?? null,
        name: impact.playerName ?? null,
        delta
      };
    }
  }

  return candidate ? { id: candidate.id, name: candidate.name } : null;
};

const pickAdvanceActorFromMetadata = (metadata: unknown) => {
  if (!isRecord(metadata)) {
    return null;
  }

  const details = isRecord(metadata["details"]) ? metadata["details"] : metadata;
  const explicitPlayerId =
    toOptionalString(details["playerId"]) ??
    toOptionalString(details["advancerPlayerId"]) ??
    toOptionalString(details["actorPlayerId"]);
  const explicitPlayerName =
    toOptionalString(details["playerName"]) ??
    toOptionalString(details["advancerPlayerName"]) ??
    toOptionalString(details["actorPlayerName"]);

  if (explicitPlayerId || explicitPlayerName) {
    return {
      id: explicitPlayerId,
      name: explicitPlayerName
    };
  }

  const impactLines = details["impactLines"];
  if (!Array.isArray(impactLines)) {
    return null;
  }

  let candidate: { id: string | null; name: string | null; delta: number } | null = null;
  for (const line of impactLines) {
    if (!isRecord(line)) {
      continue;
    }

    const playerId = toOptionalString(line["playerId"]);
    const playerName = toOptionalString(line["playerName"]);
    const netDeltaVnd = toOptionalNumber(line["netDeltaVnd"]);
    if (netDeltaVnd === null || netDeltaVnd <= 0) {
      continue;
    }

    if (!candidate || netDeltaVnd > candidate.delta) {
      candidate = {
        id: playerId,
        name: playerName,
        delta: netDeltaVnd
      };
    }
  }

  return candidate ? { id: candidate.id, name: candidate.name } : null;
};

const buildTimelineMatchLookup = (timeline: DebtPeriodTimelineDto | undefined) => {
  const map = new Map<string, TimelineMatchLookup>();

  for (const historyItem of timeline?.history ?? []) {
    map.set(historyItem.matchId, {
      matchNo: historyItem.matchNo ?? null,
      label: historyItem.label ?? null,
      rows: historyItem.players
    });
  }

  return map;
};

const buildSettlementLineLookup = (detail: DebtPeriodDetailDto | undefined) => {
  const map = new Map<string, NonNullable<MatchStakesHistoryFeedItem["settlementLines"]>>();

  for (const settlement of detail?.settlements ?? []) {
    map.set(
      settlement.id,
      settlement.lines.map((line) => ({
        payerPlayerId: line.payerPlayerId,
        payerPlayerName: line.payerPlayerName,
        receiverPlayerId: line.receiverPlayerId,
        receiverPlayerName: line.receiverPlayerName,
        amountVnd: line.amountVnd,
        note: line.note
      }))
    );
  }

  return map;
};

const mapServerHistoryItem = (
  item: MatchStakesHistoryItemDto,
  context?: {
    periodNo?: number | null;
    timelineMatchById?: Map<string, TimelineMatchLookup>;
    settlementLinesById?: Map<string, NonNullable<MatchStakesHistoryFeedItem["settlementLines"]>>;
  }
): MatchStakesHistoryFeedItem => {
  const compatItem = item as MatchStakesHistoryUnifiedCompatItem;
  const metadata = isRecord(compatItem.metadata) ? compatItem.metadata : null;
  const metadataDetails = metadata && isRecord(metadata["details"]) ? metadata["details"] : metadata;
  const metadataMatchNo = metadata ? toOptionalNumber(metadata["periodMatchNo"]) : null;
  const metadataEventType =
    (metadataDetails && toOptionalString(metadataDetails["eventType"])) ?? (metadata ? toOptionalString(metadata["eventType"]) : null);
  const metadataImpactMode = metadataDetails ? toOptionalString(metadataDetails["impactMode"]) : null;
  const metadataAffectsDebt = metadataDetails ? toOptionalBoolean(metadataDetails["affectsDebt"]) : null;
  const metadataEventStatus = metadataDetails ? toOptionalString(metadataDetails["eventStatus"]) : null;
  const metadataResetAt = metadataDetails ? toOptionalString(metadataDetails["resetAt"]) : null;
  const metadataResetReason = metadataDetails ? toOptionalString(metadataDetails["resetReason"]) : null;
  const metadataParticipantPlayerIds = metadataDetails ? toStringArray(metadataDetails["participantPlayerIds"]) : [];
  const eventType = compatItem.eventType ?? metadataEventType;
  const resolvedItemType = normalizeHistoryItemType(compatItem.itemType, eventType, compatItem.matchId);
  const timelineMatch = compatItem.matchId ? context?.timelineMatchById?.get(compatItem.matchId) : undefined;
  const settlementLines = Array.isArray(compatItem.settlementLines)
    ? compatItem.settlementLines
    : context?.settlementLinesById?.get(compatItem.id);
  const matchRows = Array.isArray(compatItem.matchRows) && compatItem.matchRows.length > 0 ? compatItem.matchRows : timelineMatch?.rows;
  const advanceActorFromMetadata = resolvedItemType === "ADVANCE" ? pickAdvanceActorFromMetadata(compatItem.metadata) : null;
  const advanceActorFromImpacts = resolvedItemType === "ADVANCE" ? pickAdvanceActorFromPlayerImpacts(compatItem.playerImpacts) : null;
  const resolvedPlayerId =
    compatItem.playerId ?? compatItem.player?.id ?? advanceActorFromMetadata?.id ?? advanceActorFromImpacts?.id ?? null;
  const resolvedPlayerName =
    compatItem.playerName ??
    compatItem.player?.name ??
    advanceActorFromMetadata?.name ??
    advanceActorFromImpacts?.name ??
    null;

  return {
    ...compatItem,
    itemType: resolvedItemType,
    eventType,
    id: compatItem.id,
    postedAt: compatItem.postedAt,
    createdAt: compatItem.createdAt ?? null,
    periodId: compatItem.periodId ?? compatItem.debtPeriodId ?? null,
    periodNo: compatItem.periodNo ?? context?.periodNo ?? null,
    matchId: compatItem.matchId ?? null,
    matchNo: compatItem.matchNo ?? metadataMatchNo ?? timelineMatch?.matchNo ?? null,
    label: compatItem.label ?? compatItem.title ?? timelineMatch?.label ?? null,
    playerId: resolvedPlayerId,
    playerName: resolvedPlayerName,
    amountVnd: compatItem.amountVnd ?? null,
    note: compatItem.note ?? null,
    reason: compatItem.reason ?? compatItem.description ?? null,
    eventStatus:
      compatItem.eventStatus ??
      (metadataEventStatus === "ACTIVE" || metadataEventStatus === "RESET" ? metadataEventStatus : null),
    resetAt: compatItem.resetAt ?? metadataResetAt ?? null,
    resetReason: compatItem.resetReason ?? metadataResetReason ?? null,
    advancerPlayerId: compatItem.advancerPlayerId ?? advanceActorFromMetadata?.id ?? resolvedPlayerId,
    participantPlayerIds:
      Array.isArray(compatItem.participantPlayerIds) && compatItem.participantPlayerIds.length > 0
        ? compatItem.participantPlayerIds
        : metadataParticipantPlayerIds,
    impactMode:
      compatItem.impactMode ??
      (metadataImpactMode === "AFFECTS_DEBT" || metadataImpactMode === "INFORMATIONAL" ? metadataImpactMode : null),
    affectsDebt: toOptionalBoolean(compatItem.affectsDebt) ?? metadataAffectsDebt,
    balanceBeforeVnd:
      typeof compatItem.balanceBeforeVnd === "number"
        ? compatItem.balanceBeforeVnd
        : typeof compatItem.outstandingBeforeVnd === "number"
          ? compatItem.outstandingBeforeVnd
          : null,
    balanceAfterVnd:
      typeof compatItem.balanceAfterVnd === "number"
        ? compatItem.balanceAfterVnd
        : typeof compatItem.outstandingAfterVnd === "number"
          ? compatItem.outstandingAfterVnd
          : null,
    settlementLines,
    matchRows
  };
};

export const MatchStakesPage = () => {
  const navigate = useNavigate();
  const { canWrite } = useAuth();
  const canWriteActions = canWrite();

  const [selectedMatchId, setSelectedMatchId] = useState<string>();
  const [selectedMatchContext, setSelectedMatchContext] = useState<MatchStakesDetailContext>();
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>();
  const historyLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const [showDebtPeriodDetail, setShowDebtPeriodDetail] = useState(false);
  const [periodFilterOpen, setPeriodFilterOpen] = useState(false);
  const [currentDebtViewMode, setCurrentDebtViewMode] = useState<CurrentDebtViewMode>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_CURRENT_DEBT_VIEW_MODE;
    }

    const saved = window.localStorage.getItem(CURRENT_DEBT_VIEW_MODE_STORAGE_KEY);
    return saved === "match-only" ? "match-only" : DEFAULT_CURRENT_DEBT_VIEW_MODE;
  });
  const [historyViewMode, setHistoryViewMode] = useState<HistoryViewMode>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_HISTORY_VIEW_MODE;
    }

    const saved = window.localStorage.getItem(HISTORY_VIEW_MODE_STORAGE_KEY);
    return saved === "detail" ? "detail" : DEFAULT_HISTORY_VIEW_MODE;
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
  const [closeBalanceDraft, setCloseBalanceDraft] = useState<CloseBalanceDraft>({});

  const [historyEventOpen, setHistoryEventOpen] = useState(false);
  const [historyEventApiError, setHistoryEventApiError] = useState<string | null>(null);
  const [resetAdvanceOpen, setResetAdvanceOpen] = useState(false);
  const [resetAdvanceApiError, setResetAdvanceApiError] = useState<string | null>(null);
  const [resetAdvanceReason, setResetAdvanceReason] = useState("");
  const [resetAdvanceTarget, setResetAdvanceTarget] = useState<MatchStakesHistoryFeedItem | null>(null);

  const currentPeriodQuery = useCurrentDebtPeriod();
  const allPeriodsQuery = useAllDebtPeriods();
  const selectedPeriodTimelineQuery = useDebtPeriodTimeline(selectedPeriodId);
  const selectedPeriodDetailQuery = useDebtPeriodDetail(selectedPeriodId);
  const allHistoryPeriodsQuery = useInfiniteDebtPeriodHistory(!selectedPeriodId);
  const selectedPeriodHistoryQuery = useMatchStakesHistory(
    { periodId: selectedPeriodId, page: 1, pageSize: 200 },
    Boolean(selectedPeriodId)
  );

  const createSettlementMutation = useCreateDebtSettlement();
  const closePeriodMutation = useCloseDebtPeriod();
  const createPeriodMutation = useCreateDebtPeriod();
  const createHistoryEventMutation = useCreateMatchStakesHistoryEvent();
  const resetHistoryEventMutation = useResetMatchStakesHistoryEvent();
  const playersQuery = useActivePlayers();

  const openPeriodId = currentPeriodQuery.data?.period?.id;
  const hasOpenPeriod = Boolean(openPeriodId);

  const allPeriods = allPeriodsQuery.data ?? [];
  const activePeriodId = selectedPeriodId ?? openPeriodId ?? allPeriods[0]?.id;
  const activePeriodTimelineQuery = useDebtPeriodTimeline(activePeriodId);

  useEffect(() => {
    setSelectedPeriodId((current) => {
      if (current && allPeriods.some((period) => period.id === current)) {
        return current;
      }

      return undefined;
    });
  }, [allPeriods]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CURRENT_DEBT_VIEW_MODE_STORAGE_KEY, currentDebtViewMode);
    }
  }, [currentDebtViewMode]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(HISTORY_VIEW_MODE_STORAGE_KEY, historyViewMode);
    }
  }, [historyViewMode]);

  useEffect(() => {
    if (selectedPeriodId || !allHistoryPeriodsQuery.hasNextPage || allHistoryPeriodsQuery.isFetchingNextPage) {
      return;
    }

    const sentinel = historyLoadMoreRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void allHistoryPeriodsQuery.fetchNextPage();
        }
      },
      { rootMargin: "240px 0px" }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [
    allHistoryPeriodsQuery.fetchNextPage,
    allHistoryPeriodsQuery.hasNextPage,
    allHistoryPeriodsQuery.isFetchingNextPage,
    selectedPeriodId
  ]);

  const selectedTimeline = selectedPeriodTimelineQuery.data;
  const activeTimeline = activePeriodTimelineQuery.data;
  const activePeriod = activeTimeline?.period;
  const activeSummary = activeTimeline?.summary;
  const closePeriod = currentPeriodQuery.data?.period;
  const closeSummary = currentPeriodQuery.data?.summary;

  const selectedFilterPeriod =
    selectedTimeline?.period ?? (selectedPeriodId ? allPeriods.find((period) => period.id === selectedPeriodId) : undefined);
  const selectedFilterSummary = selectedTimeline?.summary;
  const hideCurrentDebtSection = Boolean(selectedPeriodId && selectedFilterPeriod?.status === "CLOSED");

  const sortedPlayers = useMemo(() => sortOutstandingPlayers(activeTimeline?.players ?? []), [activeTimeline?.players]);
  const currentDebtPlayers = useMemo<CurrentDebtDisplayPlayer[]>(() => {
    const players = activeTimeline?.players ?? [];
    const initialByPlayerId = new Map((activeTimeline?.initialRows ?? []).map((row) => [row.playerId, row.cumulativeNetVnd]));
    const latestMatchByPlayerId = new Map<string, number>();

    for (const matchItem of activeTimeline?.history ?? []) {
      for (const row of matchItem.players) {
        if (!latestMatchByPlayerId.has(row.playerId)) {
          latestMatchByPlayerId.set(row.playerId, row.cumulativeNetVnd);
        }
      }
    }

    return players.map((player) => {
      const initialNetVnd = typeof player.initNetVnd === "number" ? player.initNetVnd : (initialByPlayerId.get(player.playerId) ?? 0);
      const matchOnlyOutstandingVnd = latestMatchByPlayerId.get(player.playerId) ?? initialByPlayerId.get(player.playerId) ?? initialNetVnd;
      const displayOutstandingVnd =
        currentDebtViewMode === "match-only" ? matchOnlyOutstandingVnd : player.outstandingNetVnd;

      return {
        ...player,
        initNetVnd: initialNetVnd,
        displayOutstandingVnd,
        matchOnlyNetFromMatchesVnd: matchOnlyOutstandingVnd - initialNetVnd
      };
    });
  }, [activeTimeline?.history, activeTimeline?.initialRows, activeTimeline?.players, currentDebtViewMode]);
  const sortedCurrentDebtPlayers = useMemo(
    () => sortByNetAmount(currentDebtPlayers, (player) => player.displayOutstandingVnd),
    [currentDebtPlayers]
  );
  const initialPlayers = useMemo(
    () => sortTimelineRows(activeTimeline?.initialRows ?? []),
    [activeTimeline?.initialRows]
  );
  const closeBalancePlayers = useMemo(
    () => sortOutstandingPlayers(currentPeriodQuery.data?.players ?? []),
    [currentPeriodQuery.data?.players]
  );
  const closeBalanceRows = useMemo(
    () =>
      closeBalancePlayers.map((player) => ({
        ...player,
        draftNetVnd: closeBalanceDraft[player.playerId] ?? 0
      })),
    [closeBalanceDraft, closeBalancePlayers]
  );

  useEffect(() => {
    if (!closePeriodOpen) {
      return;
    }

    setCloseBalanceDraft((previous) => {
      const next: CloseBalanceDraft = {};
      for (const player of closeBalancePlayers) {
        next[player.playerId] = previous[player.playerId] ?? 0;
      }

      const changed =
        Object.keys(next).length !== Object.keys(previous).length ||
        Object.entries(next).some(([playerId, value]) => previous[playerId] !== value);

      return changed ? next : previous;
    });
  }, [closeBalancePlayers, closePeriodOpen]);

  const historyPeriodGroups = useMemo(
    () => (allHistoryPeriodsQuery.data?.pages ?? []).flatMap((page) => page.periodTimelines),
    [allHistoryPeriodsQuery.data]
  );

  const periodServerHistoryQueries = useQueries({
    queries: historyPeriodGroups.map((periodTimeline) => ({
      queryKey: queryKeys.matchStakes.periodHistory(periodTimeline.period.id),
      queryFn: () => matchStakesApi.history({ periodId: periodTimeline.period.id, page: 1, pageSize: 200 }),
      enabled: !selectedPeriodId
    }))
  });

  const periodDetailQueries = useQueries({
    queries: historyPeriodGroups.map((periodTimeline) => ({
      queryKey: queryKeys.matchStakes.periodDetail(periodTimeline.period.id),
      queryFn: () => matchStakesApi.periodDetail(periodTimeline.period.id),
      enabled: !selectedPeriodId
    }))
  });

  const periodServerHistoryById = useMemo(() => {
    const map = new Map<string, (ReturnType<typeof matchStakesApi.history> extends Promise<infer T> ? T : never) | undefined>();
    historyPeriodGroups.forEach((periodTimeline, index) => {
      map.set(periodTimeline.period.id, periodServerHistoryQueries[index]?.data);
    });
    return map;
  }, [historyPeriodGroups, periodServerHistoryQueries]);

  const periodDetailById = useMemo(() => {
    const map = new Map<string, (ReturnType<typeof matchStakesApi.periodDetail> extends Promise<infer T> ? T : never) | undefined>();
    historyPeriodGroups.forEach((periodTimeline, index) => {
      map.set(periodTimeline.period.id, periodDetailQueries[index]?.data);
    });
    return map;
  }, [historyPeriodGroups, periodDetailQueries]);

  const settlementPlayerOptions = sortedPlayers.map((player) => ({
    label: player.playerName,
    value: player.playerId
  }));
  const historyEventPlayerOptions = useMemo(
    () => (playersQuery.data ?? []).map((player) => ({ label: player.displayName, value: player.id })),
    [playersQuery.data]
  );
  const selectedTimelineMatchById = useMemo(() => buildTimelineMatchLookup(selectedTimeline), [selectedTimeline]);
  const selectedSettlementLinesById = useMemo(
    () => buildSettlementLineLookup(selectedPeriodDetailQuery.data),
    [selectedPeriodDetailQuery.data]
  );

  const selectedPeriodHistoryItems = useMemo<MatchStakesHistoryFeedItem[]>(() => {
    const serverItems = selectedPeriodHistoryQuery.data?.data;
    if (Array.isArray(serverItems)) {
      return sortHistoryFeedDesc(
        serverItems.map((item) =>
          mapServerHistoryItem(item, {
            periodNo: selectedTimeline?.period.periodNo ?? selectedPeriodDetailQuery.data?.period.periodNo ?? null,
            timelineMatchById: selectedTimelineMatchById,
            settlementLinesById: selectedSettlementLinesById
          })
        )
      );
    }

    const fallbackItems = [
      ...mapTimelineMatchesToHistoryItems(selectedTimeline),
      ...mapTimelineEventsToHistoryItems(selectedTimeline),
      ...mapSettlementToHistoryItems(selectedPeriodDetailQuery.data, selectedTimeline)
    ];
    return sortHistoryFeedDesc(fallbackItems);
  }, [
    selectedPeriodDetailQuery.data,
    selectedPeriodHistoryQuery.data,
    selectedSettlementLinesById,
    selectedTimeline,
    selectedTimelineMatchById
  ]);

  const periodHistoryItemsById = useMemo(() => {
    const map = new Map<string, MatchStakesHistoryFeedItem[]>();

    historyPeriodGroups.forEach((periodTimeline) => {
      const periodId = periodTimeline.period.id;
      const serverPayload = periodServerHistoryById.get(periodId);
      const serverItems = serverPayload?.data;
      const detail = periodDetailById.get(periodId);
      const timelineMatchById = buildTimelineMatchLookup(periodTimeline);
      const settlementLinesById = buildSettlementLineLookup(detail);

      if (Array.isArray(serverItems)) {
        map.set(
          periodId,
          sortHistoryFeedDesc(
            serverItems.map((item) =>
              mapServerHistoryItem(item, {
                periodNo: periodTimeline.period.periodNo,
                timelineMatchById,
                settlementLinesById
              })
            )
          )
        );
        return;
      }

      const fallbackItems = [
        ...mapTimelineMatchesToHistoryItems(periodTimeline),
        ...mapTimelineEventsToHistoryItems(periodTimeline),
        ...mapSettlementToHistoryItems(detail, periodTimeline)
      ];
      map.set(periodId, sortHistoryFeedDesc(fallbackItems));
    });

    return map;
  }, [historyPeriodGroups, periodDetailById, periodServerHistoryById]);

  const closePeriodTargetId = closePeriod?.id;
  const hasOutstanding = hasAnyOutstandingBalance(
    closeSummary?.totalOutstandingReceiveVnd ?? 0,
    closeSummary?.totalOutstandingPayVnd ?? 0
  );

  const settlementFormValid = settlementLines.length > 0 && settlementLines.every(isSettlementLineValid);
  const canSubmitSettlement = canWriteActions && Boolean(closePeriodTargetId) && settlementFormValid && !createSettlementMutation.isPending;
  const canCloseWithMatch = (closeSummary?.totalMatches ?? 0) >= 1;
  const canOpenClosePeriod = canWriteActions && Boolean(closePeriodTargetId) && canCloseWithMatch;
  const expectedCloseConfirmText = closePeriod ? `Close Period ${closePeriod.periodNo}` : "";
  const canConfirmClosePeriod =
    canCloseWithMatch && Boolean(expectedCloseConfirmText) && closePeriodConfirmText.trim() === expectedCloseConfirmText;
  const canConfirmResetAdvance =
    Boolean(resetAdvanceTarget) && resetAdvanceTarget?.itemType === "ADVANCE" && resetAdvanceTarget?.eventStatus === "ACTIVE";
  const closingBalances = closeBalanceRows.map((player) => ({
    playerId: player.playerId,
    netVnd: Math.trunc(player.draftNetVnd)
  }));

  const openSettlementModal = () => {
    if (!guardWritePermission(canWriteActions)) {
      return;
    }
    setSettlementApiError(null);
    setSettlementPostedAt(dayjs());
    setSettlementNote("");
    setSettlementLines([createSettlementLine(1)]);
    setSettlementLineSeed(2);
    setSettlementOpen(true);
  };

  const openCreatePeriodModal = () => {
    if (!guardWritePermission(canWriteActions)) {
      return;
    }
    setCreatePeriodApiError(null);
    setCreatePeriodTitle("");
    setCreatePeriodNote("");
    setCreatePeriodOpen(true);
  };

  const openHistoryEventModal = () => {
    if (!guardWritePermission(canWriteActions)) {
      return;
    }
    if (!openPeriodId) {
      message.warning("No open period. Please create/open a period first.");
      return;
    }

    setHistoryEventApiError(null);
    setHistoryEventOpen(true);
  };

  const openResetAdvanceModal = (item: MatchStakesHistoryFeedItem) => {
    if (!guardWritePermission(canWriteActions)) {
      return;
    }

    if (item.itemType !== "ADVANCE" || item.eventStatus !== "ACTIVE") {
      return;
    }

    setResetAdvanceApiError(null);
    setResetAdvanceReason("");
    setResetAdvanceTarget(item);
    setResetAdvanceOpen(true);
  };

  const openClosePeriodModal = () => {
    if (!guardWritePermission(canWriteActions)) {
      return;
    }
    setClosePeriodApiError(null);
    setClosePeriodNote("");
    setClosePeriodConfirmText("");
    setCloseBalanceDraft(
      Object.fromEntries(closeBalancePlayers.map((player) => [player.playerId, 0]))
    );
    setClosePeriodOpen(true);
  };

  const periodSelectOptions = [
    {
      value: ALL_PERIODS_FILTER_VALUE,
      label: "All periods - Full history"
    },
    ...allPeriods.map((period) => ({
      value: period.id,
      label: `Period #${period.periodNo} - ${getEnumLabel(debtPeriodStatusLabels, period.status)}`
    }))
  ];
  const hasNonDefaultFilters = Boolean(selectedPeriodId) || historyViewMode !== DEFAULT_HISTORY_VIEW_MODE;

  const resetFiltersToDefault = () => {
    setSelectedPeriodId(undefined);
    setHistoryViewMode(DEFAULT_HISTORY_VIEW_MODE);
    setPeriodFilterOpen(false);
  };

  const openMatchDetail = (historyItem: DebtPeriodTimelineMatchDto, periodNo?: number | null) => {
    setSelectedMatchId(historyItem.matchId);
    setSelectedMatchContext({
      matchNo: historyItem.matchNo,
      periodNo: periodNo ?? null,
      participantLedgerRows: historyItem.players.map((row) => ({
        playerId: row.playerId,
        playerName: row.playerName,
        placement: typeof row.tftPlacement === "number" ? row.tftPlacement : row.relativeRank,
        matchNetVnd: row.matchNetVnd,
        debtBeforeVnd: row.cumulativeNetVnd - row.matchNetVnd,
        debtAfterVnd: row.cumulativeNetVnd
      }))
    });
  };

  const renderMobilePeriodSequence = (periodTimeline: DebtPeriodTimelineDto) => {
    const mobileMatches = sortHistoryDesc(periodTimeline.history);

    return (
      <div key={periodTimeline.period.id} className="space-y-2 md:rounded-xl md:border md:border-slate-200 md:bg-slate-50/70 md:p-2.5">
        {periodTimeline.period.closedAt ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Period End</div>
            <div className="mt-0.5 text-xs font-semibold text-rose-900">{`End Period #${periodTimeline.period.periodNo}`}</div>
          </div>
        ) : null}

        {mobileMatches.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">No matches in this period yet.</div>
        ) : (
          <div className="space-y-1.5">
            {mobileMatches.map((historyItem) => (
              <button
                key={historyItem.matchId}
                className="focus-ring w-full rounded-lg border border-slate-200/90 bg-white p-2.5 text-left transition hover:border-brand-500"
                onClick={() => openMatchDetail(historyItem, periodTimeline.period.periodNo)}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Tag className="!text-[11px]" color="blue">
                      {typeof historyItem.matchNo === "number" ? `Match#${historyItem.matchNo}` : "Match"}
                    </Tag>
                    <Tag className="!text-[11px]" color="geekblue">
                      TFT
                    </Tag>
                  </div>
                  <div className="text-xs font-medium text-slate-700">{formatDateTime(historyItem.playedAt)}</div>
                </div>

                <div className="mt-2 space-y-1.5">
                  {sortTimelineRows(historyItem.players).map((row) => (
                    <div key={`${historyItem.matchId}-${row.playerId}`} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 text-sm font-medium text-slate-900">{row.playerName}</div>
                        <div className={`text-base font-semibold ${getOutstandingClassName(row.cumulativeNetVnd)}`}>{formatSignedVnd(row.cumulativeNetVnd)}</div>
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
        )}

        {periodTimeline.initialRows.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">Init period: no players yet.</div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Init</div>
            <div className="mt-1 space-y-1">
              {sortTimelineRows(periodTimeline.initialRows).map((row) => (
                <div key={`${periodTimeline.period.id}-init-${row.playerId}`} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-600">{row.playerName}</span>
                  <span className="font-medium text-slate-600">{formatSignedVnd(row.cumulativeNetVnd)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Period Start</div>
          <div className="mt-0.5 text-xs font-semibold text-emerald-900">{`Start Period #${periodTimeline.period.periodNo}`}</div>
        </div>
      </div>
    );
  };

  return (
    <PageContainer>
      <AppBreadcrumb items={[{ label: "Match Stakes" }]} />

      <PageHeader
        title="Match Stakes"
        actions={
          canWriteActions ? (
            <>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/match-stakes/new")}>
                Create match
              </Button>
              <Tooltip title={openPeriodId ? "Add advance event to current open period." : "Need an open period to add history event."}>
                <span>
                  <Button onClick={openHistoryEventModal} disabled={!openPeriodId}>
                    Add history event
                  </Button>
                </span>
              </Tooltip>
              {hasOpenPeriod ? (
                <Tooltip title={canOpenClosePeriod ? "Close this period (requires confirmation in modal)." : "Need at least 1 match to close period."}>
                  <span>
                    <Button onClick={openClosePeriodModal} disabled={!canOpenClosePeriod}>
                      Close period
                    </Button>
                  </span>
                </Tooltip>
              ) : null}
              {!hasOpenPeriod ? (
                <Button onClick={openCreatePeriodModal}>
                  New debt period
                </Button>
              ) : null}
            </>
          ) : null
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
        <Button onClick={resetFiltersToDefault} disabled={!hasNonDefaultFilters}>
          Reset filters
        </Button>
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
              actionLabel={canWriteActions ? "New debt period" : undefined}
              onAction={canWriteActions ? openCreatePeriodModal : undefined}
            />
          ) : (
            <div className="space-y-3">
              {!hasOpenPeriod ? (
                <Alert
                  type="info"
                  showIcon
                  message="No open debt period right now. You can still review historical periods below."
                  action={canWriteActions ? <Button size="small" onClick={openCreatePeriodModal}>New debt period</Button> : null}
                />
              ) : null}

              {!activePeriodId ? (
                <EmptyState title="No debt periods yet" description="Create a debt period to start tracking debt accumulation by match." />
              ) : activePeriodTimelineQuery.isLoading ? (
                <Skeleton active paragraph={{ rows: 4 }} />
              ) : activePeriodTimelineQuery.isError ? (
                <ErrorState
                  description={getErrorMessage(toAppError(activePeriodTimelineQuery.error))}
                  onRetry={() => void activePeriodTimelineQuery.refetch()}
                />
              ) : activePeriod ? (
                <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Period</div>
                    <div className="mt-1 font-semibold text-slate-900">{`#${activePeriod.periodNo}`}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Opened</div>
                    <div className="mt-1 font-semibold text-slate-900">{formatDateTime(activePeriod.openedAt)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Total matches</div>
                    <div className="mt-1 font-semibold text-slate-900">{activeSummary?.totalMatches ?? 0}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Status</div>
                    <div className="mt-1">
                      <Tag color={activePeriod.status === "OPEN" ? "green" : "default"}>
                        {getEnumLabel(debtPeriodStatusLabels, activePeriod.status)}
                      </Tag>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Closed</div>
                    <div className="mt-1 font-semibold text-slate-900">{formatDateTime(activePeriod.closedAt)}</div>
                  </div>
                </div>
              ) : (
                <EmptyState title="Selected period not found" />
              )}
            </div>
          )}
        </SectionCard>
      ) : null}

      {!hideCurrentDebtSection ? (
        <SectionCard
          title="Current Debt"
          actions={
            <Segmented
              size="small"
              value={currentDebtViewMode}
              options={[
                { label: "Match only", value: "match-only" },
                { label: "After advance", value: "after-advance" }
              ]}
              onChange={(value) => setCurrentDebtViewMode(value as CurrentDebtViewMode)}
            />
          }
          className="border-amber-400 shadow-xl shadow-amber-200/80 overflow-hidden"
          bodyClassName="bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50"
        >
          {!activePeriodId ? (
            <EmptyState title="No debt periods yet" />
          ) : activePeriodTimelineQuery.isLoading ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : activePeriodTimelineQuery.isError ? (
            <ErrorState
              description={getErrorMessage(toAppError(activePeriodTimelineQuery.error))}
              onRetry={() => void activePeriodTimelineQuery.refetch()}
            />
          ) : sortedCurrentDebtPlayers.length === 0 ? (
            <EmptyState title="No players in this period yet" description="Create matches to start accumulating debt." />
          ) : (
            <div className="space-y-2.5">
              {sortedCurrentDebtPlayers.map((player) => (
                <div key={player.playerId} className={`rounded-xl border p-3.5 shadow-sm ${getDebtCardToneClassName(player.displayOutstandingVnd)}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-base font-semibold text-slate-900">{player.playerName}</div>
                    <div className={`text-2xl font-bold lg:text-3xl ${getOutstandingClassName(player.displayOutstandingVnd)}`}>
                      {formatSignedVnd(player.displayOutstandingVnd)}
                    </div>
                  </div>
                  {currentDebtViewMode === "after-advance" ? (
                    <div className="mt-1 text-[11px] text-slate-500">{`Accrued ${formatVnd(player.accruedNetVnd)} | Paid ${formatVnd(player.settledPaidVnd)} | Received ${formatVnd(player.settledReceivedVnd)}`}</div>
                  ) : (
                    <div className="mt-1 text-[11px] text-slate-500">{`Init ${formatVnd(player.initNetVnd ?? 0)} | Match net ${formatSignedVnd(player.matchOnlyNetFromMatchesVnd)}`}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}

      <SectionCard
        title="History"
        actions={
          <Segmented
            size="small"
            value={historyViewMode}
            options={[
              { label: "Minimal", value: "minimal" },
              { label: "Detail", value: "detail" }
            ]}
            onChange={(value) => setHistoryViewMode(value as HistoryViewMode)}
          />
        }
      >
        {selectedPeriodId ? (
          selectedPeriodTimelineQuery.isLoading || selectedPeriodDetailQuery.isLoading ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : selectedPeriodTimelineQuery.isError ? (
            <ErrorState
              description={getErrorMessage(toAppError(selectedPeriodTimelineQuery.error))}
              onRetry={() => void selectedPeriodTimelineQuery.refetch()}
            />
          ) : selectedPeriodHistoryQuery.isError ? (
            <ErrorState
              description={getErrorMessage(toAppError(selectedPeriodHistoryQuery.error))}
              onRetry={() => void selectedPeriodHistoryQuery.refetch()}
            />
          ) : (
            <div className="space-y-2.5">
              {selectedPeriodHistoryQuery.data === null ? (
                <Alert
                  type="info"
                  showIcon
                  message="Using timeline + debt settlements while unified history API is unavailable for this period."
                />
              ) : null}

              <MatchStakesHistoryFeed
                items={selectedPeriodHistoryItems}
                viewMode={historyViewMode}
                debtViewMode={currentDebtViewMode}
                onRequestResetAdvance={canWriteActions ? openResetAdvanceModal : undefined}
                resettingEventId={resetHistoryEventMutation.isPending ? resetAdvanceTarget?.id ?? null : null}
                emptyTitle="No history in this period yet"
                emptyDescription="Create matches or add history events."
                onOpenMatch={(item) => {
                  if (!item.matchId) {
                    return;
                  }

                  openMatchDetail(
                    {
                      matchId: item.matchId,
                      playedAt: item.postedAt,
                      matchNo: item.matchNo ?? null,
                      label: item.label ?? null,
                      players: item.matchRows ?? []
                    },
                    selectedTimeline?.period.periodNo
                  );
                }}
              />

              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-2.5">
                <div className="text-sm font-semibold text-slate-900">{`Init of Period #${selectedTimeline?.period.periodNo ?? "-"}`}</div>
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
          )
        ) : allHistoryPeriodsQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : allHistoryPeriodsQuery.isError ? (
          <ErrorState
            description={getErrorMessage(toAppError(allHistoryPeriodsQuery.error))}
            onRetry={() => void allHistoryPeriodsQuery.refetch()}
          />
        ) : historyPeriodGroups.length === 0 ? (
          <EmptyState title="No match history yet" description="Create matches to start building debt history." />
        ) : (
          <div className="space-y-3">
            {historyPeriodGroups.map((periodTimeline) => {
              const feedItems = periodHistoryItemsById.get(periodTimeline.period.id) ?? [];
              const usedFallback = periodServerHistoryById.get(periodTimeline.period.id) === null;

              return (
                <div key={periodTimeline.period.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-900">{`Period #${periodTimeline.period.periodNo}`}</div>
                    <Tag color={periodTimeline.period.status === "OPEN" ? "green" : "default"}>
                      {getEnumLabel(debtPeriodStatusLabels, periodTimeline.period.status)}
                    </Tag>
                  </div>
                  <div className="mb-2 text-xs text-slate-500">{`Opened ${formatDateTime(periodTimeline.period.openedAt)} | Matches ${periodTimeline.summary.totalMatches}`}</div>

                  {usedFallback ? (
                    <Alert
                      className="mb-2"
                      type="info"
                      showIcon
                      message="Fallback mode for this period: timeline + debt settlements merged locally."
                    />
                  ) : null}

                  <MatchStakesHistoryFeed
                    items={feedItems}
                    viewMode={historyViewMode}
                    debtViewMode={currentDebtViewMode}
                    onRequestResetAdvance={canWriteActions ? openResetAdvanceModal : undefined}
                    resettingEventId={resetHistoryEventMutation.isPending ? resetAdvanceTarget?.id ?? null : null}
                    onOpenMatch={(item) => {
                      if (!item.matchId) {
                        return;
                      }

                      openMatchDetail(
                        {
                          matchId: item.matchId,
                          playedAt: item.postedAt,
                          matchNo: item.matchNo ?? null,
                          label: item.label ?? null,
                          players: item.matchRows ?? []
                        },
                        periodTimeline.period.periodNo
                      );
                    }}
                  />

                  <div className="mt-2 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-2.5">
                    <div className="text-sm font-semibold text-slate-900">{`Init of Period #${periodTimeline.period.periodNo}`}</div>
                    {periodTimeline.initialRows.length === 0 ? (
                      <div className="mt-2 text-sm text-slate-500">No players yet.</div>
                    ) : (
                      <div className="mt-2 space-y-1">
                        {sortTimelineRows(periodTimeline.initialRows).map((player) => (
                          <div key={`${periodTimeline.period.id}-init-${player.playerId}`} className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-slate-600">{player.playerName}</span>
                            <span className="font-medium text-slate-600">{formatSignedVnd(player.cumulativeNetVnd)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <div ref={historyLoadMoreRef} className="rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-2.5 text-center text-xs text-slate-500">
              {allHistoryPeriodsQuery.isFetchingNextPage
                ? "Loading older periods..."
                : allHistoryPeriodsQuery.hasNextPage
                  ? "Scroll to load older periods"
                  : "All periods loaded"}
            </div>
          </div>
        )}
      </SectionCard>

      <MatchDetailOverlay
        open={Boolean(selectedMatchId)}
        matchId={selectedMatchId}
        matchStakesContext={selectedMatchContext}
        onClose={() => {
          setSelectedMatchId(undefined);
          setSelectedMatchContext(undefined);
        }}
      />

      <MatchStakesHistoryEventModal
        open={historyEventOpen}
        canWrite={canWriteActions}
        loading={createHistoryEventMutation.isPending}
        apiError={historyEventApiError}
        openPeriodId={openPeriodId}
        openPeriodNo={currentPeriodQuery.data?.period.periodNo}
        playerOptions={historyEventPlayerOptions}
        onCancel={() => setHistoryEventOpen(false)}
        onSubmit={async (payload: CreateMatchStakesHistoryEventRequest) => {
          if (!guardWritePermission(canWriteActions)) {
            return;
          }

          setHistoryEventApiError(null);

          try {
            await createHistoryEventMutation.mutateAsync(payload);
            message.success("History event recorded.");
            setHistoryEventOpen(false);
          } catch (error) {
            setHistoryEventApiError(getErrorMessage(toAppError(error)));
          }
        }}
      />

      <Modal
        title="Reset advance event"
        open={resetAdvanceOpen && canWriteActions}
        okText="Reset event"
        okButtonProps={{
          danger: true,
          loading: resetHistoryEventMutation.isPending,
          disabled: !canConfirmResetAdvance
        }}
        onOk={async () => {
          if (!guardWritePermission(canWriteActions)) {
            return;
          }

          if (!resetAdvanceTarget || !canConfirmResetAdvance) {
            return;
          }

          setResetAdvanceApiError(null);

          try {
            await resetHistoryEventMutation.mutateAsync({
              eventId: resetAdvanceTarget.id,
              periodId: resetAdvanceTarget.periodId ?? null,
              payload: {
                reason: resetAdvanceReason.trim() || null
              }
            });
            message.success("Advance event reset.");
            setResetAdvanceOpen(false);
            setResetAdvanceReason("");
            setResetAdvanceTarget(null);
          } catch (error) {
            setResetAdvanceApiError(getErrorMessage(toAppError(error)));
          }
        }}
        onCancel={() => {
          setResetAdvanceOpen(false);
          setResetAdvanceApiError(null);
          setResetAdvanceReason("");
          setResetAdvanceTarget(null);
        }}
      >
        <div className="space-y-3">
          <FormApiError message={resetAdvanceApiError} />

          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {`This will mark the advance event as RESET and exclude it from debt impact.`}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <div>{`Advancer: ${resetAdvanceTarget?.playerName ?? "-"}`}</div>
            <div>{`Amount: ${typeof resetAdvanceTarget?.amountVnd === "number" ? formatVnd(Math.abs(resetAdvanceTarget.amountVnd)) : "-"}`}</div>
            <div>{`Posted at: ${resetAdvanceTarget ? formatDateTime(resetAdvanceTarget.postedAt) : "-"}`}</div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Reason (optional)</label>
            <Input.TextArea
              value={resetAdvanceReason}
              rows={3}
              maxLength={250}
              onChange={(event) => setResetAdvanceReason(event.target.value)}
            />
          </div>
        </div>
      </Modal>

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
                  value={selectedPeriodId ?? ALL_PERIODS_FILTER_VALUE}
                  options={periodSelectOptions}
                  onChange={(value) => {
                    setSelectedPeriodId(value === ALL_PERIODS_FILTER_VALUE ? undefined : value);
                    setPeriodFilterOpen(false);
                  }}
                  placeholder="Select debt period"
                  className="w-full"
                />
              </div>
              <div className="flex justify-end">
                <Button size="small" onClick={resetFiltersToDefault} disabled={!hasNonDefaultFilters}>
                  Reset to default
                </Button>
              </div>
              {selectedFilterPeriod ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-600">
                  <div>{`Period #${selectedFilterPeriod.periodNo}`}</div>
                  <div>{`Opened: ${formatDateTime(selectedFilterPeriod.openedAt)}`}</div>
                  <div>{`Matches: ${selectedFilterSummary?.totalMatches ?? "-"}`}</div>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-600">
                  Showing full match history grouped by debt period.
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      <Modal
        title={activePeriod ? `Record settlement - Period #${activePeriod.periodNo}` : "Record settlement"}
        open={settlementOpen && canWriteActions}
        okText="Record settlement"
        okButtonProps={{ loading: createSettlementMutation.isPending, disabled: !canSubmitSettlement }}
        onOk={async () => {
          if (!guardWritePermission(canWriteActions)) {
            return;
          }
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
        open={createPeriodOpen && canWriteActions}
        okText="Create period"
        okButtonProps={{ loading: createPeriodMutation.isPending }}
        onOk={async () => {
          if (!guardWritePermission(canWriteActions)) {
            return;
          }
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
        title={closePeriod ? `Close Period #${closePeriod.periodNo}` : "Close period"}
        open={closePeriodOpen && canWriteActions}
        okText="Close period"
        okButtonProps={{
          loading: closePeriodMutation.isPending,
          disabled: !closePeriodTargetId || !canConfirmClosePeriod
        }}
        onOk={async () => {
          if (!guardWritePermission(canWriteActions)) {
            return;
          }
          if (!closePeriodTargetId || !canConfirmClosePeriod) {
            return;
          }

          setClosePeriodApiError(null);

          try {
            await closePeriodMutation.mutateAsync({
              periodId: closePeriodTargetId,
              payload: {
                note: closePeriodNote.trim() || null,
                closingBalances
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
            <div>{`Outstanding to receive: ${formatVnd(closeSummary?.totalOutstandingReceiveVnd ?? 0)}`}</div>
            <div>{`Outstanding to pay: ${formatVnd(closeSummary?.totalOutstandingPayVnd ?? 0)}`}</div>
            <div>{`Total matches: ${closeSummary?.totalMatches ?? 0}`}</div>
          </div>

          {!canCloseWithMatch ? <Alert type="warning" showIcon message="Cannot close period with no matches. Need at least 1 match." /> : null}
          {hasOutstanding ? <Alert type="info" showIcon message="Non-zero balances will be sent as closingBalances for rollover." /> : null}
          {!hasOutstanding ? <Alert type="success" showIcon message="All balances are zero. This period closes with a clean rollover." /> : null}

          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900">Init cua period moi (closingBalances)</div>
              <Button
                size="small"
                onClick={() => {
                  setCloseBalanceDraft(
                    Object.fromEntries(closeBalancePlayers.map((player) => [player.playerId, 0]))
                  );
                }}
              >
                Set all = 0
              </Button>
            </div>
            {closeBalanceRows.length === 0 ? (
              <div className="mt-2 text-sm text-slate-500">No players in this period.</div>
            ) : (
              <div className="mt-2 space-y-2">
                {closeBalanceRows.map((player) => (
                  <div key={player.playerId} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-600">{player.playerName}</span>
                    <InputNumber
                      value={player.draftNetVnd}
                      precision={0}
                      step={10000}
                      className="w-[170px]"
                      onChange={(value) =>
                        setCloseBalanceDraft((previous) => ({
                          ...previous,
                          [player.playerId]: typeof value === "number" ? value : 0
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

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
