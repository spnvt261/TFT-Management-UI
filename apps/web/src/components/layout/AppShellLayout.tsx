import { useState } from "react";
import { Drawer, Button } from "antd";
import { MenuOutlined } from "@ant-design/icons";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/cn";

const navItems = [
  { to: "/match-stakes", label: "Match Stakes", activePrefixes: ["/match-stakes"] },
  { to: "/rules", label: "Rules" },
  { to: "/players", label: "Players" },
  { to: "/settings", label: "Settings" }
];

const NavContent = ({ onNavigate }: { onNavigate?: () => void }) => {
  const location = useLocation();

  return (
    <nav className="space-y-1.5">
      {navItems.map((item) => {
        const prefixes = "activePrefixes" in item && Array.isArray(item.activePrefixes) ? item.activePrefixes : [item.to];
        const active = prefixes.some((prefix) => location.pathname.startsWith(prefix));

        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "block rounded-xl px-3.5 py-2.5 text-sm font-medium transition",
              active
                ? "bg-brand-100 text-brand-700 shadow-[inset_0_0_0_1px_rgba(22,163,74,0.2)]"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
};

export const AppShellLayout = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-transparent lg:flex">
      <aside className="sticky top-0 hidden h-screen w-[280px] border-r border-slate-200/80 bg-white/90 px-5 py-6 backdrop-blur lg:block">
        <div className="mb-6 border-b border-slate-200/80 pb-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">TFT2</div>
        </div>
        <NavContent />
      </aside>

      <div className="min-w-0 flex-1 px-3 pb-8 pt-3 sm:px-4 sm:pt-4 lg:px-7 lg:pt-6 xl:px-8">
        <header className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 backdrop-blur lg:hidden">
          <h1 className="text-base font-semibold">TFT History</h1>
          <Button aria-label="Open navigation" icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} />
        </header>

        <main className="w-full pb-20 lg:pb-10">
          <Outlet />
        </main>
      </div>

      <Drawer open={drawerOpen} title="Navigation" placement="left" onClose={() => setDrawerOpen(false)}>
        <NavContent onNavigate={() => setDrawerOpen(false)} />
      </Drawer>
    </div>
  );
};
