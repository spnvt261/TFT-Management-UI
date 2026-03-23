import { useNavigate } from "react-router-dom";
import { Button, message } from "antd";
import { PlayerForm } from "@/features/players/PlayerForm";
import { useCreatePlayer } from "@/features/players/hooks";
import type { PlayerFormValues } from "@/features/players/schemas";
import { AppBreadcrumb } from "@/components/layout/AppBreadcrumb";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export const PlayerCreatePage = () => {
  const navigate = useNavigate();
  const createMutation = useCreatePlayer();

  const onSubmit = async (values: PlayerFormValues) => {
    await createMutation.mutateAsync({
      displayName: values.displayName,
      slug: values.slug || null,
      avatarUrl: values.avatarUrl || null,
      isActive: values.isActive
    });
    message.success("Player created");
    navigate("/players");
  };

  return (
    <PageContainer>
      <AppBreadcrumb
        items={[
          { label: "Players", to: "/players" },
          { label: "Create Player" }
        ]}
      />

      <PageHeader
        title="Create Player"
        subtitle="Add a new player profile for match entry and rule resolution."
        actions={<Button onClick={() => navigate("/players")}>Back to players</Button>}
      />

      <PlayerForm submitLabel="Create Player" submitting={createMutation.isPending} onSubmit={onSubmit} />
    </PageContainer>
  );
};
