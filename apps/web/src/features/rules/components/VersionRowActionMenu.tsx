import { useMemo, useState } from "react";
import { MoreOutlined } from "@ant-design/icons";
import { Button, Dropdown, Modal } from "antd";
import type { MenuProps } from "antd";

interface VersionRowActionMenuProps {
  onViewDetail: () => void;
  onEditMetadata: () => void;
  onNewVersionFromConfig?: () => void;
  isMobile?: boolean;
}

export const VersionRowActionMenu = ({
  onViewDetail,
  onEditMetadata,
  onNewVersionFromConfig,
  isMobile = false
}: VersionRowActionMenuProps) => {
  const [open, setOpen] = useState(false);

  const items = useMemo<MenuProps["items"]>(
    () => [
      {
        key: "view",
        label: "View detail",
        onClick: onViewDetail
      },
      ...(onNewVersionFromConfig
        ? [
            {
              key: "new-version",
              label: "New Version From Config",
              onClick: onNewVersionFromConfig
            }
          ]
        : []),
      {
        key: "edit",
        label: "Save metadata",
        onClick: onEditMetadata
      }
    ],
    [onEditMetadata, onNewVersionFromConfig, onViewDetail]
  );

  if (isMobile) {
    return (
      <>
        <Button aria-label="Version actions" icon={<MoreOutlined />} onClick={() => setOpen(true)} type="text" />

        <Modal
          title="Version actions"
          open={open}
          onCancel={() => setOpen(false)}
          footer={null}
          centered
          destroyOnHidden
        >
          <div className="space-y-2">
            <Button
              block
              onClick={() => {
                setOpen(false);
                onViewDetail();
              }}
            >
              View detail
            </Button>

            {onNewVersionFromConfig ? (
              <Button
                block
                onClick={() => {
                  setOpen(false);
                  onNewVersionFromConfig();
                }}
              >
                New Version From Config
              </Button>
            ) : null}

            <Button
              block
              onClick={() => {
                setOpen(false);
                onEditMetadata();
              }}
            >
              Save metadata
            </Button>
          </div>
        </Modal>
      </>
    );
  }

  return (
    <Dropdown trigger={["click"]} menu={{ items }} placement="bottomRight">
      <Button className="border border-gray-200 rounded-[8px]" aria-label="Version actions" icon={<MoreOutlined />} type="text" />
    </Dropdown>
  );
};
