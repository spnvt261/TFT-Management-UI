import { message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { RuleSetMetaForm } from "@/features/rules/RuleSetMetaForm";
import { useRuleSetDetail, useUpdateRuleSet } from "@/features/rules/hooks";
import { ErrorState } from "@/components/states/ErrorState";
import { PageLoading } from "@/components/states/PageLoading";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
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

    message.success("Rule set metadata updated");
    navigate(`/rules/${ruleSetId}`);
  };

  return (
    <PageContainer>
      <PageHeader title="Edit Rule Set Metadata" subtitle={`${detailQuery.data.code} - ${detailQuery.data.name}`} />
      <RuleSetMetaForm initial={detailQuery.data} submitLabel="Save metadata" submitting={updateMutation.isPending} onSubmit={onSubmit} />
    </PageContainer>
  );
};
