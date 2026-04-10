import { InputNumber } from "antd";
import type { InputNumberProps } from "antd";

const amountFormatter = new Intl.NumberFormat("en-US");

const toDigits = (value: string | number | undefined | null) => String(value ?? "").replace(/\D/g, "").trim();

const toSignedDigits = (value: string | number | undefined | null) => {
  const raw = String(value ?? "").trim();
  const normalized = raw.replace(/[^\d-]/g, "");

  if (!normalized) {
    return "";
  }

  if (normalized === "-") {
    return normalized;
  }

  const isNegative = normalized.startsWith("-");
  const digits = normalized.replace(/-/g, "");
  if (!digits) {
    return "";
  }

  return isNegative ? `-${digits}` : digits;
};

interface CurrencyAmountInputProps
  extends Omit<InputNumberProps<string | number>, "value" | "onChange" | "formatter" | "parser" | "precision" | "min"> {
  value?: number | null;
  onChange?: (value: number | undefined) => void;
  emptyValue?: number | undefined;
  min?: number;
  signed?: boolean;
}

export const CurrencyAmountInput = ({
  value,
  onChange,
  addonAfter,
  min,
  signed = false,
  emptyValue = 0,
  ...rest
}: CurrencyAmountInputProps) => (
  <InputNumber<string | number>
    {...rest}
    value={value ?? undefined}
    min={min ?? (signed ? undefined : 0)}
    precision={0}
    className={`w-full ${rest.className ?? ""}`.trim()}
    addonAfter={addonAfter ?? "VND"}
    inputMode={rest.inputMode ?? (signed ? "decimal" : "numeric")}
    formatter={(displayValue) => {
      const raw = String(displayValue ?? "").trim();
      const isNegative = signed && (raw.startsWith("-") || (typeof displayValue === "number" && displayValue < 0));
      const digits = signed ? toDigits(toSignedDigits(displayValue)) : toDigits(displayValue);

      if (signed && raw === "-") {
        return raw;
      }

      if (!digits) {
        return "";
      }

      return `${isNegative ? "-" : ""}${amountFormatter.format(Number(digits))}`;
    }}
    parser={(displayValue) => (signed ? toSignedDigits(displayValue) : toDigits(displayValue))}
    onChange={(nextValue) =>
      onChange?.(typeof nextValue === "number" && Number.isFinite(nextValue) ? Math.trunc(nextValue) : emptyValue)
    }
  />
);
