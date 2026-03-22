import { Alert, Button, Card, message } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MatchStakesRuleCreateFlow } from "@/features/rules/MatchStakesRuleCreateFlow";
import { RuleSetMetaForm } from "@/features/rules/RuleSetMetaForm";
import { useCreateRuleSet } from "@/features/rules/hooks";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/layout/SectionCard";
import type { RuleSetMetaValues } from "@/features/rules/schemas";
import { moduleLabels } from "@/lib/labels";

const groupFundSubtitle =
  "Group Fund builder mode is not enabled yet, so this flow creates rule-set metadata first and versions can be added later.";

export const RuleSetCreatePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const module = searchParams.get("module");
  const createMutation = useCreateRuleSet();

  const onSubmitGroupFund = async (values: RuleSetMetaValues) => {
    const created = await createMutation.mutateAsync({
      module: "GROUP_FUND",
      code: values.code,
      name: values.name,
      description: values.description || null,
      status: values.status,
      isDefault: values.isDefault
    });

    message.success("Group Fund rule set metadata created");
    navigate(`/rules/${created.id}`);
  };

  if (module === "MATCH_STAKES") {
    return (
      <PageContainer>
        <PageHeader
          title="Create Match Stakes Rule"
          subtitle="Configure a payout rule for 3 or 4 participants, including winners, losses, and special penalties."
        />

        <MatchStakesRuleCreateFlow />
      </PageContainer>
    );
  }

  if (module === "GROUP_FUND") {
    return (
      <PageContainer>
        <PageHeader
          title={`Create ${moduleLabels.GROUP_FUND} Rule`}
          subtitle={groupFundSubtitle}
        />

        <SectionCard>
          <Alert showIcon type="info" message="Metadata-first flow" description={groupFundSubtitle} />
        </SectionCard>

        <RuleSetMetaForm
          initialModule="GROUP_FUND"
          lockModule
          submitLabel="Create rule set"
          submitting={createMutation.isPending}
          onSubmit={onSubmitGroupFund}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Create Rule"
        subtitle="Choose the module first. Match Stakes opens a complete business rule builder flow."
      />

      <SectionCard title="Select Module" description="Pick the business flow you want to start">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="!rounded-xl !border-blue-200">
            <div className="space-y-3">
              <div className="text-lg font-semibold">Match Stakes</div>
              <div className="text-sm text-slate-600">
                One guided creation flow with payouts, losses, penalties, review, and submit.
              </div>
              <Button type="primary" onClick={() => navigate("/rules/new?module=MATCH_STAKES")}>
                Create Match Stakes Rule
              </Button>
            </div>
          </Card>

          <Card className="!rounded-xl">
            <div className="space-y-3">
              <div className="text-lg font-semibold">Group Fund</div>
              <div className="text-sm text-slate-600">
                Create metadata first. Builder flow is currently focused on Match Stakes.
              </div>
              <Button onClick={() => navigate("/rules/new?module=GROUP_FUND")}>Create Group Fund Rule</Button>
            </div>
          </Card>
        </div>
      </SectionCard>
    </PageContainer>
  );
};
