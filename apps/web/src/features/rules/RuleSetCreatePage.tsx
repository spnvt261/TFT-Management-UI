import { Button, Card } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MatchStakesRuleCreateFlow } from "@/features/rules/MatchStakesRuleCreateFlow";
import { GroupFundRuleCreateFlow } from "@/features/rules/GroupFundRuleCreateFlow";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/layout/SectionCard";
import { moduleLabels } from "@/lib/labels";

export const RuleSetCreatePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const module = searchParams.get("module");

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
          subtitle="Configure contribution obligations and fund movements by participant rank."
        />

        <GroupFundRuleCreateFlow />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Create Rule"
        subtitle="Choose a module to open the guided business-friendly rule creation flow."
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
                Configure contribution obligations and fund movement rules in one guided flow.
              </div>
              <Button onClick={() => navigate("/rules/new?module=GROUP_FUND")}>Create Group Fund Rule</Button>
            </div>
          </Card>
        </div>
      </SectionCard>
    </PageContainer>
  );
};
