import { message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { RuleSetMetaForm } from "@/features/rules/RuleSetMetaForm";
import { useRuleSetDetail, useUpdateRuleSet } from "@/features/rules/hooks";
import { PageLoading } from "@/components/states/PageLoading";
import { ErrorState } from "@/components/states/ErrorState";
import type { RuleSetMetaValues } from "@/features/rules/schemas";

export const RuleSetEditPage = () => {
  const navigate = useNavigate();
  const { ruleSetId } = useParams();

  const detailQuery = useRuleSetDetail(ruleSetId);
  const updateMutation = useUpdateRuleSet(ruleSetId ?? "");

  if (!ruleSetId) {
    return <ErrorState title="Missing rule set id" />;
  }

  if (detailQuery.isLoading) {
    return <PageLoading label="Loading rule set..." />;
  }

  if (detailQuery.isError || !detailQuery.data) {
    return <ErrorState onRetry={() => void detailQuery.refetch()} />;
  }

  const onSubmit = async (values: RuleSetMetaValues) => {
    await updateMutation.mutateAsync({
      name: values.name,
      description: values.description || null,
      status: values.status,
      isDefault: values.isDefault
    });

    message.success("Rule set updated");
    navigate(`/rules/${ruleSetId}`);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Edit Rule Set</h2>
      <RuleSetMetaForm initial={detailQuery.data} submitLabel="Save changes" submitting={updateMutation.isPending} onSubmit={onSubmit} />
    </div>
  );
};
