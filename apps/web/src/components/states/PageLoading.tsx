import { Spin } from "antd";

export const PageLoading = ({ label = "Loading..." }: { label?: string }) => (
  <div className="flex min-h-[40vh] items-center justify-center">
    <div className="flex flex-col items-center gap-3 text-slate-600">
      <Spin size="large" />
      <span className="text-sm">{label}</span>
    </div>
  </div>
);
