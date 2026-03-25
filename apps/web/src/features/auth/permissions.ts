import { message } from "antd";

const WRITE_PERMISSION_DENIED_MESSAGE = "You do not have permission for this action.";

export const guardWritePermission = (canWrite: boolean) => {
  if (canWrite) {
    return true;
  }

  message.warning(WRITE_PERMISSION_DENIED_MESSAGE);
  return false;
};
