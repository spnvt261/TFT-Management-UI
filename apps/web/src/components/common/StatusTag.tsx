import { Tag } from "antd";

export const StatusTag = ({ label, positive }: { label: string; positive?: boolean }) => (
  <Tag color={positive ? "green" : "default"}>{label}</Tag>
);
