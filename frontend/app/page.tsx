"use client";

import { useEffect, useState, useCallback } from "react";
import { UsersIcon, Ec2Icon, S3Icon, RdsIcon } from "./components/Icons";

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

function resourceTypeKey(type: string) {
  const lower = type.toLowerCase();
  if (lower.includes("ec2")) return "ec2";
  if (lower.includes("s3")) return "s3";
  if (lower.includes("rds")) return "rds";
  if (lower.includes("load") || lower.includes("elb")) return "lb";
  return "other";
}

function relativeTime(index: number): string {
  const times = ["2m ago", "15m ago", "1h ago", "3h ago", "6h ago", "12h ago", "1d ago"];
  return times[index % times.length];
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
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={18} />
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
        <g fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.25)" strokeWidth="0.8">
          <path d="M 40 60 L 130 55 L 145 80 L 140 120 L 120 140 L 100 160 L 70 155 L 50 130 L 30 100 Z" />
          <path d="M 85 170 L 120 165 L 130 200 L 120 240 L 100 260 L 80 250 L 70 220 L 75 185 Z" />
          <path d="M 215 45 L 265 40 L 280 60 L 270 90 L 240 100 L 215 85 Z" />
          <path d="M 225 105 L 270 100 L 285 130 L 280 180 L 255 210 L 225 200 L 210 165 L 215 130 Z" />
          <path d="M 285 35 L 430 30 L 445 65 L 430 100 L 380 110 L 320 105 L 285 80 Z" />
          <path d="M 380 170 L 440 165 L 455 200 L 440 225 L 390 220 L 375 200 Z" />
          <path d="M 208 55 L 216 52 L 218 65 L 210 67 Z" />
        </g>
        {[70, 140, 210].map((y) => <line key={y} x1="0" y1={y} x2="500" y2={y} stroke="rgba(59,130,246,0.06)" strokeWidth="0.5" />)}
        {[100, 200, 300, 400].map((x) => <line key={x} x1={x} y1="0" x2={x} y2="280" stroke="rgba(59,130,246,0.06)" strokeWidth="0.5" />)}
        {dots.map((dot) => (
          <g key={dot.id}>
            <circle cx={dot.cx} cy={dot.cy} r="8" fill="rgba(59,130,246,0.15)" style={{ animationDelay: dot.delay }} className="map-dot-pulse" />
            <circle cx={dot.cx} cy={dot.cy} r="4" fill="#3b82f6" />
            <circle cx={dot.cx} cy={dot.cy} r="2.5" fill="#93c5fd" />
          </g>
        ))}
      </svg>
    </div>
  );
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

interface OverviewCounts {
  accounts: number; ec2: number; s3: number; rds: number; lb: number; other: number; total: number;
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

function buildRegionCounts(resources: Resource[]) {
  const map = new Map<string, number>();
  for (const r of resources) {
    map.set(r.region, (map.get(r.region) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([region, count]) => ({ region, count }));
}

const FALLBACK_COUNTS: OverviewCounts = { accounts: 24, ec2: 1298, s3: 342, rds: 112, lb: 236, other: 27, total: 2457 };
const FALLBACK_REGIONS = [
  { region: "us-east-1", count: 842 }, { region: "ap-south-1", count: 612 }, { region: "eu-west-1", count: 421 },
  { region: "us-west-2", count: 312 }, { region: "others", count: 270 },
];
const STATIC_RECENT = [
  { id: "i-0abc123def456", typeKey: "ec2", typeLabel: "EC2 Instance", account_id: "123456789012", changedBy: "ritam.vaskar" },
  { id: "my-bucket-prod", typeKey: "s3", typeLabel: "S3 Bucket", account_id: "210987654321", changedBy: "ritam.vaskar" },
  { id: "db-production-1", typeKey: "rds", typeLabel: "RDS Instance", account_id: "123456789012", changedBy: "ritam.vaskar" },
];

export default function OverviewPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchResources() {
      try {
        const response = await fetch("/api/resources");
        if (response.ok) {
          const data = (await response.json()) as Resource[];
          setResources(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    void fetchResources();
  }, []);

  const hasData = resources.length > 0;
  const counts = hasData ? buildCounts(resources) : FALLBACK_COUNTS;
  const regionCounts = hasData ? buildRegionCounts(resources) : FALLBACK_REGIONS;

  const total = counts.total || 1;
  const segments: DonutSegment[] = [
    { key: "ec2",   label: "EC2 Instances",  pct: (counts.ec2   / total) * 100, color: "#3b82f6" },
    { key: "s3",    label: "S3 Buckets",     pct: (counts.s3    / total) * 100, color: "#10b981" },
    { key: "rds",   label: "RDS Instances",  pct: (counts.rds   / total) * 100, color: "#06b6d4" },
    { key: "lb",    label: "Load Balancers", pct: (counts.lb    / total) * 100, color: "#f59e0b" },
    { key: "other", label: "Others",         pct: (counts.other / total) * 100, color: "#a855f7" },
  ].filter((s) => s.pct > 0);

  const recentResources = hasData ? [...resources].reverse().slice(0, 8) : STATIC_RECENT;

  return (
    <>
      <div className="stats-row">
        <div className="stat-card card-accounts">
          <div className="stat-body">
            <div className="stat-label">AWS Accounts</div>
            <div className="stat-value">{counts.accounts}</div>
            <div className="stat-detail">Active Accounts</div>
          </div>
          <div className="stat-icon-wrap icon-blue"><UsersIcon /></div>
        </div>
        <div className="stat-card card-ec2">
          <div className="stat-body">
            <div className="stat-label">EC2 Instances</div>
            <div className="stat-value">{counts.ec2.toLocaleString()}</div>
            <div className="stat-detail">Across All Accounts</div>
          </div>
          <div className="stat-icon-wrap icon-green"><Ec2Icon /></div>
        </div>
        <div className="stat-card card-s3">
          <div className="stat-body">
            <div className="stat-label">S3 Buckets</div>
            <div className="stat-value">{counts.s3.toLocaleString()}</div>
            <div className="stat-detail">Across All Accounts</div>
          </div>
          <div className="stat-icon-wrap icon-cyan"><S3Icon /></div>
        </div>
        <div className="stat-card card-rds">
          <div className="stat-body">
            <div className="stat-label">RDS Instances</div>
            <div className="stat-value">{counts.rds.toLocaleString()}</div>
            <div className="stat-detail">Across All Accounts</div>
          </div>
          <div className="stat-icon-wrap icon-indigo"><RdsIcon /></div>
        </div>
      </div>

      <div className="middle-row">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Resource Distribution</div>
          </div>
          {loading ? <div style={{ padding: "2rem" }}><SkeletonRows /></div> : <DonutChart segments={segments} total={counts.total} />}
        </div>
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
              {recentResources.map((r: any, i: number) => {
                const tk = r.type ? resourceTypeKey(r.type) : r.typeKey;
                const typeLabel = r.type || r.typeLabel;
                const resourceId = r.id.slice(0, 18);
                const accountId = r.account_id;
                const changedBy = r.changedBy || "ritam.vaskar";
                return (
                  <tr key={i}>
                    <td>
                      <div className="resource-cell">
                        <span className="resource-id">{resourceId}</span>
                      </div>
                    </td>
                    <td><span className={`type-badge badge-${tk}`}>{typeLabel}</span></td>
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
