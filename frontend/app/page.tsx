"use client";

import { useEffect, useMemo, useState } from "react";

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
  tagsText: string;
} | null;

function parseTagText(value: string) {
  const tags: Record<string, string> = {};

  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [key, ...rest] = line.split("=");
      const tagValue = rest.join("=").trim();
      if (key && tagValue) {
        tags[key.trim()] = tagValue;
      }
    });

  return tags;
}

export default function Page() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [regionFilter, setRegionFilter] = useState("All");
  const [tagFilter, setTagFilter] = useState("");
  const [editing, setEditing] = useState<EditState>(null);
  const [saving, setSaving] = useState(false);

  async function fetchResources() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/resources");

      if (!response.ok) {
        throw new Error(`Failed to load resources (${response.status})`);
      }

      const data = (await response.json()) as Resource[];
      setResources(data);
    } catch (fetchError) {
      setResources([]);
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load resources");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchResources();
  }, []);

  const filtered = useMemo(() => {
    return resources.filter((resource) => {
      const matchesSearch =
        !search ||
        [resource.name, resource.id, resource.account_id, resource.ou, resource.type]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchesType = typeFilter === "All" || resource.type === typeFilter;
      const matchesRegion = regionFilter === "All" || resource.region === regionFilter;

      let matchesTag = true;
      if (tagFilter.trim()) {
        const [rawKey, ...rest] = tagFilter.split("=");
        const key = rawKey?.trim();
        const value = rest.join("=").trim();
        if (key) {
          matchesTag = value ? resource.tags[key] === value : key in resource.tags;
        }
      }

      return matchesSearch && matchesType && matchesRegion && matchesTag;
    });
  }, [resources, search, typeFilter, regionFilter, tagFilter]);

  const resourceTypes = ["All", ...new Set(resources.map((resource) => resource.type))];
  const regions = ["All", ...new Set(resources.map((resource) => resource.region))];
  const total = resources.length;
  const untagged = resources.filter((resource) => Object.keys(resource.tags).length === 0).length;
  const complianceScore = total ? Math.round(((total - untagged) / total) * 100) : 0;

  async function saveTags() {
    if (!editing) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/tags/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource_id: editing.id,
          resource_type: editing.type,
          tags: parseTagText(editing.tagsText),
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update tags (${response.status})`);
      }

      setEditing(null);
      await fetchResources();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update tags");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">AWS Resource Governance</p>
          <h1>Prototype dashboard for inventory, filtering, and tag repair.</h1>
          <p className="lede">
            This MVP uses a clean API boundary now, so the inventory source can be swapped from mock
            data to live AWS accounts without changing the UI flow.
          </p>
        </div>

        <div className="hero-stats">
          <div>
            <span>Total resources</span>
            <strong>{total}</strong>
          </div>
          <div>
            <span>Untagged</span>
            <strong>{untagged}</strong>
          </div>
          <div>
            <span>Compliance score</span>
            <strong>{complianceScore}%</strong>
          </div>
        </div>
      </section>

      <section className="panel filters">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, ARN, account, OU..." />
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
          {resourceTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)}>
          {regions.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>
        <input value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} placeholder="Tag filter, e.g. env=prod" />
        <button onClick={() => void fetchResources()}>Refresh</button>
      </section>

      <section className="panel">
        {error ? <div className="empty-state">{error}</div> : null}
        {loading ? (
          <div className="empty-state">Loading inventory...</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Region</th>
                  <th>OU</th>
                  <th>Tags</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((resource) => (
                  <tr key={`${resource.type}-${resource.id}`}>
                    <td>
                      <strong>{resource.name}</strong>
                      <span>{resource.id}</span>
                    </td>
                    <td>{resource.type}</td>
                    <td>{resource.region}</td>
                    <td>{resource.ou}</td>
                    <td>
                      {Object.keys(resource.tags).length === 0 ? (
                        <span className="tag missing">No tags</span>
                      ) : (
                        <div className="tag-list">
                          {Object.entries(resource.tags).map(([key, value]) => (
                            <span className="tag" key={`${resource.id}-${key}`}>
                              {key}={value}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <button
                        className="secondary"
                        onClick={() =>
                          setEditing({
                            id: resource.id,
                            name: resource.name,
                            type: resource.type,
                            tagsText: Object.entries(resource.tags)
                              .map(([key, value]) => `${key}=${value}`)
                              .join("\n"),
                          })
                        }
                      >
                        Edit tags
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing ? (
        <section className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal panel" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <p className="eyebrow">Update tags</p>
                <h2>{editing.name}</h2>
              </div>
              <button className="secondary" onClick={() => setEditing(null)}>
                Close
              </button>
            </div>

            <label>
              Tags, one per line
              <textarea value={editing.tagsText} onChange={(event) => setEditing({ ...editing, tagsText: event.target.value })} rows={8} />
            </label>

            <div className="modal-actions">
              <button className="secondary" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button onClick={() => void saveTags()} disabled={saving}>
                {saving ? "Saving..." : "Save tags"}
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}