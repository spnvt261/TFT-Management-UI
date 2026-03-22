import { Input, Switch } from "antd";
import { Controller, type Control, type FieldErrors, type FieldValues, type Path } from "react-hook-form";
import { SectionCard } from "@/components/layout/SectionCard";

interface RuleBasicInfoShape extends FieldValues {
  name: string;
  code?: string;
  description?: string;
  isDefault: boolean;
}

interface RuleBasicInfoSectionProps<T extends RuleBasicInfoShape> {
  control: Control<T>;
  errors: FieldErrors<T>;
  description?: string;
  hideCode?: boolean;
}

export const RuleBasicInfoSection = <T extends RuleBasicInfoShape>({
  control,
  errors,
  description = "Business information for this rule",
  hideCode = false
}: RuleBasicInfoSectionProps<T>) => (
  <SectionCard title="Basic Info" description={description}>
    <div className={`grid grid-cols-1 gap-4 ${hideCode ? "md:grid-cols-1" : "md:grid-cols-2"}`}>
      <div>
        <label className="mb-1 block text-sm font-medium">Rule name</label>
        <Controller
          control={control}
          name={"name" as Path<T>}
          render={({ field }) => <Input {...field} size="large" placeholder="Weekend Standard Rule" />}
        />
        {errors.name?.message ? <div className="mt-1 text-xs text-red-600">{String(errors.name.message)}</div> : null}
      </div>

      {!hideCode ? (
        <div>
          <label className="mb-1 block text-sm font-medium">Code</label>
          <Controller
            control={control}
            name={"code" as Path<T>}
            render={({ field }) => <Input {...field} size="large" placeholder="RULE_STANDARD" />}
          />
          {errors.code?.message ? <div className="mt-1 text-xs text-red-600">{String(errors.code.message)}</div> : null}
        </div>
      ) : null}
    </div>

    <div className="mt-4">
      <label className="mb-1 block text-sm font-medium">Description (optional)</label>
      <Controller control={control} name={"description" as Path<T>} render={({ field }) => <Input.TextArea {...field} rows={3} />} />
    </div>

    <div className="mt-4 flex">
      <div className="inline-flex items-center gap-4 rounded-xl border border-slate-200 px-4 py-2.5">
        <span className="text-sm font-medium">Set as default</span>
        <Controller
          control={control}
          name={"isDefault" as Path<T>}
          render={({ field }) => <Switch checked={field.value} onChange={field.onChange} />}
        />
      </div>
    </div>
  </SectionCard>
);
