import { message } from "antd";

const WRITE_PERMISSION_DENIED_MESSAGE = "Admin access is required. Go to Settings and choose Login as Admin.";

export const guardWritePermission = (canWrite: boolean) => {
  if (canWrite) {
    return true;
  }

  message.warning(WRITE_PERMISSION_DENIED_MESSAGE);
  return false;
};
