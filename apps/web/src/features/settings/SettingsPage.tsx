import { useMemo, useState } from "react";
import { Button, Select } from "antd";
import { useNavigate } from "react-router-dom";
import { AppBreadcrumb } from "@/components/layout/AppBreadcrumb";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/layout/SectionCard";
import { useAuth } from "@/features/auth/AuthContext";
import {
  formatVnd,
  getMoneyDisplayMode,
  setMoneyDisplayMode,
  type MoneyDisplayMode
} from "@/lib/format";
import type { RoleCode } from "@/types/api";

const moneyDisplayModeOptions: Array<{ value: MoneyDisplayMode; label: string }> = [
  { value: "vnd", label: "Standard (10.000 VND)" },
  { value: "dong", label: "Dong suffix (10.000d)" },
  { value: "basic", label: "Basic (10.000 -> 10)" }
];

const formatSigned = (value: number, mode: MoneyDisplayMode) => (value > 0 ? `+${formatVnd(value, mode)}` : formatVnd(value, mode));

const roleUi: Record<RoleCode, { label: string; description: string; badgeClassName: string; dotClassName: string }> = {
  ADMIN: {
    label: "Admin",
    description: "Full access to create, edit, and manage all data.",
    badgeClassName: "border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800",
    dotClassName: "bg-amber-500"
  },
  USER: {
    label: "User",
    description: "Read and participate in available features.",
    badgeClassName: "border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-800",
    dotClassName: "bg-emerald-500"
  }
};

export const SettingsPage = () => {
  const navigate = useNavigate();
  const { logout, role } = useAuth();
  const [moneyDisplayMode, setMoneyDisplayModeState] = useState<MoneyDisplayMode>(() => getMoneyDisplayMode());

  const previewRows = useMemo(
    () => [
      { label: "Total transfer", value: formatVnd(10000, moneyDisplayMode) },
      { label: "Participant A", value: formatSigned(150000, moneyDisplayMode) },
      { label: "Participant B", value: formatSigned(-30000, moneyDisplayMode) }
    ],
    [moneyDisplayMode]
  );

  const handleLogout = () => {
    logout();
    navigate("/match-stakes", { replace: true });
  };

  const currentRoleUi = role ? roleUi[role] : null;

  return (
    <PageContainer>
      <AppBreadcrumb items={[{ label: "Settings" }]} />
      <PageHeader title="Settings" subtitle="Personal display preferences are saved on this device." />

      <SectionCard title="Money Display" description="Choose how money values appear across the app.">
        <div className="space-y-4">
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Display mode</div>
            <Select
              value={moneyDisplayMode}
              options={moneyDisplayModeOptions}
              className="w-full max-w-[380px]"
              onChange={(nextMode: MoneyDisplayMode) => {
                setMoneyDisplayMode(nextMode);
                setMoneyDisplayModeState(nextMode);
              }}
            />
          </div>

          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</div>
            <div className="space-y-1.5 text-sm text-slate-700">
              {previewRows.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-2">
                  <span>{item.label}</span>
                  <span className="font-semibold text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Account"
        description="Session controls for the current login."
        actions={
          currentRoleUi ? (
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${currentRoleUi.badgeClassName}`}
            >
              <span className={`h-2 w-2 rounded-full shadow-sm ${currentRoleUi.dotClassName}`} />
              <span>{currentRoleUi.label}</span>
            </div>
          ) : (
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Unknown
            </div>
          )
        }
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Current role</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{currentRoleUi?.label ?? "Unknown"}</div>
            <div className="mt-1 text-xs text-slate-600">
              {currentRoleUi?.description ?? "Role details are currently unavailable."}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {role !== "ADMIN" ? (
              <Button type="primary" onClick={() => navigate("/login", { state: { from: "/settings" } })}>
                Login as Admin
              </Button>
            ) : null}
            {
              role === "ADMIN" && <Button danger={role === "ADMIN"} onClick={handleLogout}>
              {role === "ADMIN" ? "Switch to User Mode" : "Reset Session"}
            </Button>
            }
            
          </div>
        </div>
      </SectionCard>
    </PageContainer>
  );
};
