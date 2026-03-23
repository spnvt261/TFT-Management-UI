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
  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
    <Button className="w-full sm:w-auto" onClick={onCancel}>
      {cancelLabel}
    </Button>
    <Button className="w-full sm:w-auto" type="primary" htmlType="submit" loading={submitLoading} disabled={submitDisabled}>
      {submitLabel}
    </Button>
  </div>
);
