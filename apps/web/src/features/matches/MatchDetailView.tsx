import { useMemo, useState } from "react";
import { DownOutlined, UpOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Descriptions, Tag, Typography } from "antd";
import dayjs from "dayjs";
import { useGroupFundSummary } from "@/features/group-fund/hooks";
import { useRuleSetVersionDetail } from "@/features/rules/hooks";
import type { MatchDetailDto } from "@/types/api";
import { formatDateTime, formatVnd } from "@/lib/format";
import { moduleLabels } from "@/lib/labels";

type ParticipantViewMode = "simple" | "detail";

interface MatchDetailViewProps {
  match: MatchDetailDto;
  matchNo?: number | null;
  periodNo?: number | null;
  participantLedgerRows?: Array<{
    playerId: string;
    playerName: string;
    placement: number | null;
    matchNetVnd: number;
    debtBeforeVnd: number;
    debtAfterVnd: number;
  }>;
}

const formatSignedVnd = (value: number) => (value > 0 ? `+${formatVnd(value)}` : formatVnd(value));

const getDebtToneClassName = (value: number) => {
  if (value > 0) {
    return "text-emerald-700";
  }

  if (value < 0) {
    return "text-rose-700";
  }

  return "text-slate-700";
};

export const MatchDetailView = ({ match, matchNo, periodNo, participantLedgerRows = [] }: MatchDetailViewProps) => {
  const [participantViewMode, setParticipantViewMode] = useState<ParticipantViewMode>("simple");
  const [ruleDetailsOpen, setRuleDetailsOpen] = useState(false);
  const isGroupFundMatch = match.module === "GROUP_FUND";
  const ledgerAnchorIso = match.settlement?.postedToLedgerAt ?? match.playedAt;
  const beforeAnchorIso = dayjs(ledgerAnchorIso).subtract(1, "second").toISOString();

  const ruleVersionDetailQuery = useRuleSetVersionDetail(match.ruleSet.id, match.ruleSetVersion?.id);
  const groupFundSummaryBeforeQuery = useGroupFundSummary({ to: beforeAnchorIso }, isGroupFundMatch);
  const groupFundSummaryAfterQuery = useGroupFundSummary({ to: ledgerAnchorIso }, isGroupFundMatch);

  const participantLedgerByPlayer = useMemo(
    () => new Map(participantLedgerRows.map((row) => [row.playerId, row])),
    [participantLedgerRows]
  );

  const participants = useMemo(
    () =>
      match.participants
        .slice()
        .sort((left, right) => left.tftPlacement - right.tftPlacement)
        .map((participant) => {
          const ledger = participantLedgerByPlayer.get(participant.playerId);
          const matchNetVnd = ledger?.matchNetVnd ?? participant.settlementNetVnd;
          const debtAfterVnd = ledger?.debtAfterVnd ?? matchNetVnd;
          const debtBeforeVnd = ledger?.debtBeforeVnd ?? debtAfterVnd - matchNetVnd;

          return {
            playerId: participant.playerId,
            playerName: participant.playerName,
            placement: ledger?.placement ?? participant.tftPlacement,
            matchNetVnd,
            debtBeforeVnd,
            debtAfterVnd
          };
        }),
    [match.participants, participantLedgerByPlayer]
  );

  const matchFundInVnd = match.settlement?.totalFundInVnd ?? 0;
  const matchFundOutVnd = match.settlement?.totalFundOutVnd ?? 0;
  const matchFundDeltaVnd = matchFundInVnd - matchFundOutVnd;

  const beforeBalance = groupFundSummaryBeforeQuery.data?.fundBalanceVnd;
  const afterBalance = groupFundSummaryAfterQuery.data?.fundBalanceVnd;

  // Prefer the "before" balance as source of truth, then apply this match delta.
  // This avoids including other ledger entries that may share the exact same posted time.
  const fundBeforeMatchVnd =
    typeof beforeBalance === "number"
      ? beforeBalance
      : typeof afterBalance === "number"
        ? afterBalance - matchFundDeltaVnd
        : undefined;
  const fundAfterMatchVnd =
    typeof fundBeforeMatchVnd === "number"
      ? fundBeforeMatchVnd + matchFundDeltaVnd
      : typeof afterBalance === "number"
        ? afterBalance
        : undefined;

  const hasFundSnapshot = typeof fundBeforeMatchVnd === "number" && typeof fundAfterMatchVnd === "number";
  const isFundSnapshotLoading =
    (groupFundSummaryBeforeQuery.isLoading || groupFundSummaryAfterQuery.isLoading) && !hasFundSnapshot;
  const isFundSnapshotUnavailable = !hasFundSnapshot && groupFundSummaryBeforeQuery.isError && groupFundSummaryAfterQuery.isError;

  return (
    <div className="space-y-4">
      {match.status === "VOIDED" ? (
        <Alert
          type="warning"
          showIcon
          message="This match was voided"
          description={match.voidReason ? `Reason: ${match.voidReason}` : undefined}
        />
      ) : null}

      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {typeof matchNo === "number" ? <Tag color="blue">{`Match #${matchNo}`}</Tag> : null}
          {typeof periodNo === "number" ? <Tag color="gold">{`Period #${periodNo}`}</Tag> : null}
          <Tag>{moduleLabels[match.module]}</Tag>
        </div>

        <Descriptions size="small" column={1}>
          <Descriptions.Item label="Played at">{formatDateTime(match.playedAt)}</Descriptions.Item>
          <Descriptions.Item label="Note">{match.note || "-"}</Descriptions.Item>
        </Descriptions>
      </Card>

      {isGroupFundMatch ? (
        <Card title="Group Fund Snapshot">
          {isFundSnapshotLoading ? (
            <Typography.Text type="secondary">Loading fund snapshot...</Typography.Text>
          ) : isFundSnapshotUnavailable ? (
            <Typography.Text type="secondary">Cannot load fund snapshot at match time.</Typography.Text>
          ) : (
            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <div className="text-xs text-slate-500">Fund before match</div>
                <div className="mt-1 font-semibold text-slate-900">{typeof fundBeforeMatchVnd === "number" ? formatVnd(fundBeforeMatchVnd) : "-"}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <div className="text-xs text-slate-500">Fund change this match</div>
                <div className={`mt-1 font-semibold ${matchFundDeltaVnd >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatSignedVnd(matchFundDeltaVnd)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <div className="text-xs text-slate-500">Fund after match</div>
                <div className="mt-1 font-semibold text-slate-900">{typeof fundAfterMatchVnd === "number" ? formatVnd(fundAfterMatchVnd) : "-"}</div>
              </div>
            </div>
          )}
        </Card>
      ) : null}

      <Card
        title="Rule Details"
        extra={
          <Button
            type="text"
            size="small"
            icon={ruleDetailsOpen ? <UpOutlined /> : <DownOutlined />}
            onClick={() => setRuleDetailsOpen((previous) => !previous)}
          >
            {ruleDetailsOpen ? "Hide" : "Detail"}
          </Button>
        }
      >
        <div className="space-y-2">
          <div className="rounded-lg border border-slate-200 bg-white p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{match.ruleSet.name}</span>
              <Tag>{match.ruleSetVersion ? `v${match.ruleSetVersion.versionNo}` : "No version"}</Tag>
            </div>
            <div className="mt-1 text-xs text-slate-600">
              {!match.ruleSetVersion
                ? "No rule version found for this match."
                : ruleVersionDetailQuery.isLoading
                  ? "Loading rule description..."
                  : ruleVersionDetailQuery.isError || !ruleVersionDetailQuery.data
                    ? "Cannot load rule description."
                    : ruleVersionDetailQuery.data.description || "No rule description."}
            </div>
          </div>

          {!ruleDetailsOpen ? (
            <Typography.Text type="secondary">Click Detail to show full rule calculation and penalties.</Typography.Text>
          ) : !match.ruleSetVersion ? (
            <Typography.Text type="secondary">No rule version found for this match.</Typography.Text>
          ) : ruleVersionDetailQuery.isLoading ? (
            <Typography.Text type="secondary">Loading rule details...</Typography.Text>
          ) : ruleVersionDetailQuery.isError || !ruleVersionDetailQuery.data ? (
            <Typography.Text type="secondary">Cannot load rule details for this version.</Typography.Text>
          ) : ruleVersionDetailQuery.data.rules.length === 0 ? (
            <Typography.Text type="secondary">No rules found in this version.</Typography.Text>
          ) : (
            <>
              {ruleVersionDetailQuery.data.rules
                .slice()
                .sort((left, right) => left.priority - right.priority)
                .map((rule) => {
                  const actionSummary = rule.actions
                    .slice()
                    .sort((left, right) => left.sortOrder - right.sortOrder)
                    .map((action) => `${action.actionType} ${formatVnd(action.amountVnd)}`)
                    .join(" | ");
                  const isPenaltyRule = rule.ruleKind.toLowerCase().includes("penalty") || rule.name.toLowerCase().includes("penalty");

                  return (
                    <div key={rule.id ?? `${rule.code}-${rule.priority}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{rule.name}</span>
                        <Tag>{rule.code}</Tag>
                        <Tag>{rule.ruleKind}</Tag>
                        {isPenaltyRule ? <Tag color="red">Penalty</Tag> : null}
                      </div>
                      {rule.description ? <div className="mt-1 text-xs text-slate-500">{rule.description}</div> : null}
                      <div className="mt-1 text-xs text-slate-600">{`Actions: ${actionSummary || "-"}`}</div>
                      <div className="text-xs text-slate-500">{`Conditions: ${rule.conditions.length}`}</div>
                    </div>
                  );
                })}
            </>
          )}
        </div>
      </Card>

      <Card
        title="Participants"
        extra={
          <div className="flex items-center gap-1">
            <Button size="small" type={participantViewMode === "simple" ? "primary" : "default"} onClick={() => setParticipantViewMode("simple")}>
              Simple
            </Button>
            <Button size="small" type={participantViewMode === "detail" ? "primary" : "default"} onClick={() => setParticipantViewMode("detail")}>
              Detail
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          {participants.map((participant) => (
            <div key={participant.playerId} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <Typography.Text strong>{participant.playerName}</Typography.Text>
                  <div className="text-xs text-slate-500">{`Top ${participant.placement}`}</div>
                </div>
                <div className={`text-lg font-semibold ${getDebtToneClassName(participant.debtAfterVnd)}`}>{formatSignedVnd(participant.debtAfterVnd)}</div>
              </div>

              {participantViewMode === "simple" ? (
                <div className={`mt-1 text-xs ${getDebtToneClassName(participant.matchNetVnd)}`}>{`This match: ${formatSignedVnd(participant.matchNetVnd)}`}</div>
              ) : (
                <div className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-3">
                  <div>{`Match net: ${formatSignedVnd(participant.matchNetVnd)}`}</div>
                  <div>{`Debt before: ${formatSignedVnd(participant.debtBeforeVnd)}`}</div>
                  <div>{`Debt after: ${formatSignedVnd(participant.debtAfterVnd)}`}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2">
          <div>Created: {formatDateTime(match.createdAt)}</div>
          <div>Updated: {formatDateTime(match.updatedAt)}</div>
        </div>
      </Card>
    </div>
  );
};
