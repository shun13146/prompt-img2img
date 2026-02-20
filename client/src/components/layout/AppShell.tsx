import { NavLink, Outlet } from "react-router-dom";
import { Paintbrush, Users, ListTodo, Settings, Mountain } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: Paintbrush, label: "プロンプト組立" },
  { to: "/characters", icon: Users, label: "キャラクター" },
  { to: "/background", icon: Mountain, label: "背景生成" },
  { to: "/queue", icon: ListTodo, label: "キュー" },
  { to: "/settings", icon: Settings, label: "設定" },
];

export function AppShell() {
  return (
    <div className="flex h-screen">
      <nav className="w-48 border-r bg-sidebar p-3 flex flex-col gap-1">
        <h1 className="text-sm font-bold px-2 py-3 text-sidebar-foreground">
          SD Prompt Builder
        </h1>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
