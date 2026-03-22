import { message } from "antd";
import { useNavigate } from "react-router-dom";
import { RuleSetMetaForm } from "@/features/rules/RuleSetMetaForm";
import { useCreateRuleSet } from "@/features/rules/hooks";
import type { RuleSetMetaValues } from "@/features/rules/schemas";

export const RuleSetCreatePage = () => {
  const navigate = useNavigate();
  const createMutation = useCreateRuleSet();

  const onSubmit = async (values: RuleSetMetaValues) => {
    const created = await createMutation.mutateAsync({
      module: values.module,
      code: values.code,
      name: values.name,
      description: values.description || null,
      status: values.status,
      isDefault: values.isDefault
    });

    message.success("Rule set created");
    navigate(`/rules/${created.id}`);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Create Rule Set</h2>
      <RuleSetMetaForm submitLabel="Create rule set" submitting={createMutation.isPending} onSubmit={onSubmit} />
    </div>
  );
};
