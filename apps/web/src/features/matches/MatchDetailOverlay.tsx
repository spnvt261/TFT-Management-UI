import { CloseOutlined } from "@ant-design/icons";
import { Button, Drawer } from "antd";
import { PageLoading } from "@/components/states/PageLoading";
import { ErrorState } from "@/components/states/ErrorState";
import { useMatchDetail } from "@/features/matches/hooks";
import { MatchDetailView } from "@/features/matches/MatchDetailView";
import { useIsMobile } from "@/hooks/useIsMobile";
import { toAppError } from "@/api/httpClient";
import { getErrorMessage } from "@/lib/error-messages";

export interface MatchStakesDetailContext {
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

interface MatchDetailOverlayProps {
  matchId?: string;
  open: boolean;
  onClose: () => void;
  matchStakesContext?: MatchStakesDetailContext;
}

export const MatchDetailOverlay = ({ matchId, open, onClose, matchStakesContext }: MatchDetailOverlayProps) => {
  const isMobile = useIsMobile();

  const matchQuery = useMatchDetail(matchId);

  const content = matchQuery.isLoading ? (
    <PageLoading label="Loading match detail..." />
  ) : matchQuery.isError ? (
    <ErrorState description={getErrorMessage(toAppError(matchQuery.error))} onRetry={() => void matchQuery.refetch()} />
  ) : matchQuery.data ? (
    <MatchDetailView
      match={matchQuery.data}
      matchNo={matchStakesContext?.matchNo ?? null}
      periodNo={matchStakesContext?.periodNo ?? matchQuery.data.debtPeriodNo ?? null}
      participantLedgerRows={matchStakesContext?.participantLedgerRows ?? []}
    />
  ) : null;

  return (
    <>
      {isMobile ? (
        <Drawer
          title="Match detail"
          placement="right"
          width="100%"
          open={open}
          onClose={onClose}
          closeIcon={null}
          destroyOnHidden
          extra={<Button icon={<CloseOutlined />} onClick={onClose}>Close</Button>}
        >
          {content}
        </Drawer>
      ) : (
        <Drawer
          title="Match detail"
          placement="right"
          width={680}
          open={open}
          onClose={onClose}
          closeIcon={null}
          destroyOnHidden
          extra={<Button icon={<CloseOutlined />} onClick={onClose}>Close</Button>}
        >
          {content}
        </Drawer>
      )}
    </>
  );
};
