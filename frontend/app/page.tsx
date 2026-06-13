"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "@/lib/theme";

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

type EditState = {
  id: string;
  name: string;
  type: string;
  account_id: string;
  tagsText: string;
} | null;

function parseTagText(value: string) {
  const tags: Record<string, string> = {};
  value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [key, ...rest] = line.split("=");
      const v = rest.join("=").trim();
      if (key && v) tags[key.trim()] = v;
    });
  return tags;
}

function typeDot(type: string) {
  const lower = type.toLowerCase();
  if (lower.includes("s3")) return "dot-s3";
  if (lower.includes("ec2")) return "dot-ec2";
  if (lower.includes("rds")) return "dot-rds";
  if (lower.includes("load") || lower.includes("elb")) return "dot-lb";
  return "dot-other";
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

/* ── Icons (inline SVG) ──────────────────────────────────── */

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
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

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ServerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
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

function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
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
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

/* ── Skeleton Rows ────────────────────────────────────────── */

function SkeletonRows() {
  return (
    <>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="skeleton-row">
          <div className="skeleton-bar" style={{ width: "25%" }} />
          <div className="skeleton-bar" style={{ width: "12%" }} />
          <div className="skeleton-bar" style={{ width: "10%" }} />
          <div className="skeleton-bar" style={{ width: "8%" }} />
          <div className="skeleton-bar" style={{ width: "20%" }} />
          <div className="skeleton-bar" style={{ width: "8%" }} />
        </div>
      ))}
    </>
  );
}

/* ── Theme Toggle ─────────────────────────────────────────── */

function ThemeToggle() {
  const { resolved, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="theme-toggle" aria-label="Toggle theme">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" />
      </button>
    );
  }

  const isDark = resolved === "dark";
  return (
    <button
      className="theme-toggle"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

/* ── Main Page ────────────────────────────────────────────── */

export default function Page() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [regionFilter, setRegionFilter] = useState("All");
  const [ouFilter, setOuFilter] = useState("All");
  const [accountFilter, setAccountFilter] = useState("All");
  const [tagFilter, setTagFilter] = useState("");
  const [editing, setEditing] = useState<EditState>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchResources(force = false) {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:8000/resources${force ? "?force_refresh=true" : ""}`);
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
            const res = await fetch("http://localhost:8000/resources");
            if (res.ok) setResources((await res.json()) as Resource[]);
          } finally {
            setRefreshing(false);
          }
        }, 3000);
      } else {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void fetchResources();
  }, []);

  const filtered = useMemo(() => {
    return resources.filter((r) => {
      const matchesSearch =
        !search ||
        [r.name, r.id, r.account_id, r.ou, r.type]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchesType = typeFilter === "All" || r.type === typeFilter;
      const matchesRegion = regionFilter === "All" || r.region === regionFilter;
      const matchesOu = ouFilter === "All" || r.ou === ouFilter;
      const matchesAccount = accountFilter === "All" || r.account_id === accountFilter;

      let matchesTag = true;
      if (tagFilter.trim()) {
        const [rawKey, ...rest] = tagFilter.split("=");
        const key = rawKey?.trim();
        const value = rest.join("=").trim();
        if (key) {
          matchesTag = value ? r.tags[key] === value : key in r.tags;
        }
      }
      return matchesSearch && matchesType && matchesRegion && matchesOu && matchesAccount && matchesTag;
    });
  }, [resources, search, typeFilter, regionFilter, tagFilter, ouFilter, accountFilter]);

  const resourceTypes = ["All", ...new Set(resources.map((r) => r.type))];
  const regions = ["All", ...new Set(resources.map((r) => r.region))];
  const ous = ["All", ...new Set(resources.map((r) => r.ou).filter(Boolean))];
  const accounts = ["All", ...new Set(resources.map((r) => r.account_id).filter(Boolean))];
  const total = resources.length;
  const untagged = resources.filter((r) => Object.keys(r.tags).length === 0).length;
  const complianceScore = total ? Math.round(((total - untagged) / total) * 100) : 0;

  async function saveTags() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:8000/tags/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource_id: editing.id,
          resource_type: editing.type,
          account_id: editing.account_id,
          tags: parseTagText(editing.tagsText),
        }),
      });
      if (!response.ok) throw new Error(`Failed to update tags (${response.status})`);
      setEditing(null);
      await fetchResources();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update tags");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="shell">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <div className="logo-icon">AWS</div>
            <span className="logo-text">Resource Governance</span>
          </div>
        </div>
        <div className="header-right">
          <ThemeToggle />
        </div>
      </header>

      {/* ── Stats ──────────────────────────────────────────── */}
      <section className="stats-row">
        <div className="stat-card">
          <div className="stat-icon primary">
            <ServerIcon />
          </div>
          <div className="stat-body">
            <span className="stat-label">Total Resources</span>
            <span className="stat-value">{total}</span>
            <span className="stat-detail">{filtered.length} shown after filters</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon warning">
            <AlertIcon />
          </div>
          <div className="stat-body">
            <span className="stat-label">Untagged</span>
            <span className="stat-value">{untagged}</span>
            <span className="stat-detail">{total ? `${Math.round((untagged / total) * 100)}% of inventory` : "No data"}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon success">
            <ShieldIcon />
          </div>
          <div className="stat-body">
            <span className="stat-label">Compliance Score</span>
            <span className="stat-value">{complianceScore}%</span>
            <div className="compliance-bar">
              <div
                className={`compliance-bar-fill ${complianceClass(complianceScore)}`}
                style={{ width: `${complianceScore}%` }}
              />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon accent">
            <TagIcon />
          </div>
          <div className="stat-body">
            <span className="stat-label">Resource Types</span>
            <span className="stat-value">{resourceTypes.length - 1}</span>
            <span className="stat-detail">{regions.length - 1} regions</span>
          </div>
        </div>
      </section>

      {/* ── Filters ───────────────────────────────────────── */}
      <section className="panel filters">
        <div className="filter-group">
          <span className="filter-label">Search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, ID, account, OU..."
          />
        </div>
        <div className="filter-group">
          <span className="filter-label">Type</span>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            {resourceTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <span className="filter-label">Region</span>
          <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <span className="filter-label">OU</span>
          <select value={ouFilter} onChange={(e) => setOuFilter(e.target.value)}>
            {ous.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <span className="filter-label">Account</span>
          <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
            {accounts.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <span className="filter-label">Tag</span>
          <input
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            placeholder="env=prod"
          />
        </div>
        <div className="filter-group" style={{ justifyContent: "flex-end" }}>
          <span className="filter-label">&nbsp;</span>
          <button className="btn-secondary" onClick={() => void fetchResources(true)} disabled={loading || refreshing}>
            <RefreshIcon /> {refreshing ? "Syncing..." : "Refresh"}
          </button>
        </div>
      </section>

      {/* ── Table ──────────────────────────────────────────── */}
      <section className="panel">
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
            <button className="btn-secondary btn-sm" onClick={() => void fetchResources()}>
              <RefreshIcon /> Retry
            </button>
          </div>
        ) : null}

        {loading ? (
          <SkeletonRows />
        ) : !error && filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><InboxIcon /></div>
            <p className="empty-title">No resources found</p>
            <p className="empty-desc">Try adjusting your filters or refresh the inventory.</p>
          </div>
        ) : !error ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Region</th>
                  <th>State</th>
                  <th>Tags</th>
                  <th style={{ width: 100 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={`${r.type}-${r.id}`}>
                    <td>
                      <div className="cell-name">
                        <span className="cell-name-text">{r.name}</span>
                        <span className="cell-name-id">{r.id.length > 40 ? `${r.id.slice(0, 40)}...` : r.id}</span>
                      </div>
                    </td>
                    <td>
                      <span className="cell-type">
                        <span className={`cell-type-dot ${typeDot(r.type)}`} />
                        {r.type}
                      </span>
                    </td>
                    <td>{r.region}</td>
                    <td>
                      {r.state ? (
                        <span className={`cell-state ${stateClass(r.state)}`}>{r.state}</span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>--</span>
                      )}
                    </td>
                    <td>
                      {Object.keys(r.tags).length === 0 ? (
                        <span className="tag missing">No tags</span>
                      ) : (
                        <div className="tag-list">
                          {Object.entries(r.tags).map(([k, v]) => (
                            <span className="tag" key={`${r.id}-${k}`}>{k}={v}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() =>
                          setEditing({
                            id: r.id,
                            name: r.name,
                            type: r.type,
                            account_id: r.account_id,
                            tagsText: Object.entries(r.tags)
                              .map(([k, v]) => `${k}=${v}`)
                              .join("\n"),
                          })
                        }
                      >
                        <EditIcon /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {/* ── Edit Modal ─────────────────────────────────────── */}
      {editing ? (
        <section className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-info">
                <p>Update tags</p>
                <h2>{editing.name}</h2>
              </div>
              <button className="btn-ghost btn-icon" onClick={() => setEditing(null)}>
                <XIcon />
              </button>
            </div>
            <div className="modal-body">
              <label>
                Tags (one per line, key=value)
                <textarea
                  value={editing.tagsText}
                  onChange={(e) => setEditing({ ...editing, tagsText: e.target.value })}
                  rows={8}
                />
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={() => void saveTags()} disabled={saving}>
                {saving ? "Saving..." : "Save tags"}
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
