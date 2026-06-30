"use client";

import { useEffect, useState } from "react";
import { UsersIcon, ServerIcon, AlertIcon, ShieldIcon, InboxIcon, ErrorIcon } from "../components/Icons";

type AccountItem = {
  account_id: string;
  ou: string;
  resource_count: number;
  untagged_count: number;
  compliance_score: number;
};

function complianceClass(score: number) {
  if (score < 50) return "low";
  if (score < 80) return "medium";
  return "high";
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await fetch("/api/accounts");
        if (!res.ok) throw new Error("Failed to fetch accounts");
        const data = await res.json();
        setAccounts(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    void fetchAccounts();
  }, []);

  // Group by OU
  const ouGroups = accounts.reduce((acc, account) => {
    const ouName = account.ou || "Root";
    if (!acc[ouName]) acc[ouName] = [];
    acc[ouName].push(account);
    return acc;
  }, {} as Record<string, AccountItem[]>);

  if (loading) return <div style={{ padding: "2rem" }}>Loading accounts...</div>;
  if (error) return <div style={{ padding: "2rem", color: "var(--danger)", display: "flex", alignItems: "center", gap: "0.5rem" }}><span style={{ width: 18, height: 18, display: "inline-flex", flexShrink: 0 }}><ErrorIcon /></span> {error}</div>;
  if (accounts.length === 0) return (
    <div className="empty-state" style={{ marginTop: "2rem" }}>
      <div className="empty-icon"><InboxIcon /></div>
      <p className="empty-title">No accounts found</p>
    </div>
  );

  return (
    <>
      <div className="panel" style={{ marginBottom: "2rem" }}>
        <div className="panel-header">
          <div className="panel-title">Organizational Units (OUs)</div>
        </div>
        <div style={{ padding: "1.5rem" }}>
          {Object.entries(ouGroups).map(([ou, accs]) => (
            <div key={ou} style={{ marginBottom: "2rem" }}>
              <h3 style={{ marginBottom: "1rem", color: "var(--text)", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1rem" }}>
                <span style={{ width: 16, height: 16, display: "inline-flex", flexShrink: 0 }}><UsersIcon /></span>
                {ou} <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: "normal" }}>({accs.length} accounts)</span>
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
                {accs.map(a => (
                  <div key={a.account_id} style={{
                    background: "var(--panel-bg)", border: "1px solid var(--border)", borderRadius: "8px", padding: "1rem"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                      <div>
                        <div style={{ fontFamily: "monospace", fontSize: "1.1rem", fontWeight: "600", color: "var(--text)" }}>{a.account_id}</div>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>AWS Account</div>
                      </div>
                      <div className={`badge-${complianceClass(a.compliance_score)}`} style={{ padding: "0.25rem 0.5rem", borderRadius: "4px", fontSize: "0.85rem", fontWeight: "bold" }}>
                        {a.compliance_score}% Compliant
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "1rem", fontSize: "0.9rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--text-muted)" }}>
                        <span style={{ width: 14, height: 14, display: "inline-flex", flexShrink: 0 }}><ServerIcon /></span> {a.resource_count} resources
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: a.untagged_count > 0 ? "var(--warning)" : "var(--success)" }}>
                        <span style={{ width: 14, height: 14, display: "inline-flex", flexShrink: 0 }}>{a.untagged_count > 0 ? <AlertIcon /> : <ShieldIcon />}</span> {a.untagged_count} untagged
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
