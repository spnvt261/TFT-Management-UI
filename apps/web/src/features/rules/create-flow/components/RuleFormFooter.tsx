import { Button } from "antd";

interface RuleFormFooterProps {
  onCancel: () => void;
  submitLabel: string;
  submitLoading?: boolean;
  submitDisabled?: boolean;
  cancelLabel?: string;
}

export const RuleFormFooter = ({
  onCancel,
  submitLabel,
  submitLoading,
  submitDisabled,
  cancelLabel = "Cancel"
}: RuleFormFooterProps) => (
  <div className="flex flex-wrap items-center justify-end gap-2">
    <Button onClick={onCancel}>{cancelLabel}</Button>
    <Button type="primary" htmlType="submit" loading={submitLoading} disabled={submitDisabled}>
      {submitLabel}
    </Button>
  </div>
);
