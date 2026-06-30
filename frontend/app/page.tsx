"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useTheme } from "@/lib/theme";

/* ── Types ───────────────────────────────────────────────────── */

type Resource = {
  id: string;
  name: string;
  type: string;
  region: string;
  account_id: string;
  ou: string;
  state: string;
  created: string;
  tags: Record<string, string>;
};

type DashboardUser = {
  name?: string;
  email?: string;
  tenant?: string;
  roles: string[];
  expiringSoon?: boolean;
};

type EditState = {
  id: string;
  name: string;
  type: string;
  account_id: string;
  tagsText: string;
} | null;

type NavPage = "overview" | "resources" | "search" | "tag-editor" | "accounts" | "audit-logs" | "settings";

/* ── Helpers ─────────────────────────────────────────────────── */

function parseTagText(value: string) {
  const tags: Record<string, string> = {};
  value.split("\n").map((l) => l.trim()).filter(Boolean).forEach((line) => {
    const [key, ...rest] = line.split("=");
    const v = rest.join("=").trim();
    if (key && v) tags[key.trim()] = v;
  });
  return tags;
}

function resourceTypeKey(type: string) {
  const lower = type.toLowerCase();
  if (lower.includes("ec2")) return "ec2";
  if (lower.includes("s3")) return "s3";
  if (lower.includes("rds")) return "rds";
  if (lower.includes("load") || lower.includes("elb")) return "lb";
  return "other";
}

function stateClass(state: string) {
  const s = state.toLowerCase();
  if (s === "running" || s === "available") return "state-running";
  if (s === "stopped" || s === "stopping") return "state-stopped";
  if (s === "pending" || s === "modifying") return "state-pending";
  return "state-default";
}

function complianceClass(score: number) {
  if (score < 50) return "low";
  if (score < 80) return "medium";
  return "high";
}

function relativeTime(index: number): string {
  const times = ["2m ago", "15m ago", "1h ago", "3h ago", "6h ago", "12h ago", "1d ago"];
  return times[index % times.length];
}

function userInitials(user: DashboardUser | null): string {
  if (!user) return "RV";
  const name = user.name || user.email || "";
  return name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join("") || "RV";
}

/* ── Donut Chart ─────────────────────────────────────────────── */

interface DonutSegment { pct: number; color: string; label: string; key: string; }

function DonutChart({ segments, total }: { segments: DonutSegment[]; total: number }) {
  const SIZE = 140;
  const R = 52;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const circumference = 2 * Math.PI * R;

  let cumulative = 0;
  const arcs = segments.map((seg) => {
    const dash = (seg.pct / 100) * circumference;
    const gap = circumference - dash;
    const offset = -(cumulative / 100) * circumference;
    cumulative += seg.pct;
    return { ...seg, dash, gap, offset };
  });

  return (
    <div className="donut-container">
      <div className="donut-wrap" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Track */}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={18} />
          {/* Segments */}
          {arcs.map((arc) => (
            <circle
              key={arc.key}
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={arc.color}
              strokeWidth={18}
              strokeDasharray={`${arc.dash} ${arc.gap}`}
              strokeDashoffset={arc.offset}
              strokeLinecap="butt"
              style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.16,1,0.3,1)" }}
            />
          ))}
        </svg>
        <div className="donut-center">
          <span className="donut-center-value">{total.toLocaleString()}</span>
          <span className="donut-center-label">Total<br />Resources</span>
        </div>
      </div>

      <div className="donut-legend">
        {segments.map((seg) => (
          <div key={seg.key} className="legend-item">
            <span className="legend-dot" style={{ background: seg.color }} />
            <span className="legend-name">{seg.label}</span>
            <span className="legend-pct">{seg.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── World Map SVG ───────────────────────────────────────────── */

function WorldMap() {
  const dots = [
    { id: "us-east",  cx: "22%", cy: "36%", delay: "0s"    },
    { id: "us-west",  cx: "10%", cy: "34%", delay: "0.5s"  },
    { id: "eu-west",  cx: "47%", cy: "27%", delay: "1s"    },
    { id: "ap-south", cx: "70%", cy: "46%", delay: "1.5s"  },
    { id: "ap-east",  cx: "82%", cy: "38%", delay: "0.8s"  },
  ];

  return (
    <div className="map-wrap">
      <svg viewBox="0 0 500 280" xmlns="http://www.w3.org/2000/svg">
        {/* Very simplified continent outlines — decorative */}
        <g fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.25)" strokeWidth="0.8">
          {/* North America */}
          <path d="M 40 60 L 130 55 L 145 80 L 140 120 L 120 140 L 100 160 L 70 155 L 50 130 L 30 100 Z" />
          {/* South America */}
          <path d="M 85 170 L 120 165 L 130 200 L 120 240 L 100 260 L 80 250 L 70 220 L 75 185 Z" />
          {/* Europe */}
          <path d="M 215 45 L 265 40 L 280 60 L 270 90 L 240 100 L 215 85 Z" />
          {/* Africa */}
          <path d="M 225 105 L 270 100 L 285 130 L 280 180 L 255 210 L 225 200 L 210 165 L 215 130 Z" />
          {/* Asia */}
          <path d="M 285 35 L 430 30 L 445 65 L 430 100 L 380 110 L 320 105 L 285 80 Z" />
          {/* Australia */}
          <path d="M 380 170 L 440 165 L 455 200 L 440 225 L 390 220 L 375 200 Z" />
          {/* UK / islands */}
          <path d="M 208 55 L 216 52 L 218 65 L 210 67 Z" />
        </g>
        {/* Ocean lines */}
        {[70, 140, 210].map((y) => (
          <line key={y} x1="0" y1={y} x2="500" y2={y} stroke="rgba(59,130,246,0.06)" strokeWidth="0.5" />
        ))}
        {[100, 200, 300, 400].map((x) => (
          <line key={x} x1={x} y1="0" x2={x} y2="280" stroke="rgba(59,130,246,0.06)" strokeWidth="0.5" />
        ))}

        {/* Glowing dots */}
        {dots.map((dot) => (
          <g key={dot.id}>
            {/* Outer pulse ring */}
            <circle
              cx={dot.cx} cy={dot.cy} r="8"
              fill="rgba(59,130,246,0.15)"
              style={{ animationDelay: dot.delay }}
              className="map-dot-pulse"
            />
            {/* Core dot */}
            <circle cx={dot.cx} cy={dot.cy} r="4" fill="#3b82f6" />
            <circle cx={dot.cx} cy={dot.cy} r="2.5" fill="#93c5fd" />
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ── Icons ───────────────────────────────────────────────────── */

function CloudIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function ServerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function FileTextIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

/* ── Smaller inline icons for resource type ─────────────────── */
function Ec2Icon()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>; }
function S3Icon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>; }
function RdsIcon()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>; }
function LbIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>; }
function OtherIcon(){ return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>; }

function ResourceTypeIcon({ typeKey }: { typeKey: string }) {
  const cls = `resource-type-icon ${typeKey}-icon`;
  return (
    <span className={cls}>
      {typeKey === "ec2"   && <Ec2Icon />}
      {typeKey === "s3"    && <S3Icon />}
      {typeKey === "rds"   && <RdsIcon />}
      {typeKey === "lb"    && <LbIcon />}
      {typeKey === "other" && <OtherIcon />}
    </span>
  );
}

function TypeBadge({ typeKey, label }: { typeKey: string; label: string }) {
  return <span className={`type-badge badge-${typeKey}`}>{label}</span>;
}

/* ── Skeleton ────────────────────────────────────────────────── */
function SkeletonRows() {
  return (
    <>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="skeleton-row">
          <div className="skeleton-bar" style={{ width: "25%" }} />
          <div className="skeleton-bar" style={{ width: "12%" }} />
          <div className="skeleton-bar" style={{ width: "10%" }} />
          <div className="skeleton-bar" style={{ width: "8%" }} />
          <div className="skeleton-bar" style={{ width: "20%" }} />
        </div>
      ))}
    </>
  );
}

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
const NAV_ITEMS: { id: NavPage; label: string; icon: () => JSX.Element }[] = [
  { id: "overview",    label: "Overview",   icon: GridIcon     },
  { id: "resources",   label: "Resources",  icon: ServerIcon   },
  { id: "search",      label: "Search",     icon: SearchIcon   },
  { id: "tag-editor",  label: "Tag Editor", icon: TagIcon      },
  { id: "accounts",    label: "Accounts",   icon: UsersIcon    },
  { id: "audit-logs",  label: "Audit Logs", icon: FileTextIcon },
  { id: "settings",    label: "Settings",   icon: SettingsIcon },
];

function Sidebar({ activePage, onNavigate }: { activePage: NavPage; onNavigate: (p: NavPage) => void }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon"><CloudIcon /></div>
        <span className="sidebar-logo-text">AWS Dash</span>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`nav-${id}`}
            className={`nav-item${activePage === id ? " active" : ""}`}
            onClick={() => onNavigate(id)}
          >
            <Icon />
            {label}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <ThemeToggle />
      </div>
    </aside>
  );
}

/* ══════════════════════════════════════════════════════════════
   OVERVIEW PAGE
   ══════════════════════════════════════════════════════════════ */

interface OverviewCounts {
  accounts: number;
  ec2: number;
  s3: number;
  rds: number;
  lb: number;
  other: number;
  total: number;
}

function buildCounts(resources: Resource[]): OverviewCounts {
  const counts = { accounts: 0, ec2: 0, s3: 0, rds: 0, lb: 0, other: 0, total: resources.length };
  const accountSet = new Set<string>();
  for (const r of resources) {
    if (r.account_id) accountSet.add(r.account_id);
    const k = resourceTypeKey(r.type);
    if (k === "ec2") counts.ec2++;
    else if (k === "s3") counts.s3++;
    else if (k === "rds") counts.rds++;
    else if (k === "lb") counts.lb++;
    else counts.other++;
  }
  counts.accounts = accountSet.size;
  return counts;
}

function buildRegionCounts(resources: Resource[]): { region: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of resources) {
    map.set(r.region, (map.get(r.region) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([region, count]) => ({ region, count }));
}

// Static fallback data shown when API returns nothing yet
const FALLBACK_COUNTS: OverviewCounts = { accounts: 24, ec2: 1298, s3: 342, rds: 112, lb: 236, other: 27, total: 2457 };
const FALLBACK_REGIONS = [
  { region: "us-east-1", count: 842 },
  { region: "ap-south-1", count: 612 },
  { region: "eu-west-1", count: 421 },
  { region: "us-west-2", count: 312 },
  { region: "others", count: 270 },
];

function OverviewPage({ resources, loading }: { resources: Resource[]; loading: boolean }) {
  const hasData = resources.length > 0;
  const counts = hasData ? buildCounts(resources) : FALLBACK_COUNTS;
  const regionCounts = hasData ? buildRegionCounts(resources) : FALLBACK_REGIONS;

  // Build donut segments
  const total = counts.total || 1;
  const segments: DonutSegment[] = [
    { key: "ec2",   label: "EC2 Instances",  pct: (counts.ec2   / total) * 100, color: "#3b82f6" },
    { key: "s3",    label: "S3 Buckets",     pct: (counts.s3    / total) * 100, color: "#10b981" },
    { key: "rds",   label: "RDS Instances",  pct: (counts.rds   / total) * 100, color: "#06b6d4" },
    { key: "lb",    label: "Load Balancers", pct: (counts.lb    / total) * 100, color: "#f59e0b" },
    { key: "other", label: "Others",         pct: (counts.other / total) * 100, color: "#a855f7" },
  ].filter((s) => s.pct > 0);

  // Recent tag updates: use last N resources or fallback rows
  const recentResources = hasData ? [...resources].reverse().slice(0, 8) : STATIC_RECENT;

  return (
    <>
      {/* ── Stat Cards ──────────────────────────────────────── */}
      <div className="stats-row">
        <div className="stat-card card-accounts">
          <div className="stat-body">
            <div className="stat-label">AWS Accounts</div>
            <div className="stat-value">{counts.accounts}</div>
            <div className="stat-detail">Active Accounts</div>
          </div>
          <div className="stat-icon-wrap icon-blue">
            <UsersIcon />
          </div>
        </div>

        <div className="stat-card card-ec2">
          <div className="stat-body">
            <div className="stat-label">EC2 Instances</div>
            <div className="stat-value">{counts.ec2.toLocaleString()}</div>
            <div className="stat-detail">Across All Accounts</div>
          </div>
          <div className="stat-icon-wrap icon-green">
            <Ec2Icon />
          </div>
        </div>

        <div className="stat-card card-s3">
          <div className="stat-body">
            <div className="stat-label">S3 Buckets</div>
            <div className="stat-value">{counts.s3.toLocaleString()}</div>
            <div className="stat-detail">Across All Accounts</div>
          </div>
          <div className="stat-icon-wrap icon-cyan">
            <S3Icon />
          </div>
        </div>

        <div className="stat-card card-rds">
          <div className="stat-body">
            <div className="stat-label">RDS Instances</div>
            <div className="stat-value">{counts.rds.toLocaleString()}</div>
            <div className="stat-detail">Across All Accounts</div>
          </div>
          <div className="stat-icon-wrap icon-indigo">
            <RdsIcon />
          </div>
        </div>
      </div>

      {/* ── Middle Row: Donut + Map ─────────────────────────── */}
      <div className="middle-row">
        {/* Resource Distribution */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Resource Distribution</div>
          </div>
          {loading
            ? <div style={{ padding: "2rem" }}><SkeletonRows /></div>
            : <DonutChart segments={segments} total={counts.total} />
          }
        </div>

        {/* Resources by Region */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Resources by Region</div>
          </div>
          <div className="map-panel-body">
            <WorldMap />
            <div className="region-list">
              {regionCounts.map(({ region, count }) => (
                <div key={region} className="region-item">
                  <span className="region-name">{region}</span>
                  <span className="region-count">{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent Tag Updates ──────────────────────────────── */}
      <div className="panel recent-panel">
        <div className="panel-header">
          <div className="panel-title">Recent Tag Updates</div>
        </div>
        <div className="recent-table-wrap">
          <table className="recent-table">
            <thead>
              <tr>
                <th>Resource</th>
                <th>Type</th>
                <th>Account</th>
                <th>Changed By</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentResources.map((r, i) => {
                const tk = "type" in r ? resourceTypeKey((r as Resource).type) : (r as StaticRow).typeKey;
                const typeLabel = "type" in r ? (r as Resource).type : (r as StaticRow).typeLabel;
                const resourceId = "id" in r ? (r as Resource).id.slice(0, 18) : (r as StaticRow).id;
                const accountId = "account_id" in r ? (r as Resource).account_id : (r as StaticRow).account_id;
                const changedBy = "changedBy" in r ? (r as StaticRow).changedBy : "ritam.vaskar";
                return (
                  <tr key={i}>
                    <td>
                      <div className="resource-cell">
                        <ResourceTypeIcon typeKey={tk} />
                        <span className="resource-id">{resourceId}</span>
                      </div>
                    </td>
                    <td><TypeBadge typeKey={tk} label={typeLabel} /></td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{accountId}</td>
                    <td>{changedBy}</td>
                    <td className="time-cell">{relativeTime(i)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* Static fallback rows when no live data */
interface StaticRow { id: string; typeKey: string; typeLabel: string; account_id: string; changedBy: string; }
const STATIC_RECENT: StaticRow[] = [
  { id: "i-0abc123def456",    typeKey: "ec2",   typeLabel: "EC2 Instance",   account_id: "123456789012", changedBy: "ritam.vaskar" },
  { id: "my-bucket-prod",     typeKey: "s3",    typeLabel: "S3 Bucket",      account_id: "210987654321", changedBy: "ritam.vaskar" },
  { id: "db-production-1",    typeKey: "rds",   typeLabel: "RDS Instance",   account_id: "123456789012", changedBy: "ritam.vaskar" },
  { id: "i-0xyz987abc321",    typeKey: "ec2",   typeLabel: "EC2 Instance",   account_id: "456789012345", changedBy: "admin" },
  { id: "logs-archive-bucket",typeKey: "s3",    typeLabel: "S3 Bucket",      account_id: "123456789012", changedBy: "ci-deploy"   },
  { id: "db-analytics-3",     typeKey: "rds",   typeLabel: "RDS Instance",   account_id: "789012345678", changedBy: "ritam.vaskar" },
];

/* ══════════════════════════════════════════════════════════════
   RESOURCES PAGE (existing functionality)
   ══════════════════════════════════════════════════════════════ */

function ResourcesPage({
  resources, loading, error, refreshing, canEditTags, filtered, search, setSearch,
  typeFilter, setTypeFilter, regionFilter, setRegionFilter, ouFilter, setOuFilter,
  accountFilter, setAccountFilter, tagFilter, setTagFilter,
  resourceTypes, regions, ous, accounts, onRefresh, onEdit,
}: {
  resources: Resource[]; loading: boolean; error: string | null; refreshing: boolean;
  canEditTags: boolean; filtered: Resource[]; search: string; setSearch: (v: string) => void;
  typeFilter: string; setTypeFilter: (v: string) => void;
  regionFilter: string; setRegionFilter: (v: string) => void;
  ouFilter: string; setOuFilter: (v: string) => void;
  accountFilter: string; setAccountFilter: (v: string) => void;
  tagFilter: string; setTagFilter: (v: string) => void;
  resourceTypes: string[]; regions: string[]; ous: string[]; accounts: string[];
  onRefresh: () => void; onEdit: (r: Resource) => void;
}) {
  const total = resources.length;
  const untagged = resources.filter((r) => Object.keys(r.tags).length === 0).length;
  const complianceScore = total ? Math.round(((total - untagged) / total) * 100) : 0;

  return (
    <>
      {/* Summary mini-stats */}
      <div className="stats-row" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: "1rem" }}>
        <div className="stat-card">
          <div className="stat-body">
            <div className="stat-label">Total Resources</div>
            <div className="stat-value">{total.toLocaleString()}</div>
            <div className="stat-detail">{filtered.length} shown</div>
          </div>
          <div className="stat-icon-wrap icon-blue"><ServerIcon /></div>
        </div>
        <div className="stat-card">
          <div className="stat-body">
            <div className="stat-label">Untagged</div>
            <div className="stat-value">{untagged}</div>
            <div className="stat-detail">{total ? `${Math.round((untagged / total) * 100)}% of inventory` : "No data"}</div>
          </div>
          <div className="stat-icon-wrap" style={{ background: "var(--warning-subtle)", color: "var(--warning)" }}><AlertIcon /></div>
        </div>
        <div className="stat-card">
          <div className="stat-body">
            <div className="stat-label">Compliance Score</div>
            <div className="stat-value">{complianceScore}%</div>
            <div className="compliance-bar">
              <div className={`compliance-bar-fill ${complianceClass(complianceScore)}`} style={{ width: `${complianceScore}%` }} />
            </div>
          </div>
          <div className="stat-icon-wrap" style={{ background: "var(--success-subtle)", color: "var(--success)" }}><ShieldIcon /></div>
        </div>
      </div>

      {/* Filters */}
      <div className="panel" style={{ marginBottom: "1rem" }}>
        <div className="filters-panel">
          <div className="filter-group">
            <span className="filter-label">Search</span>
            <input id="resource-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, ID, account, OU..." />
          </div>
          <div className="filter-group">
            <span className="filter-label">Type</span>
            <select id="type-filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              {resourceTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <span className="filter-label">Region</span>
            <select id="region-filter" value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <span className="filter-label">OU</span>
            <select id="ou-filter" value={ouFilter} onChange={(e) => setOuFilter(e.target.value)}>
              {ous.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <span className="filter-label">Account</span>
            <select id="account-filter" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
              {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <span className="filter-label">Tag</span>
            <input id="tag-filter" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} placeholder="env=prod" />
          </div>
          <div className="filter-group" style={{ justifyContent: "flex-end" }}>
            <span className="filter-label">&nbsp;</span>
            <button id="refresh-btn" className="btn-secondary" onClick={onRefresh} disabled={loading || refreshing}>
              <RefreshIcon /> {refreshing ? "Syncing…" : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="panel resource-table-panel">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <span className="table-toolbar-title">Resource Inventory</span>
            <span className="table-toolbar-count">{filtered.length} items</span>
          </div>
        </div>

        {error && !loading ? (
          <div className="error-state">
            <div className="error-icon"><ErrorIcon /></div>
            <p className="empty-title">Something went wrong</p>
            <p className="empty-desc">{error}</p>
            <button className="btn-secondary btn-sm" onClick={onRefresh}><RefreshIcon /> Retry</button>
          </div>
        ) : loading ? (
          <SkeletonRows />
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><InboxIcon /></div>
            <p className="empty-title">No resources found</p>
            <p className="empty-desc">Try adjusting your filters or refresh the inventory.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Type</th><th>Region</th><th>State</th><th>Tags</th>
                  {canEditTags && <th style={{ width: 80 }} />}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={`${r.type}-${r.id}`}>
                    <td>
                      <div className="cell-name">
                        <span className="cell-name-text">{r.name}</span>
                        <span className="cell-name-id">{r.id.length > 40 ? `${r.id.slice(0, 40)}…` : r.id}</span>
                      </div>
                    </td>
                    <td>
                      <span className="cell-type">
                        <span className={`cell-type-dot dot-${resourceTypeKey(r.type)}`} />
                        {r.type}
                      </span>
                    </td>
                    <td>{r.region}</td>
                    <td>
                      {r.state
                        ? <span className={`cell-state ${stateClass(r.state)}`}>{r.state}</span>
                        : <span style={{ color: "var(--text-muted)" }}>--</span>
                      }
                    </td>
                    <td>
                      {Object.keys(r.tags).length === 0
                        ? <span className="tag missing">No tags</span>
                        : <div className="tag-list">{Object.entries(r.tags).map(([k, v]) => <span className="tag" key={`${r.id}-${k}`}>{k}={v}</span>)}</div>
                      }
                    </td>
                    {canEditTags && (
                      <td>
                        <button id={`edit-${r.id}`} className="btn-ghost btn-sm" onClick={() => onEdit(r)}>
                          <EditIcon /> Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   PLACEHOLDER PAGES
   ══════════════════════════════════════════════════════════════ */
function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="panel" style={{ padding: "3rem 2rem", textAlign: "center" }}>
      <div className="empty-icon" style={{ margin: "0 auto 1rem" }}><InboxIcon /></div>
      <p className="empty-title" style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>{title}</p>
      <p className="empty-desc">{description}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════ */

export default function Page() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expiringSoon, setExpiringSoon] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [regionFilter, setRegionFilter] = useState("All");
  const [ouFilter, setOuFilter] = useState("All");
  const [accountFilter, setAccountFilter] = useState("All");
  const [tagFilter, setTagFilter] = useState("");
  const [editing, setEditing] = useState<EditState>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activePage, setActivePage] = useState<NavPage>("overview");

  /* ── Data fetching ─────────────────────────────────────────── */
  const fetchResources = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/resources${force ? "?force_refresh=true" : ""}`);
      if (response.status === 401) { window.location.href = "/api/auth/login"; return; }
      if (!response.ok) throw new Error(`Failed to load resources (${response.status})`);
      const data = (await response.json()) as Resource[];
      setResources(data);
    } catch (e) {
      setResources([]);
      setError(e instanceof Error ? e.message : "Failed to load resources");
    } finally {
      if (force) {
        setTimeout(async () => {
          try {
            const res = await fetch("/api/resources");
            if (res.ok) setResources((await res.json()) as Resource[]);
          } finally { setRefreshing(false); }
        }, 3000);
      } else {
        setLoading(false);
      }
    }
  }, []);

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
      try {
        const ok = await checkSession();
        if (!ok) return;
        await fetchResources();
        const interval = setInterval(async () => { await checkSession(); }, 60_000);
        return () => clearInterval(interval);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to start session");
        setLoading(false);
      }
    }
    void boot();
  }, [fetchResources]);

  /* ── Filters ───────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    return resources.filter((r) => {
      const matchesSearch = !search || [r.name, r.id, r.account_id, r.ou, r.type].join(" ").toLowerCase().includes(search.toLowerCase());
      const matchesType    = typeFilter    === "All" || r.type       === typeFilter;
      const matchesRegion  = regionFilter  === "All" || r.region     === regionFilter;
      const matchesOu      = ouFilter      === "All" || r.ou         === ouFilter;
      const matchesAccount = accountFilter === "All" || r.account_id === accountFilter;
      let matchesTag = true;
      if (tagFilter.trim()) {
        const [rawKey, ...rest] = tagFilter.split("=");
        const key = rawKey?.trim();
        const value = rest.join("=").trim();
        if (key) matchesTag = value ? r.tags[key] === value : key in r.tags;
      }
      return matchesSearch && matchesType && matchesRegion && matchesOu && matchesAccount && matchesTag;
    });
  }, [resources, search, typeFilter, regionFilter, tagFilter, ouFilter, accountFilter]);

  const resourceTypes = ["All", ...new Set(resources.map((r) => r.type))];
  const regions       = ["All", ...new Set(resources.map((r) => r.region))];
  const ous           = ["All", ...new Set(resources.map((r) => r.ou).filter(Boolean))];
  const accounts      = ["All", ...new Set(resources.map((r) => r.account_id).filter(Boolean))];
  const canEditTags   = user?.roles.includes("tag_editor") || user?.roles.includes("admin");

  /* ── Tag save ──────────────────────────────────────────────── */
  async function saveTags() {
    if (!editing) return;
    setSaving(true); setError(null);
    try {
      const response = await fetch("/api/tags/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource_id: editing.id, resource_type: editing.type, account_id: editing.account_id, tags: parseTagText(editing.tagsText) }),
      });
      if (response.status === 401) { window.location.href = "/api/auth/login"; return; }
      if (!response.ok) throw new Error(`Failed to update tags (${response.status})`);
      setEditing(null);
      await fetchResources();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update tags");
    } finally { setSaving(false); }
  }

  function handleEdit(r: Resource) {
    setEditing({ id: r.id, name: r.name, type: r.type, account_id: r.account_id, tagsText: Object.entries(r.tags).map(([k, v]) => `${k}=${v}`).join("\n") });
  }

  const initials = userInitials(user);

  /* ── Page content ──────────────────────────────────────────── */
  function renderPage() {
    switch (activePage) {
      case "overview":
        return <OverviewPage resources={resources} loading={loading} />;
      case "resources":
        return (
          <ResourcesPage
            resources={resources} loading={loading} error={error} refreshing={refreshing}
            canEditTags={!!canEditTags} filtered={filtered}
            search={search} setSearch={setSearch}
            typeFilter={typeFilter} setTypeFilter={setTypeFilter}
            regionFilter={regionFilter} setRegionFilter={setRegionFilter}
            ouFilter={ouFilter} setOuFilter={setOuFilter}
            accountFilter={accountFilter} setAccountFilter={setAccountFilter}
            tagFilter={tagFilter} setTagFilter={setTagFilter}
            resourceTypes={resourceTypes} regions={regions} ous={ous} accounts={accounts}
            onRefresh={() => void fetchResources(true)} onEdit={handleEdit}
          />
        );
      case "search":
        return <PlaceholderPage title="Global Search" description="Full-text search with facets across all resources, tags, and accounts. Coming soon." />;
      case "tag-editor":
        return <PlaceholderPage title="Tag Editor" description="Bulk tag operations, policy enforcement, and tag templates. Navigate to Resources to edit individual resource tags." />;
      case "accounts":
        return <PlaceholderPage title="Accounts & OUs" description="Visual org hierarchy, per-account compliance scores, and cross-account role switching. Coming soon." />;
      case "audit-logs":
        return <PlaceholderPage title="Audit Logs" description="Paginated audit trail filtered by action, account, user, and date range. Coming soon." />;
      case "settings":
        return <PlaceholderPage title="Settings" description="Profile, SSO configuration, default region preferences, and API token management. Coming soon." />;
      default:
        return null;
    }
  }

  const PAGE_TITLES: Record<NavPage, string> = {
    overview: "Overview",
    resources: "Resources",
    search: "Search",
    "tag-editor": "Tag Editor",
    accounts: "Accounts",
    "audit-logs": "Audit Logs",
    settings: "Settings",
  };

  /* ── Render ────────────────────────────────────────────────── */
  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      <div className="main-area">
        {/* Top Bar */}
        <header className="topbar">
          <h1 className="topbar-title" id="page-title">{PAGE_TITLES[activePage]}</h1>
          <div className="topbar-right">
            <button id="account-selector" className="account-selector">
              All Accounts
              <ChevronDownIcon />
            </button>
            <div className="user-avatar" id="user-avatar" title={user?.name || user?.email || "User"}>
              {initials}
            </div>
            <button className="user-menu-btn" id="user-menu-btn" aria-label="User menu">
              <ChevronDownIcon />
            </button>
          </div>
        </header>

        {/* Session Expiry Banner */}
        {expiringSoon && (
          <div className="expiry-banner">
            <span>⚠️ Your session expires in less than 5 minutes.</span>
            <a href="/api/auth/login">Re-authenticate</a>
          </div>
        )}

        {/* Content */}
        <div className="content-scroll" id="main-content">
          {renderPage()}
        </div>
      </div>

      {/* Tag Edit Modal */}
      {editing && (
        <div className="modal-backdrop" id="edit-modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" id="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-info">
                <p>Update tags</p>
                <h2>{editing.name}</h2>
              </div>
              <button id="modal-close-btn" className="btn-ghost btn-icon" onClick={() => setEditing(null)}><XIcon /></button>
            </div>
            <div className="modal-body">
              <label>
                Tags (one per line, key=value)
                <textarea
                  id="tags-textarea"
                  value={editing.tagsText}
                  onChange={(e) => setEditing({ ...editing, tagsText: e.target.value })}
                  rows={8}
                />
              </label>
            </div>
            <div className="modal-footer">
              <button id="modal-cancel-btn" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button id="modal-save-btn" className="btn-primary" onClick={() => void saveTags()} disabled={saving}>
                {saving ? "Saving…" : "Save tags"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
