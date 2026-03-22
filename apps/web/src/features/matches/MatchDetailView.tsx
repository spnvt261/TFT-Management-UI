import { Alert, Card, Descriptions, Divider, List, Tag, Typography } from "antd";
import type { MatchDetailDto } from "@/types/api";
import { formatDateTime, formatVnd } from "@/lib/format";
import { getEnumLabel, matchStatusLabels, moduleLabels } from "@/lib/labels";

interface MatchDetailViewProps {
  match: MatchDetailDto;
}

export const MatchDetailView = ({ match }: MatchDetailViewProps) => {
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
        <Descriptions size="small" column={1}>
          <Descriptions.Item label="Module">{moduleLabels[match.module]}</Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag>{getEnumLabel(matchStatusLabels, match.status)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Played at">{formatDateTime(match.playedAt)}</Descriptions.Item>
          <Descriptions.Item label="Rule set">{match.ruleSet.name}</Descriptions.Item>
          <Descriptions.Item label="Rule version">
            {match.ruleSetVersion ? `v${match.ruleSetVersion.versionNo}` : "-"}
          </Descriptions.Item>
          <Descriptions.Item label="Note">{match.note || "-"}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="Participants">
        <List
          itemLayout="horizontal"
          dataSource={match.participants.slice().sort((a, b) => a.tftPlacement - b.tftPlacement)}
          renderItem={(participant) => (
            <List.Item>
              <div className="flex w-full items-center justify-between">
                <div>
                  <Typography.Text strong>{participant.playerName}</Typography.Text>
                  <div className="text-xs text-slate-500">Placement #{participant.tftPlacement}</div>
                </div>
                <Typography.Text className={participant.settlementNetVnd >= 0 ? "text-green-700" : "text-red-700"}>
                  {formatVnd(participant.settlementNetVnd)}
                </Typography.Text>
              </div>
            </List.Item>
          )}
        />
      </Card>

      <Card title="Settlement">
        {match.settlement ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Transfer total</div>
                <div className="text-base font-semibold">{formatVnd(match.settlement.totalTransferVnd)}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Fund in</div>
                <div className="text-base font-semibold">{formatVnd(match.settlement.totalFundInVnd)}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Fund out</div>
                <div className="text-base font-semibold">{formatVnd(match.settlement.totalFundOutVnd)}</div>
              </div>
            </div>

            <Divider className="!my-2" />

            <List
              size="small"
              dataSource={match.settlement.lines}
              renderItem={(line) => (
                <List.Item>
                  <div className="w-full space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Typography.Text strong>#{line.lineNo}</Typography.Text>
                      <Typography.Text>{formatVnd(line.amountVnd)}</Typography.Text>
                    </div>
                    <div className="text-xs text-slate-500">
                      {line.sourcePlayerName || "Fund/System"} ? {line.destinationPlayerName || "Fund/System"}
                    </div>
                    <div className="text-xs text-slate-500">{line.reasonText}</div>
                  </div>
                </List.Item>
              )}
            />
          </div>
        ) : (
          <Typography.Text type="secondary">No settlement payload</Typography.Text>
        )}
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
