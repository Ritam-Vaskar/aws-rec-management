"use client";

import { useEffect, useState } from "react";
import { FileTextIcon, InboxIcon, ErrorIcon } from "../components/Icons";

type AuditEvent = {
  timestamp: string;
  action: string;
  subject: string;
  email: string;
  tenant_id: string;
  roles: string[];
  [key: string]: any;
};

export default function AuditLogsPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAudit() {
      try {
        const res = await fetch("/api/audit");
        if (!res.ok) throw new Error("Failed to fetch audit logs");
        const data = await res.json();
        setEvents(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    void fetchAudit();
  }, []);

  if (loading) return <div style={{ padding: "2rem" }}>Loading audit logs...</div>;
  if (error) return <div style={{ padding: "2rem", color: "var(--danger)" }}><ErrorIcon /> {error}</div>;

  return (
    <div className="panel" style={{ marginBottom: "2rem" }}>
      <div className="table-toolbar">
        <div className="table-toolbar-left">
          <span className="table-toolbar-title">Audit Trail</span>
          <span className="table-toolbar-count">{events.length} records</span>
        </div>
      </div>
      
      {events.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><InboxIcon /></div>
          <p className="empty-title">No audit logs found</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>User / Subject</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {events.map((evt, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: "nowrap" }}>{new Date(evt.timestamp).toLocaleString()}</td>
                  <td>
                    <span style={{ 
                      background: evt.action.includes("denied") ? "var(--danger-subtle)" : "var(--primary-subtle)", 
                      color: evt.action.includes("denied") ? "var(--danger)" : "var(--primary)",
                      padding: "0.2rem 0.5rem", borderRadius: "4px", fontSize: "0.85rem", fontWeight: "600"
                    }}>
                      {evt.action}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: "500", color: "var(--text)" }}>{evt.email || evt.subject}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Tenant: {evt.tenant_id}</div>
                  </td>
                  <td style={{ fontSize: "0.85rem", fontFamily: "monospace", color: "var(--text-muted)" }}>
                    {Object.entries(evt)
                      .filter(([k]) => !["timestamp", "action", "subject", "email", "tenant_id", "roles"].includes(k))
                      .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(",") : v}`)
                      .join(" | ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
