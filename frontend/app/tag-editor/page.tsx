"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertIcon,
  ErrorIcon,
  InboxIcon,
  RefreshIcon,
  ServerIcon,
  ShieldIcon,
  TagIcon,
} from "../components/Icons";

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

type BulkResult = {
  resource_id: string;
  resource_type: string;
  account_id?: string | null;
  status: "ok" | "failed" | "denied";
  detail?: string;
  tags?: Record<string, string>;
};

type BulkResponse = {
  status: "ok" | "partial";
  requested: number;
  succeeded: number;
  failed: number;
  results: BulkResult[];
};

function parseTagText(value: string) {
  const tags: Record<string, string> = {};
  const errors: string[] = [];

  value.split("\n").forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;

    const [rawKey, ...rest] = line.split("=");
    const key = rawKey.trim();
    const tagValue = rest.join("=").trim();

    if (!key || rest.length === 0) {
      errors.push(`Line ${index + 1} must use key=value.`);
      return;
    }
    tags[key] = tagValue;
  });

  return { tags, errors };
}

function parseTagKeys(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((key) => key.trim())
        .filter(Boolean),
    ),
  );
}

function matchesTagFilter(resource: Resource, tagFilter: string) {
  const filter = tagFilter.trim();
  if (!filter) return true;

  const [rawKey, ...rest] = filter.split("=");
  const key = rawKey.trim();
  const value = rest.join("=").trim();
  if (!key) return true;
  return value ? resource.tags[key] === value : key in resource.tags;
}

function SkeletonRows() {
  return (
    <>
      {[...Array(6)].map((_, index) => (
        <div key={index} className="skeleton-row">
          <div className="skeleton-bar" style={{ width: "4%" }} />
          <div className="skeleton-bar" style={{ width: "28%" }} />
          <div className="skeleton-bar" style={{ width: "16%" }} />
          <div className="skeleton-bar" style={{ width: "12%" }} />
          <div className="skeleton-bar" style={{ width: "24%" }} />
        </div>
      ))}
    </>
  );
}

export default function TagEditorPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canEditTags, setCanEditTags] = useState(false);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [regionFilter, setRegionFilter] = useState("All");
  const [ouFilter, setOuFilter] = useState("All");
  const [accountFilter, setAccountFilter] = useState("All");
  const [tagFilter, setTagFilter] = useState("");
  const [onlyUntagged, setOnlyUntagged] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tagText, setTagText] = useState("Environment=Production\nOwner=");
  const [removeText, setRemoveText] = useState("");
  const [results, setResults] = useState<BulkResult[]>([]);
  const [summary, setSummary] = useState<string | null>(null);

  const fetchResources = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/resources${force ? "?force_refresh=true" : ""}`);
      if (response.status === 401) {
        window.location.href = "/api/auth/login";
        return;
      }
      if (!response.ok) throw new Error(`Failed to load resources (${response.status})`);
      setResources((await response.json()) as Resource[]);
    } catch (e) {
      setResources([]);
      setError(e instanceof Error ? e.message : "Failed to load resources");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    async function checkAuth() {
      const session = await fetch("/api/auth/me", { cache: "no-store" });
      if (session.status === 401) {
        window.location.href = "/api/auth/login";
        return;
      }
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
    return resources.filter((resource) => {
      const haystack = [
        resource.name,
        resource.id,
        resource.account_id,
        resource.ou,
        resource.type,
        resource.region,
        ...Object.entries(resource.tags).map(([key, value]) => `${key}=${value}`),
      ].join(" ").toLowerCase();

      return (
        (!search || haystack.includes(search.toLowerCase())) &&
        (typeFilter === "All" || resource.type === typeFilter) &&
        (regionFilter === "All" || resource.region === regionFilter) &&
        (ouFilter === "All" || resource.ou === ouFilter) &&
        (accountFilter === "All" || resource.account_id === accountFilter) &&
        (!onlyUntagged || Object.keys(resource.tags).length === 0) &&
        matchesTagFilter(resource, tagFilter)
      );
    });
  }, [accountFilter, onlyUntagged, ouFilter, regionFilter, resources, search, tagFilter, typeFilter]);

  const resourceTypes = useMemo(() => ["All", ...Array.from(new Set(resources.map((r) => r.type))).sort()], [resources]);
  const regions = useMemo(() => ["All", ...Array.from(new Set(resources.map((r) => r.region).filter(Boolean))).sort()], [resources]);
  const ous = useMemo(() => ["All", ...Array.from(new Set(resources.map((r) => r.ou).filter(Boolean))).sort()], [resources]);
  const accounts = useMemo(() => ["All", ...Array.from(new Set(resources.map((r) => r.account_id).filter(Boolean))).sort()], [resources]);

  const selectedResources = useMemo(() => resources.filter((resource) => selectedIds.has(resource.id)), [resources, selectedIds]);
  const parsedTags = useMemo(() => parseTagText(tagText), [tagText]);
  const removeKeys = useMemo(() => parseTagKeys(removeText), [removeText]);
  const previewTags = Object.entries(parsedTags.tags);
  const selectedVisibleCount = filtered.filter((resource) => selectedIds.has(resource.id)).length;
  const allVisibleSelected = filtered.length > 0 && selectedVisibleCount === filtered.length;
  const hasChanges = previewTags.length > 0 || removeKeys.length > 0;
  const canApply = canEditTags && selectedResources.length > 0 && hasChanges && parsedTags.errors.length === 0 && !saving;

  const untagged = resources.filter((resource) => Object.keys(resource.tags).length === 0).length;
  const affectedAccounts = new Set(selectedResources.map((resource) => resource.account_id).filter(Boolean)).size;

  function toggleVisibleSelection() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        filtered.forEach((resource) => next.delete(resource.id));
      } else {
        filtered.forEach((resource) => next.add(resource.id));
      }
      return next;
    });
  }

  function toggleResource(resourceId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(resourceId)) next.delete(resourceId);
      else next.add(resourceId);
      return next;
    });
  }

  function selectUntagged() {
    setSelectedIds(new Set(filtered.filter((resource) => Object.keys(resource.tags).length === 0).map((resource) => resource.id)));
  }

  async function applyBulkTags() {
    if (!canApply) return;

    setSaving(true);
    setError(null);
    setSummary(null);
    setResults([]);

    try {
      const response = await fetch("/api/tags/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resources: selectedResources.map((resource) => ({
            resource_id: resource.id,
            resource_type: resource.type,
            account_id: resource.account_id,
            tags: resource.tags,
          })),
          tags: parsedTags.tags,
          remove_tag_keys: removeKeys,
        }),
      });

      if (response.status === 401) {
        window.location.href = "/api/auth/login";
        return;
      }
      if (!response.ok) throw new Error(`Bulk update failed (${response.status})`);

      const data = (await response.json()) as BulkResponse;
      setResults(data.results);
      setSummary(`${data.succeeded} updated, ${data.failed} failed`);

      const tagUpdates = new Map(data.results.filter((item) => item.status === "ok" && item.tags).map((item) => [item.resource_id, item.tags as Record<string, string>]));
      if (tagUpdates.size > 0) {
        setResources((current) => current.map((resource) => (
          tagUpdates.has(resource.id) ? { ...resource, tags: tagUpdates.get(resource.id)! } : resource
        )));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to apply bulk tags");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="stats-row" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: "1rem" }}>
        <div className="stat-card">
          <div className="stat-body">
            <div className="stat-label">Inventory</div>
            <div className="stat-value">{resources.length.toLocaleString()}</div>
            <div className="stat-detail">{filtered.length} matching filters</div>
          </div>
          <div className="stat-icon-wrap icon-blue"><ServerIcon /></div>
        </div>
        <div className="stat-card">
          <div className="stat-body">
            <div className="stat-label">Selected</div>
            <div className="stat-value">{selectedResources.length.toLocaleString()}</div>
            <div className="stat-detail">{affectedAccounts} account{affectedAccounts === 1 ? "" : "s"}</div>
          </div>
          <div className="stat-icon-wrap icon-green"><TagIcon /></div>
        </div>
        <div className="stat-card">
          <div className="stat-body">
            <div className="stat-label">Untagged</div>
            <div className="stat-value">{untagged.toLocaleString()}</div>
            <div className="stat-detail">{resources.length ? `${Math.round((untagged / resources.length) * 100)}% need coverage` : "No data"}</div>
          </div>
          <div className="stat-icon-wrap" style={{ background: "var(--warning-subtle)", color: "var(--warning)" }}><AlertIcon /></div>
        </div>
        <div className="stat-card">
          <div className="stat-body">
            <div className="stat-label">Access</div>
            <div className="stat-value" style={{ fontSize: "1.2rem", lineHeight: 1.3 }}>{canEditTags ? "Editor" : "Read only"}</div>
            <div className="stat-detail">{canEditTags ? "Bulk updates enabled" : "Tag editor role required"}</div>
          </div>
          <div className="stat-icon-wrap" style={{ background: "var(--success-subtle)", color: "var(--success)" }}><ShieldIcon /></div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <div className="filters-panel">
          <div className="filter-group">
            <span className="filter-label">Search</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, ID, tag, account..." />
          </div>
          <div className="filter-group">
            <span className="filter-label">Type</span>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              {resourceTypes.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <span className="filter-label">Region</span>
            <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
              {regions.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <span className="filter-label">OU</span>
            <select value={ouFilter} onChange={(e) => setOuFilter(e.target.value)}>
              {ous.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <span className="filter-label">Account</span>
            <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
              {accounts.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <span className="filter-label">Tag</span>
            <input value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} placeholder="Owner or env=prod" />
          </div>
          <div className="filter-group" style={{ minWidth: 130 }}>
            <span className="filter-label">Coverage</span>
            <label className="inline-check">
              <input type="checkbox" checked={onlyUntagged} onChange={(e) => setOnlyUntagged(e.target.checked)} />
              Untagged only
            </label>
          </div>
          <div className="filter-group" style={{ justifyContent: "flex-end" }}>
            <span className="filter-label">&nbsp;</span>
            <button className="btn-secondary" onClick={() => fetchResources(true)} disabled={loading || refreshing}>
              <RefreshIcon /> {refreshing ? "Syncing..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      <div className="tag-editor-grid">
        <div className="panel resource-table-panel">
          <div className="table-toolbar">
            <div className="table-toolbar-left">
              <span className="table-toolbar-title">Bulk Selection</span>
              <span className="table-toolbar-count">{filtered.length} items</span>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button className="btn-secondary btn-sm" onClick={selectUntagged} disabled={loading}>Select untagged</button>
              <button className="btn-secondary btn-sm" onClick={() => setSelectedIds(new Set())} disabled={selectedResources.length === 0}>Clear</button>
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
              <p className="empty-desc">Adjust filters or refresh inventory.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleVisibleSelection}
                        aria-label="Select all visible resources"
                      />
                    </th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Region</th>
                    <th>Account</th>
                    <th>Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((resource) => (
                    <tr key={`${resource.type}-${resource.id}`}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(resource.id)}
                          onChange={() => toggleResource(resource.id)}
                          aria-label={`Select ${resource.name}`}
                        />
                      </td>
                      <td>
                        <div className="cell-name">
                          <span className="cell-name-text">{resource.name}</span>
                          <span className="cell-name-id">{resource.id.length > 42 ? `${resource.id.slice(0, 42)}...` : resource.id}</span>
                        </div>
                      </td>
                      <td>{resource.type}</td>
                      <td>{resource.region || "--"}</td>
                      <td>{resource.account_id || "--"}</td>
                      <td>
                        {Object.keys(resource.tags).length === 0 ? (
                          <span className="tag missing">No tags</span>
                        ) : (
                          <div className="tag-list">
                            {Object.entries(resource.tags).slice(0, 4).map(([key, value]) => (
                              <span className="tag" key={`${resource.id}-${key}`}>{key}={value}</span>
                            ))}
                            {Object.keys(resource.tags).length > 4 && <span className="tag">+{Object.keys(resource.tags).length - 4}</span>}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="panel tag-editor-panel">
          <div className="panel-header">
            <div className="panel-title">Bulk Tag Operation</div>
            <div className="panel-subtitle">{selectedResources.length} resources selected</div>
          </div>
          <div className="panel-body tag-editor-body">
            <label>
              Add or overwrite tags
              <textarea value={tagText} onChange={(e) => setTagText(e.target.value)} rows={5} placeholder="Environment=Production&#10;Owner=Platform" />
            </label>
            <label>
              Remove tag keys
              <textarea value={removeText} onChange={(e) => setRemoveText(e.target.value)} rows={3} placeholder="Temporary&#10;CostCenter" />
            </label>

            {parsedTags.errors.length > 0 && (
              <div className="tag-editor-error">
                {parsedTags.errors.map((item) => <div key={item}>{item}</div>)}
              </div>
            )}

            <div className="tag-preview">
              <div className="tag-preview-title">Preview</div>
              <div className="tag-list">
                {previewTags.map(([key, value]) => <span className="tag" key={key}>Set {key}={value}</span>)}
                {removeKeys.map((key) => <span className="tag missing" key={key}>Remove {key}</span>)}
                {!hasChanges && <span className="empty-desc">No changes configured.</span>}
              </div>
            </div>

            <button className="btn-primary tag-editor-apply" onClick={() => void applyBulkTags()} disabled={!canApply}>
              <TagIcon /> {saving ? "Applying..." : `Apply to ${selectedResources.length} resources`}
            </button>

            {!canEditTags && <p className="empty-desc">Your current role can view resources but cannot update tags.</p>}
            {summary && <div className="tag-editor-summary">{summary}</div>}

            {results.length > 0 && (
              <div className="tag-result-list">
                {results.slice(0, 8).map((item) => (
                  <div className={`tag-result ${item.status}`} key={`${item.resource_type}-${item.resource_id}`}>
                    <span>{item.status.toUpperCase()}</span>
                    <p>{item.resource_id}</p>
                    {item.detail && <small>{item.detail}</small>}
                  </div>
                ))}
                {results.length > 8 && <p className="empty-desc">Showing 8 of {results.length} results.</p>}
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
