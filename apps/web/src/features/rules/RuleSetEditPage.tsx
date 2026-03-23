import { message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { PageContainer } from "@/components/layout/PageContainer";
import { RuleSetMetaForm } from "@/features/rules/RuleSetMetaForm";
import { RulesBreadcrumb } from "@/features/rules/components";
import { useRuleSetDetail, useUpdateRuleSet } from "@/features/rules/hooks";
import { ErrorState } from "@/components/states/ErrorState";
import { PageLoading } from "@/components/states/PageLoading";
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

  const handleCancel = () => {
    navigate(`/rules/${ruleSetId}`);
  };

  return (
    <PageContainer>
      <RulesBreadcrumb
        items={[
          { label: "Rules", to: "/rules" },
          { label: detailQuery.data.name, to: `/rules/${ruleSetId}` },
          { label: "Edit" }
        ]}
      />

      <PageHeader
        title="Edit Rule Set"
        subtitle="Update business metadata for this rule set"
      />

      <div className="max-w-4xl">
        <RuleSetMetaForm
          initial={detailQuery.data}
          submitLabel="Save changes"
          submitting={updateMutation.isPending}
          onCancel={handleCancel}
          onSubmit={onSubmit}
        />
      </div>
    </PageContainer>
  );
};
