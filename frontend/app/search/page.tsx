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

export default function SearchPage() {
  return <PlaceholderPage title="Global Search" description="Full-text search with facets across all resources, tags, and accounts. Coming soon." />;
}
