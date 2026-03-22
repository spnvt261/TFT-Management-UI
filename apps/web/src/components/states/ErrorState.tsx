import { Button, Alert } from "antd";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export const ErrorState = ({
  title = "Could not load data",
  description = "Please retry in a moment.",
  onRetry
}: ErrorStateProps) => (
  <div className="space-y-3 rounded-2xl border border-red-100 bg-red-50 p-4">
    <Alert type="error" showIcon message={title} description={description} />
    {onRetry ? (
      <Button onClick={onRetry} danger>
        Retry
      </Button>
    ) : null}
  </div>
);
