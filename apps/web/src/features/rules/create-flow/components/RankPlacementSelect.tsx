import { useMemo } from "react";
import { Select } from "antd";
import type { SelectProps } from "antd";

interface RankPlacementSelectProps {
  value?: number;
  onChange?: (value: number) => void;
  min?: number;
  max: number;
  disabled?: boolean;
  placeholder?: string;
  size?: SelectProps["size"];
  className?: string;
  optionLabel?: (value: number) => string;
}

export const RankPlacementSelect = ({
  value,
  onChange,
  min = 1,
  max,
  disabled,
  placeholder,
  size = "middle",
  className,
  optionLabel
}: RankPlacementSelectProps) => {
  const options = useMemo(
    () =>
      Array.from({ length: Math.max(0, max - min + 1) }, (_, index) => {
        const nextValue = index + min;
        return {
          value: nextValue,
          label: optionLabel ? optionLabel(nextValue) : String(nextValue)
        };
      }),
    [max, min, optionLabel]
  );

  return (
    <Select
      value={value}
      onChange={(nextValue) => onChange?.(Number(nextValue))}
      options={options}
      disabled={disabled}
      placeholder={placeholder}
      size={size}
      className={`w-full ${className ?? ""}`.trim()}
      popupMatchSelectWidth={false}
    />
  );
};
