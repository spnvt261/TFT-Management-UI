import type { ReactNode } from "react";
import { Select } from "antd";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { SectionCard } from "@/components/layout/SectionCard";

const participantCountOptions = [
  { label: "3 players", value: 3 },
  { label: "4 players", value: 4 }
] as const;

interface RuleMatchSetupSectionProps<T extends FieldValues> {
  control: Control<T>;
  participantCountName: Path<T>;
  winnerCountName?: Path<T>;
  winnerOptions?: Array<{ label: string; value: number }>;
  winnerError?: string;
  description?: string;
  children?: ReactNode;
}

export const RuleMatchSetupSection = <T extends FieldValues>({
  control,
  participantCountName,
  winnerCountName,
  winnerOptions,
  winnerError,
  description = "Choose participant and rank setup",
  children
}: RuleMatchSetupSectionProps<T>) => (
  <SectionCard title="Match Setup" description={description}>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <label className="mb-1 block text-sm font-medium">Participant count</label>
        <Controller
          control={control}
          name={participantCountName}
          render={({ field }) => (
            <Select
              size="large"
              value={field.value}
              onChange={(value) => field.onChange(value)}
              options={[...participantCountOptions]}
              className="w-full"
              popupMatchSelectWidth={false}
            />
          )}
        />
      </div>

      {winnerCountName ? (
        <div>
          <label className="mb-1 block text-sm font-medium">Winner count</label>
          <Controller
            control={control}
            name={winnerCountName}
            render={({ field }) => (
              <Select
                size="large"
                value={field.value}
                onChange={field.onChange}
                options={winnerOptions ?? []}
                className="w-full"
                popupMatchSelectWidth={false}
              />
            )}
          />
          {winnerError ? <div className="mt-1 text-xs text-red-600">{winnerError}</div> : null}
        </div>
      ) : null}
    </div>

    {children ? <div className="mt-4">{children}</div> : null}
  </SectionCard>
);
