import { useState } from "react";
import { Button, Card, Input, Modal } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { useMatchDetail, useVoidMatch } from "@/features/matches/hooks";
import { useAuth } from "@/features/auth/AuthContext";
import { guardWritePermission } from "@/features/auth/permissions";
import { MatchDetailView } from "@/features/matches/MatchDetailView";
import { AppBreadcrumb } from "@/components/layout/AppBreadcrumb";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageLoading } from "@/components/states/PageLoading";
import { ErrorState } from "@/components/states/ErrorState";
import { getErrorMessage } from "@/lib/error-messages";
import { toAppError } from "@/api/httpClient";

export const MatchDetailPageStandalone = () => {
  const navigate = useNavigate();
  const { canWrite } = useAuth();
  const canWriteActions = canWrite();
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
    <PageContainer>
      <AppBreadcrumb items={[{ label: "Match Detail" }]} />

      <PageHeader
        title="Match Detail"
        subtitle="Review participants, transfers, and match status."
        actions={
          <>
            <Button onClick={() => navigate(-1)}>Back</Button>
            {canWriteActions ? (
              <Button
                danger
                disabled={detailQuery.data.status === "VOIDED"}
                onClick={() => {
                  if (!guardWritePermission(canWriteActions)) {
                    return;
                  }

                  setConfirmOpen(true);
                }}
              >
                Void match
              </Button>
            ) : null}
          </>
        }
      />

      <MatchDetailView match={detailQuery.data} />

      <Modal
        title="Confirm void match"
        open={confirmOpen && canWriteActions}
        okButtonProps={{ danger: true, loading: voidMutation.isPending, disabled: voidReason.trim().length < 3 }}
        okText="Void"
        onOk={async () => {
          if (!guardWritePermission(canWriteActions)) {
            return;
          }
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
    </PageContainer>
  );
};
