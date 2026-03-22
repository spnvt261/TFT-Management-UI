import { useState } from "react";
import { Button, Card, Input, Modal } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { useMatchDetail, useVoidMatch } from "@/features/matches/hooks";
import { MatchDetailView } from "@/features/matches/MatchDetailView";
import { PageLoading } from "@/components/states/PageLoading";
import { ErrorState } from "@/components/states/ErrorState";
import { getErrorMessage } from "@/lib/error-messages";
import { toAppError } from "@/api/httpClient";

export const MatchDetailPageStandalone = () => {
  const navigate = useNavigate();
  const { matchId } = useParams();
  const [voidReason, setVoidReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const detailQuery = useMatchDetail(matchId);
  const voidMutation = useVoidMatch(matchId ?? "");

  if (!matchId) {
    return <ErrorState title="Missing match id" />;
  }

  if (detailQuery.isLoading) {
    return <PageLoading label="Loading match detail..." />;
  }

  if (detailQuery.isError || !detailQuery.data) {
    return <ErrorState description={getErrorMessage(toAppError(detailQuery.error))} onRetry={() => void detailQuery.refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button onClick={() => navigate(-1)}>Back</Button>
        <Button danger disabled={detailQuery.data.status === "VOIDED"} onClick={() => setConfirmOpen(true)}>
          Void match
        </Button>
      </div>

      <MatchDetailView match={detailQuery.data} />

      <Modal
        title="Confirm void match"
        open={confirmOpen}
        okButtonProps={{ danger: true, loading: voidMutation.isPending, disabled: voidReason.trim().length < 3 }}
        okText="Void"
        onOk={async () => {
          await voidMutation.mutateAsync(voidReason.trim());
          setConfirmOpen(false);
          setVoidReason("");
        }}
        onCancel={() => setConfirmOpen(false)}
      >
        <Card>
          <p className="mb-2 text-sm text-slate-600">Void reason (minimum 3 chars)</p>
          <Input.TextArea value={voidReason} onChange={(event) => setVoidReason(event.target.value)} rows={3} />
        </Card>
      </Modal>
    </div>
  );
};
