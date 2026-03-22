import { Button, Drawer, Modal, Typography } from "antd";
import { useIsMobile } from "@/hooks/useIsMobile";

interface ConfirmDangerProps {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDanger = ({
  open,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  loading,
  onConfirm,
  onCancel
}: ConfirmDangerProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onClose={onCancel} title={title} placement="bottom" height={260}>
        <Typography.Paragraph className="text-slate-600">{description}</Typography.Paragraph>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button onClick={onCancel}>{cancelText}</Button>
          <Button danger type="primary" loading={loading} onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </Drawer>
    );
  }

  return (
    <Modal
      open={open}
      title={title}
      onCancel={onCancel}
      onOk={onConfirm}
      okButtonProps={{ danger: true, loading }}
      okText={confirmText}
      cancelText={cancelText}
    >
      <Typography.Paragraph className="text-slate-600">{description}</Typography.Paragraph>
    </Modal>
  );
};
