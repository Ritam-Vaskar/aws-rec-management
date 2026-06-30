"use client";

import { InboxIcon } from "../components/Icons";

function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="panel" style={{ padding: "3rem 2rem", textAlign: "center" }}>
      <div className="empty-icon" style={{ margin: "0 auto 1rem" }}><InboxIcon /></div>
      <p className="empty-title" style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>{title}</p>
      <p className="empty-desc">{description}</p>
    </div>
  );
}

export default function SettingsPage() {
  return <PlaceholderPage title="Settings" description="Profile, SSO configuration, default region preferences, and API token management. Coming soon." />;
}
