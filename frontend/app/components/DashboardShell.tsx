"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme";
import {
  CloudIcon, GridIcon, ServerIcon, SearchIcon, TagIcon,
  UsersIcon, FileTextIcon, SettingsIcon, SunIcon, MoonIcon, ChevronDownIcon
} from "./Icons";

type DashboardUser = {
  name?: string;
  email?: string;
  tenant?: string;
  roles: string[];
  expiringSoon?: boolean;
};

/* ── Theme Toggle ────────────────────────────────────────────── */
function ThemeToggle() {
  const { resolved, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <button className="theme-toggle" aria-label="Toggle theme"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" /></button>;
  const isDark = resolved === "dark";
  return (
    <button className="theme-toggle" onClick={() => setTheme(isDark ? "light" : "dark")} aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}>
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

/* ── Sidebar ─────────────────────────────────────────────────── */
const NAV_ITEMS = [
  { id: "/",           label: "Overview",   icon: GridIcon     },
  { id: "/resources",  label: "Resources",  icon: ServerIcon   },
  { id: "/search",     label: "Search",     icon: SearchIcon   },
  { id: "/tag-editor", label: "Tag Editor", icon: TagIcon      },
  { id: "/accounts",   label: "Accounts",   icon: UsersIcon    },
  { id: "/audit-logs", label: "Audit Logs", icon: FileTextIcon },
  { id: "/settings",   label: "Settings",   icon: SettingsIcon },
];

function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon"><CloudIcon /></div>
        <span className="sidebar-logo-text">AWS Dash</span>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = pathname === id || (id !== "/" && pathname.startsWith(id));
          return (
            <button
              key={id}
              className={`nav-item${isActive ? " active" : ""}`}
              onClick={() => router.push(id)}
            >
              <Icon />
              {label}
            </button>
          );
        })}
      </nav>
      <div className="sidebar-bottom">
        <ThemeToggle />
      </div>
    </aside>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [expiringSoon, setExpiringSoon] = useState(false);

  useEffect(() => {
    async function checkSession() {
      const session = await fetch("/api/auth/me", { cache: "no-store" });
      if (session.status === 401) { window.location.href = "/api/auth/login"; return false; }
      if (session.ok) {
        const data = (await session.json()) as { user: DashboardUser; expiringSoon?: boolean };
        setUser(data.user);
        setExpiringSoon(data.expiringSoon ?? false);
      }
      return true;
    }
    async function boot() {
      const ok = await checkSession();
      if (!ok) return;
      const interval = setInterval(checkSession, 60_000);
      return () => clearInterval(interval);
    }
    void boot();
  }, []);

  const activeNav = NAV_ITEMS.find((n) => pathname === n.id || (n.id !== "/" && pathname.startsWith(n.id)));
  const title = activeNav ? activeNav.label : "AWS Dash";

  const initials = user?.name 
    ? user.name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join("") || "RV"
    : "RV";

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <header className="topbar">
          <h1 className="topbar-title">{title}</h1>
          <div className="topbar-right">
            <button className="account-selector">
              All Accounts
              <ChevronDownIcon />
            </button>
            <div className="user-avatar" title={user?.name || user?.email || "User"}>
              {initials}
            </div>
            <button className="user-menu-btn" aria-label="User menu">
              <ChevronDownIcon />
            </button>
          </div>
        </header>
        {expiringSoon && (
          <div className="expiry-banner">
            <span>⚠️ Your session expires in less than 5 minutes.</span>
            <a href="/api/auth/login">Re-authenticate</a>
          </div>
        )}
        <div className="content-scroll" id="main-content">
          {children}
        </div>
      </div>
    </div>
  );
}
