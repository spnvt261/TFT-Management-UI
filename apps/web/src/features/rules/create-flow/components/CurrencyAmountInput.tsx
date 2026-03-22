import { InputNumber } from "antd";
import type { InputNumberProps } from "antd";

const amountFormatter = new Intl.NumberFormat("en-US");

const toDigits = (value: string | number | undefined | null) =>
  String(value ?? "")
    .replace(/\D/g, "")
    .trim();

interface CurrencyAmountInputProps
  extends Omit<InputNumberProps<number>, "value" | "onChange" | "formatter" | "parser" | "precision" | "min"> {
  value?: number;
  onChange?: (value: number) => void;
  min?: number;
}

export const CurrencyAmountInput = ({ value, onChange, addonAfter, min = 0, ...rest }: CurrencyAmountInputProps) => (
  <InputNumber
    {...rest}
    value={value}
    min={min}
    precision={0}
    className={`w-full ${rest.className ?? ""}`.trim()}
    addonAfter={addonAfter ?? "VND"}
    formatter={(displayValue) => {
      const raw = String(displayValue ?? "").trim();
      const isNegative = raw.startsWith("-") || (typeof displayValue === "number" && displayValue < 0);
      const digits = toDigits(displayValue);
      if (!digits) {
        return "";
      }

      return `${isNegative ? "-" : ""}${amountFormatter.format(Number(digits))}`;
    }}
    parser={(displayValue) => Number(toDigits(displayValue))}
    onChange={(nextValue) => onChange?.(typeof nextValue === "number" && Number.isFinite(nextValue) ? nextValue : 0)}
  />
);
