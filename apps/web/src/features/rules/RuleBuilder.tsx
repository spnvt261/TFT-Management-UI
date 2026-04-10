import { Button, Card, Collapse, Input, InputNumber, Select, Switch } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { CurrencyAmountInput } from "@/features/rules/create-flow/components/CurrencyAmountInput";
import type { RawRuleSetVersionValues } from "@/features/rules/schemas";
import { ruleKindLabels } from "@/lib/labels";

const conditionKeys = [
  "participantCount",
  "module",
  "subjectRelativeRank",
  "subjectAbsolutePlacement",
  "matchContainsAbsolutePlacements"
] as const;

const operators = ["EQ", "NEQ", "GT", "GTE", "LT", "LTE", "IN", "NOT_IN", "BETWEEN", "CONTAINS"] as const;

const selectorTypes = [
  "SUBJECT_PLAYER",
  "PLAYER_BY_RELATIVE_RANK",
  "PLAYER_BY_ABSOLUTE_PLACEMENT",
  "MATCH_WINNER",
  "MATCH_RUNNER_UP",
  "BEST_PARTICIPANT",
  "WORST_PARTICIPANT",
  "FUND_ACCOUNT",
  "SYSTEM_ACCOUNT",
  "FIXED_PLAYER"
] as const;

const actionTypes = ["TRANSFER", "POST_TO_FUND", "CREATE_OBLIGATION", "REDUCE_OBLIGATION"] as const;

interface RuleItemEditorProps {
  index: number;
  onRemove: () => void;
}

const RuleItemEditor = ({ index, onRemove }: RuleItemEditorProps) => {
  const {
    control,
    formState: { errors }
  } = useFormContext<RawRuleSetVersionValues>();

  const conditionArray = useFieldArray({
    control,
    name: `rules.${index}.conditions`
  });

  const actionArray = useFieldArray({
    control,
    name: `rules.${index}.actions`
  });

  const ruleErrors = errors.rules?.[index];

  return (
    <Card size="small" className="!rounded-xl">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold">Rule #{index + 1}</div>
        <Button danger icon={<DeleteOutlined />} onClick={onRemove} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Controller control={control} name={`rules.${index}.code`} render={({ field }) => <Input {...field} placeholder="Rule code" />} />
        <Controller control={control} name={`rules.${index}.name`} render={({ field }) => <Input {...field} placeholder="Rule name" />} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Controller
          control={control}
          name={`rules.${index}.ruleKind`}
          render={({ field }) => (
            <Select
              value={field.value}
              onChange={field.onChange}
              options={Object.entries(ruleKindLabels).map(([value, label]) => ({ value, label }))}
              size="middle"
            />
          )}
        />
        <Controller
          control={control}
          name={`rules.${index}.priority`}
          render={({ field }) => (
            <InputNumber min={1} value={field.value} onChange={(value) => field.onChange(value ?? 100)} className="w-full" />
          )}
        />
        <Controller
          control={control}
          name={`rules.${index}.status`}
          render={({ field }) => (
            <Select
              value={field.value}
              onChange={field.onChange}
              options={[
                { label: "Active", value: "ACTIVE" },
                { label: "Inactive", value: "INACTIVE" }
              ]}
            />
          )}
        />
      </div>

      <div className="mt-3">
        <Controller control={control} name={`rules.${index}.description`} render={({ field }) => <Input.TextArea {...field} placeholder="Description" rows={2} />} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Controller control={control} name={`rules.${index}.metadataText`} render={({ field }) => <Input.TextArea {...field} placeholder="Metadata JSON (optional)" rows={2} />} />
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="mb-2 text-xs text-slate-500">Stop processing on match</div>
          <Controller control={control} name={`rules.${index}.stopProcessingOnMatch`} render={({ field }) => <Switch checked={field.value} onChange={field.onChange} />} />
        </div>
      </div>

      <Collapse
        className="mt-4"
        items={[
          {
            key: "conditions",
            label: `Conditions (${conditionArray.fields.length})`,
            children: (
              <div className="space-y-3">
                {conditionArray.fields.map((condition, conditionIndex) => (
                  <Card key={condition.id} size="small" className="!bg-slate-50">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold">Condition #{conditionIndex + 1}</span>
                      <Button danger size="small" onClick={() => conditionArray.remove(conditionIndex)}>
                        Remove
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Controller
                        control={control}
                        name={`rules.${index}.conditions.${conditionIndex}.conditionKey`}
                        render={({ field }) => (
                          <Select value={field.value} onChange={field.onChange} options={conditionKeys.map((value) => ({ value, label: value }))} />
                        )}
                      />
                      <Controller
                        control={control}
                        name={`rules.${index}.conditions.${conditionIndex}.operator`}
                        render={({ field }) => (
                          <Select value={field.value} onChange={field.onChange} options={operators.map((value) => ({ value, label: value }))} />
                        )}
                      />
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_90px]">
                      <Controller
                        control={control}
                        name={`rules.${index}.conditions.${conditionIndex}.valueJsonText`}
                        render={({ field }) => <Input.TextArea {...field} rows={2} placeholder="valueJson" />}
                      />
                      <Controller
                        control={control}
                        name={`rules.${index}.conditions.${conditionIndex}.sortOrder`}
                        render={({ field }) => (
                          <InputNumber min={1} value={field.value} onChange={(value) => field.onChange(value ?? 1)} className="w-full" />
                        )}
                      />
                    </div>
                  </Card>
                ))}

                <Button
                  icon={<PlusOutlined />}
                  onClick={() => conditionArray.append({ conditionKey: "participantCount", operator: "EQ", valueJsonText: "", sortOrder: 1 })}
                >
                  Add condition
                </Button>
              </div>
            )
          },
          {
            key: "actions",
            label: `Actions (${actionArray.fields.length})`,
            children: (
              <div className="space-y-3">
                {actionArray.fields.map((action, actionIndex) => (
                  <Card key={action.id} size="small" className="!bg-slate-50">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold">Action #{actionIndex + 1}</span>
                      <Button danger size="small" onClick={() => actionArray.remove(actionIndex)}>
                        Remove
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Controller
                        control={control}
                        name={`rules.${index}.actions.${actionIndex}.actionType`}
                        render={({ field }) => (
                          <Select value={field.value} onChange={field.onChange} options={actionTypes.map((value) => ({ value, label: value }))} />
                        )}
                      />
                      <Controller
                        control={control}
                        name={`rules.${index}.actions.${actionIndex}.amountVnd`}
                        render={({ field }) => (
                          <CurrencyAmountInput min={1} value={field.value} onChange={field.onChange} className="w-full" />
                        )}
                      />
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Controller
                        control={control}
                        name={`rules.${index}.actions.${actionIndex}.sourceSelectorType`}
                        render={({ field }) => (
                          <Select value={field.value} onChange={field.onChange} options={selectorTypes.map((value) => ({ value, label: value }))} />
                        )}
                      />
                      <Controller
                        control={control}
                        name={`rules.${index}.actions.${actionIndex}.destinationSelectorType`}
                        render={({ field }) => (
                          <Select value={field.value} onChange={field.onChange} options={selectorTypes.map((value) => ({ value, label: value }))} />
                        )}
                      />
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Controller
                        control={control}
                        name={`rules.${index}.actions.${actionIndex}.sourceSelectorJsonText`}
                        render={({ field }) => <Input.TextArea {...field} rows={2} placeholder="sourceSelectorJson" />}
                      />
                      <Controller
                        control={control}
                        name={`rules.${index}.actions.${actionIndex}.destinationSelectorJsonText`}
                        render={({ field }) => <Input.TextArea {...field} rows={2} placeholder="destinationSelectorJson" />}
                      />
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_90px]">
                      <Controller
                        control={control}
                        name={`rules.${index}.actions.${actionIndex}.descriptionTemplate`}
                        render={({ field }) => <Input {...field} placeholder="Description template" />}
                      />
                      <Controller
                        control={control}
                        name={`rules.${index}.actions.${actionIndex}.sortOrder`}
                        render={({ field }) => (
                          <InputNumber min={1} value={field.value} onChange={(value) => field.onChange(value ?? 1)} className="w-full" />
                        )}
                      />
                    </div>
                  </Card>
                ))}

                <Button
                  icon={<PlusOutlined />}
                  onClick={() =>
                    actionArray.append({
                      actionType: "TRANSFER",
                      amountVnd: 1000,
                      sourceSelectorType: "SUBJECT_PLAYER",
                      sourceSelectorJsonText: "",
                      destinationSelectorType: "MATCH_WINNER",
                      destinationSelectorJsonText: "",
                      descriptionTemplate: "",
                      sortOrder: 1
                    })
                  }
                >
                  Add action
                </Button>
              </div>
            )
          }
        ]}
      />

      {ruleErrors ? <div className="mt-2 text-xs text-red-600">{ruleErrors.message as string}</div> : null}
    </Card>
  );
};

export const RuleBuilder = () => {
  const { control } = useFormContext<RawRuleSetVersionValues>();
  const ruleArray = useFieldArray({
    control,
    name: "rules"
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Rules ({ruleArray.fields.length})</div>
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={() =>
            ruleArray.append({
              code: "",
              name: "",
              description: "",
              ruleKind: "CUSTOM",
              priority: 100,
              status: "ACTIVE",
              stopProcessingOnMatch: false,
              metadataText: "",
              conditions: [{ conditionKey: "participantCount", operator: "EQ", valueJsonText: "", sortOrder: 1 }],
              actions: [
                {
                  actionType: "TRANSFER",
                  amountVnd: 1000,
                  sourceSelectorType: "SUBJECT_PLAYER",
                  sourceSelectorJsonText: "",
                  destinationSelectorType: "MATCH_WINNER",
                  destinationSelectorJsonText: "",
                  descriptionTemplate: "",
                  sortOrder: 1
                }
              ]
            })
          }
        >
          Add rule
        </Button>
      </div>

      {ruleArray.fields.map((rule, index) => (
        <RuleItemEditor key={rule.id} index={index} onRemove={() => ruleArray.remove(index)} />
      ))}
    </div>
  );
};
