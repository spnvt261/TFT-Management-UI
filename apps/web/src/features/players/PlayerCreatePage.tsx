import { useNavigate } from "react-router-dom";
import { message } from "antd";
import { PlayerForm } from "@/features/players/PlayerForm";
import { useCreatePlayer } from "@/features/players/hooks";
import type { PlayerFormValues } from "@/features/players/schemas";

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
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Create Player</h2>
      <PlayerForm submitLabel="Create Player" submitting={createMutation.isPending} onSubmit={onSubmit} />
    </div>
  );
};
