"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ServerIcon, AlertIcon, ShieldIcon, RefreshIcon, InboxIcon, ErrorIcon,
  EditIcon, XIcon, Ec2Icon, S3Icon, RdsIcon, LbIcon, OtherIcon
} from "../components/Icons";

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

type EditState = {
  id: string;
  name: string;
  type: string;
  account_id: string;
  tagsText: string;
} | null;

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

/* ── Main Page ───────────────────────────────────────────────── */
export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [regionFilter, setRegionFilter] = useState("All");
  const [ouFilter, setOuFilter] = useState("All");
  const [accountFilter, setAccountFilter] = useState("All");
  const [tagFilter, setTagFilter] = useState("");

  const [editing, setEditing] = useState<EditState>(null);
  const [saving, setSaving] = useState(false);
  const [canEditTags, setCanEditTags] = useState(false);

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
    async function checkAuth() {
      const session = await fetch("/api/auth/me", { cache: "no-store" });
      if (session.ok) {
        const data = await session.json();
        const roles = data.user?.roles || [];
        setCanEditTags(roles.includes("tag_editor") || roles.includes("admin"));
      }
    }
    void checkAuth();
    void fetchResources();
  }, [fetchResources]);

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

  const total = resources.length;
  const untagged = resources.filter((r) => Object.keys(r.tags).length === 0).length;
  const complianceScore = total ? Math.round(((total - untagged) / total) * 100) : 0;

  return (
    <>
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

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <div className="filters-panel">
          <div className="filter-group">
            <span className="filter-label">Search</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, ID, account, OU..." />
          </div>
          <div className="filter-group">
            <span className="filter-label">Type</span>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              {resourceTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <span className="filter-label">Region</span>
            <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <span className="filter-label">OU</span>
            <select value={ouFilter} onChange={(e) => setOuFilter(e.target.value)}>
              {ous.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <span className="filter-label">Account</span>
            <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
              {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <span className="filter-label">Tag</span>
            <input value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} placeholder="env=prod" />
          </div>
          <div className="filter-group" style={{ justifyContent: "flex-end" }}>
            <span className="filter-label">&nbsp;</span>
            <button className="btn-secondary" onClick={() => fetchResources(true)} disabled={loading || refreshing}>
              <RefreshIcon /> {refreshing ? "Syncing…" : "Refresh"}
            </button>
          </div>
        </div>
      </div>

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
            <button className="btn-secondary btn-sm" onClick={() => fetchResources()}><RefreshIcon /> Retry</button>
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
                        <button className="btn-ghost btn-sm" onClick={() => setEditing({ id: r.id, name: r.name, type: r.type, account_id: r.account_id, tagsText: Object.entries(r.tags).map(([k, v]) => `${k}=${v}`).join("\n") })}>
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

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-info">
                <p>Update tags</p>
                <h2>{editing.name}</h2>
              </div>
              <button className="btn-ghost btn-icon" onClick={() => setEditing(null)}><XIcon /></button>
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
              <button className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary" onClick={() => void saveTags()} disabled={saving}>
                {saving ? "Saving…" : "Save tags"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
