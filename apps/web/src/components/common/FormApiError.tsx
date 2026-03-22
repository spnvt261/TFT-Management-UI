import { Alert } from "antd";

export const FormApiError = ({ message }: { message?: string | null }) => {
  if (!message) {
    return null;
  }

  return <Alert showIcon type="error" message={message} />;
};
