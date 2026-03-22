import { useState } from "react";
import { Layout, Drawer, Button } from "antd";
import { MenuOutlined } from "@ant-design/icons";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/cn";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/match-stakes", label: "Match Stakes" },
  { to: "/group-fund", label: "Group Fund" },
  { to: "/rules", label: "Rules" },
  { to: "/players", label: "Players" }
];

const NavContent = ({ onNavigate }: { onNavigate?: () => void }) => {
  const location = useLocation();

  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const active = location.pathname.startsWith(item.to);

        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "block rounded-xl px-3 py-2 text-sm font-medium transition",
              active ? "bg-brand-100 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
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
    <Layout className="min-h-screen bg-transparent">
      <aside className="hidden w-64 border-r border-slate-200 bg-white/80 p-5 backdrop-blur lg:block">
        <h1 className="mb-6 text-lg font-bold text-slate-900">TFT History</h1>
        <NavContent />
      </aside>

      <Layout.Content className="flex-1 p-4 sm:p-6">
        <header className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 backdrop-blur lg:hidden">
          <h1 className="text-base font-semibold">TFT History</h1>
          <Button aria-label="Open navigation" icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} />
        </header>

        <main className="mx-auto w-full max-w-7xl pb-20 lg:pb-10">
          <Outlet />
        </main>
      </Layout.Content>

      <Drawer open={drawerOpen} title="Navigation" placement="left" onClose={() => setDrawerOpen(false)}>
        <NavContent onNavigate={() => setDrawerOpen(false)} />
      </Drawer>
    </Layout>
  );
};
