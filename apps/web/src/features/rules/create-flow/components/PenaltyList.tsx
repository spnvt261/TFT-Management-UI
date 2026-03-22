import { Button, Card, Select, Tag } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Controller, type Control, type FieldArrayWithId, type FieldErrors } from "react-hook-form";
import { SectionCard } from "@/components/layout/SectionCard";
import { CurrencyAmountInput } from "@/features/rules/create-flow/components/CurrencyAmountInput";
import { RankPlacementSelect } from "@/features/rules/create-flow/components/RankPlacementSelect";
import type { MatchStakesRuleCreateFlowValues } from "@/features/rules/schemas";

const destinationOptions = [
  { label: "Best participant", value: "BEST_PARTICIPANT" },
  { label: "Fund account", value: "FUND_ACCOUNT" }
] as const;

interface PenaltyListProps {
  control: Control<MatchStakesRuleCreateFlowValues>;
  fields: FieldArrayWithId<MatchStakesRuleCreateFlowValues, "penalties", "id">[];
  errors: FieldErrors<MatchStakesRuleCreateFlowValues>;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

export const PenaltyList = ({ control, fields, errors, onAdd, onRemove }: PenaltyListProps) => {
  const listError =
    errors.penalties && !Array.isArray(errors.penalties) && "message" in errors.penalties
      ? String(errors.penalties.message ?? "")
      : "";

  return (
    <SectionCard
      title="Special Penalties"
      description="Optional extra penalty by absolute placement"
      actions={
        <Button type="dashed" icon={<PlusOutlined />} onClick={onAdd}>
          Add penalty
        </Button>
      }
    >
      {fields.length === 0 ? (
        <div className="text-sm text-slate-500">No penalties added.</div>
      ) : (
        <div className="space-y-4">
          {fields.map((field, index) => (
            <Card key={field.id} size="small" className="!bg-slate-50">
              <div className="mb-3 flex items-center justify-between">
                <Tag>{`Penalty #${index + 1}`}</Tag>
                <Button danger icon={<DeleteOutlined />} onClick={() => onRemove(index)} />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium">Absolute placement</label>
                  <Controller
                    control={control}
                    name={`penalties.${index}.absolutePlacement`}
                    render={({ field: formField }) => (
                      <RankPlacementSelect
                        value={formField.value}
                        onChange={formField.onChange}
                        min={1}
                        max={8}
                        optionLabel={(value) => `Top ${value}`}
                      />
                    )}
                  />
                  {errors.penalties?.[index]?.absolutePlacement?.message ? (
                    <div className="mt-1 text-xs text-red-600">{String(errors.penalties[index]?.absolutePlacement?.message)}</div>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium">Amount</label>
                  <Controller
                    control={control}
                    name={`penalties.${index}.amountVnd`}
                    render={({ field: formField }) => (
                      <CurrencyAmountInput value={formField.value} onChange={formField.onChange} min={0} />
                    )}
                  />
                  {errors.penalties?.[index]?.amountVnd?.message ? (
                    <div className="mt-1 text-xs text-red-600">{String(errors.penalties[index]?.amountVnd?.message)}</div>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium">Destination</label>
                  <Controller
                    control={control}
                    name={`penalties.${index}.destinationSelectorType`}
                    render={({ field: formField }) => (
                      <Select
                        value={formField.value}
                        onChange={formField.onChange}
                        options={[...destinationOptions]}
                        className="w-full"
                        popupMatchSelectWidth={false}
                      />
                    )}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {listError ? <div className="mt-3 text-xs text-red-600">{listError}</div> : null}
    </SectionCard>
  );
};
