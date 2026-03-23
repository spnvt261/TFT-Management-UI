import { Tag } from "antd";
import { ruleStatusLabels } from "@/lib/labels";
import type { RuleStatus } from "@/types/api";

interface RuleSetStatusBadgesProps {
  status: RuleStatus;
  isDefault: boolean;
}

export const RuleSetStatusBadges = ({ status, isDefault }: RuleSetStatusBadgesProps) => (
  <div className="flex flex-wrap gap-2">
    {isDefault ? <Tag color="blue">Default</Tag> : null}
    <Tag color={status === "ACTIVE" ? "green" : "default"}>{ruleStatusLabels[status]}</Tag>
  </div>
);
