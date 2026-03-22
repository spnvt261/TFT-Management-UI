import { Spin } from "antd";

export const InlineLoading = ({ label = "Loading..." }: { label?: string }) => (
  <div className="flex items-center gap-2 py-3 text-sm text-slate-500">
    <Spin size="small" />
    <span>{label}</span>
  </div>
);
