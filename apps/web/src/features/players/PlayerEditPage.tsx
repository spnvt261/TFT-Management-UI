import { useNavigate, useParams } from "react-router-dom";
import { Button, message } from "antd";
import { PlayerForm } from "@/features/players/PlayerForm";
import { usePlayerDetail, useUpdatePlayer } from "@/features/players/hooks";
import { PageLoading } from "@/components/states/PageLoading";
import { ErrorState } from "@/components/states/ErrorState";
import type { PlayerFormValues } from "@/features/players/schemas";
import { AppBreadcrumb } from "@/components/layout/AppBreadcrumb";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export const PlayerEditPage = () => {
  const navigate = useNavigate();
  const { playerId } = useParams();
  const detailQuery = usePlayerDetail(playerId);
  const updateMutation = useUpdatePlayer(playerId ?? "");

  if (!playerId) {
    return <ErrorState title="Missing player id" />;
  }

  if (detailQuery.isLoading) {
    return <PageLoading label="Loading player..." />;
  }

  if (detailQuery.isError || !detailQuery.data) {
    return <ErrorState onRetry={() => void detailQuery.refetch()} />;
  }

  const onSubmit = async (values: PlayerFormValues) => {
    await updateMutation.mutateAsync({
      displayName: values.displayName,
      slug: values.slug || null,
      avatarUrl: values.avatarUrl || null,
      isActive: values.isActive
    });
    message.success("Player updated");
    navigate("/players");
  };

  return (
    <PageContainer>
      <AppBreadcrumb
        items={[
          { label: "Players", to: "/players" },
          { label: detailQuery.data.displayName },
          { label: "Edit" }
        ]}
      />

      <PageHeader
        title="Edit Player"
        subtitle={`Update profile for ${detailQuery.data.displayName}.`}
        actions={<Button onClick={() => navigate("/players")}>Back to players</Button>}
      />

      <PlayerForm initial={detailQuery.data} submitLabel="Save Changes" submitting={updateMutation.isPending} onSubmit={onSubmit} />
    </PageContainer>
  );
};
