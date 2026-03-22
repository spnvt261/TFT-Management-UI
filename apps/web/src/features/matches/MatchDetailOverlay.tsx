import { useState } from "react";
import { Button, Drawer, Input, Modal } from "antd";
import { PageLoading } from "@/components/states/PageLoading";
import { ErrorState } from "@/components/states/ErrorState";
import { useMatchDetail, useVoidMatch } from "@/features/matches/hooks";
import { MatchDetailView } from "@/features/matches/MatchDetailView";
import { useIsMobile } from "@/hooks/useIsMobile";
import { toAppError } from "@/api/httpClient";
import { getErrorMessage } from "@/lib/error-messages";

interface MatchDetailOverlayProps {
  matchId?: string;
  open: boolean;
  onClose: () => void;
}

export const MatchDetailOverlay = ({ matchId, open, onClose }: MatchDetailOverlayProps) => {
  const isMobile = useIsMobile();
  const [voidReason, setVoidReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const matchQuery = useMatchDetail(matchId);
  const voidMutation = useVoidMatch(matchId || "");

  const content = matchQuery.isLoading ? (
    <PageLoading label="Loading match detail..." />
  ) : matchQuery.isError ? (
    <ErrorState description={getErrorMessage(toAppError(matchQuery.error))} onRetry={() => void matchQuery.refetch()} />
  ) : matchQuery.data ? (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          danger
          disabled={matchQuery.data.status === "VOIDED"}
          onClick={() => setConfirmOpen(true)}
          aria-label="Void match"
        >
          Void match
        </Button>
      </div>
      <MatchDetailView match={matchQuery.data} />
    </div>
  ) : null;

  const modalContent = (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Voiding keeps accounting history and creates reversal entries.</p>
      <Input.TextArea
        value={voidReason}
        onChange={(event) => setVoidReason(event.target.value)}
        placeholder="Reason (min 3 chars)"
        rows={3}
      />
    </div>
  );

  return (
    <>
      {isMobile ? (
        <Drawer
          title="Match detail"
          placement="right"
          width="100%"
          open={open}
          onClose={onClose}
          destroyOnClose
          extra={<Button onClick={onClose}>Close</Button>}
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
          destroyOnClose
          extra={<Button onClick={onClose}>Close</Button>}
        >
          {content}
        </Drawer>
      )}

      <Modal
        title="Confirm void match"
        open={confirmOpen}
        okButtonProps={{ danger: true, loading: voidMutation.isPending, disabled: voidReason.trim().length < 3 }}
        okText="Void match"
        onOk={async () => {
          if (!matchId) {
            return;
          }
          await voidMutation.mutateAsync(voidReason.trim());
          setConfirmOpen(false);
          onClose();
          setVoidReason("");
        }}
        onCancel={() => setConfirmOpen(false)}
      >
        {modalContent}
      </Modal>
    </>
  );
};
