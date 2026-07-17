import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Activity,
  Users,
  AlertTriangle,
  ChevronRight,
  Search,
  RefreshCw,
  Copy,
  Layers,
  Cpu,
  Milestone,
  CheckCircle,
  Clock,
  ArrowUpDown,
  X,
  Sparkles,
  ExternalLink,
  BookOpen,
  TrendingUp,
  TrendingDown,
  Minus,
  Presentation,
  FileText,
  Download,
  Award,
  Flame
} from 'lucide-react';
import { Chart as ChartJS, registerables } from 'chart.js';

// Register all ChartJS elements
ChartJS.register(...registerables);

// Static labels for demo accounts when fallback is needed
const DEMO_ORG_LABELS: Record<string, string> = {
  "00000000-0000-4000-8000-000000000001": "Acme Architects",
  "00000000-0000-4000-8000-000000000002": "BuildRight Construction",
  "00000000-0000-4000-8000-000000000003": "Metro Design Studio",
  "00000000-0000-4000-8000-000000000004": "Skyline Interiors",
  "00000000-0000-4000-8000-000000000005": "UrbanSpace Planners",
  "00000000-0000-4000-8000-000000000006": "GreenBuild Partners",
  "00000000-0000-4000-8000-000000000007": "Nova Projects Ltd",
  "00000000-0000-4000-8000-000000000008": "Craft & Co Studio",
  "00000000-0000-4000-8000-000000000009": "Horizon Developers",
  "00000000-0000-4000-8000-00000000000a": "Pixel Perfect Design",
  "00000000-0000-4000-8000-00000000000b": "Stone & Timber Co",
  "00000000-0000-4000-8000-00000000000c": "Riverside Architects",
};

const MODULE_LABELS: Record<string, string> = {
  INDENT: "Indent",
  RFQ: "RFQ",
  PO: "Purchase Order",
  WO: "Work Order",
  TASK: "Tasks",
  SCHEDULE: "Schedule",
  LEAD_MANAGER: "Lead Manager",
  USERHUB: "User Hub",
  AUTOMATION: "Automation",
  AEC_AUTOPILOT: "Autopilot",
  PROCUREMENT: "Procurement",
  PROPOSAL: "Proposals",
  QUESTIONNAIRE: "Questionnaire",
  PAYMASTER: "Billing",
  MEETANDNOTE: "Meet & Note",
};

function formatModuleName(src: string): string {
  if (!src) return "—";
  const key = String(src).trim().toUpperCase();
  if (MODULE_LABELS[key]) return MODULE_LABELS[key];
  return key.split("_").map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

function formatLogEvent(evt: string): string {
  if (!evt || evt === "UNDEFINED_LOG_EVENT") return "General activity";
  return String(evt).split("_").map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

export default function App() {
  // Config & state
  const [apiBase, setApiBase] = useState('/api'); // Default to internal proxy
  const [apiKey, setApiKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [statusBar, setStatusBar] = useState({ message: 'Click Refresh Portfolio to load accounts.', type: 'info' });
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Data State
  const [portfolioData, setPortfolioData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [orgDetailsCache, setOrgDetailsCache] = useState<Record<string, any>>({});
  const [drillOrgId, setDrillOrgId] = useState('');
  const [accountDetail, setAccountDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBucket, setFilterBucket] = useState('');
  const [filterTrend, setFilterTrend] = useState('');
  const [sortKey, setSortKey] = useState('healthScore');
  const [sortAsc, setSortAsc] = useState(true);

  // Presentation & CS Team Meeting States
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0); // 0: Executive Portfolio Summary, 1: At-Risk Priorities, 2: Adoption Insights
  const [csQuickFilter, setCsQuickFilter] = useState<'all' | 'declining' | 'critical' | 'alert_heavy'>('all');
  const [isCopiedSummary, setIsCopiedSummary] = useState(false);
  const [isSlidePlaying, setIsSlidePlaying] = useState(false);

  // Refs for Chart instances
  const chartsRef = useRef<Record<string, ChartJS | null>>({});

  // Canvas Refs
  const canvasRefs = {
    healthMix: useRef<HTMLCanvasElement>(null),
    trendMix: useRef<HTMLCanvasElement>(null),
    dailyTrend: useRef<HTMLCanvasElement>(null),
    atRisk: useRef<HTMLCanvasElement>(null),
    scatter: useRef<HTMLCanvasElement>(null),
    moduleUsage: useRef<HTMLCanvasElement>(null),
    automation: useRef<HTMLCanvasElement>(null),
    mauDist: useRef<HTMLCanvasElement>(null),
    recency: useRef<HTMLCanvasElement>(null),

    // Details Canvas Refs
    detailHealth: useRef<HTMLCanvasElement>(null),
    detailActivity: useRef<HTMLCanvasElement>(null),
    detailModule: useRef<HTMLCanvasElement>(null),
    detailStick: useRef<HTMLCanvasElement>(null),
  };

  // On mount: fetch config, initialize cache, and auto-load portfolio
  useEffect(() => {
    // Populate cache with static labels
    const initialCache: Record<string, any> = {};
    Object.entries(DEMO_ORG_LABELS).forEach(([id, name]) => {
      initialCache[id] = { organizationId: id, organizationName: name };
    });
    setOrgDetailsCache(initialCache);

    // Fetch config and auto load
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.apiUrl) {
          setStatusBar({ message: `Connected to telemetry hub (Secure API key used). Syncing...`, type: 'info' });
        }
        // Automatically load portfolio immediately on launch
        loadPortfolio();
      })
      .catch(() => {
        setStatusBar({ message: 'Syncing telemetry portfolio from env config...', type: 'info' });
        loadPortfolio();
      });
  }, []);

  // Slide autoplay effect for presentation screen-share
  useEffect(() => {
    if (!isSlidePlaying || !isPresentationMode) return;
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % 3);
    }, 12000); // Cycle slides every 12 seconds
    return () => clearInterval(interval);
  }, [isSlidePlaying, isPresentationMode]);

  // Helper to destroy a specific chart
  const destroyChart = (id: string) => {
    if (chartsRef.current[id]) {
      chartsRef.current[id]?.destroy();
      chartsRef.current[id] = null;
    }
  };

  // Cleanup all charts on unmount
  useEffect(() => {
    return () => {
      Object.keys(chartsRef.current).forEach(destroyChart);
    };
  }, []);

  // Main API poster
  const apiCall = async (eventType: string, body = {}) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) {
      headers.apikey = apiKey;
    }

    // If using the default '/api' proxy, or direct external base
    const endpoint = apiBase === '/api' ? '/api/customer-success' : `${apiBase.replace(/\/$/, '')}/customer-success`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ eventType, ...body }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || data.message || res.statusText || 'API Call failed');
    }
    return data;
  };

  // Save Config locally
  const saveConfig = () => {
    localStorage.setItem("cs-cmd", JSON.stringify({ apiBase, apiKey }));
    setIsSaved(true);
    setStatusBar({ message: 'Configuration saved locally.', type: 'success' });
    setTimeout(() => setIsSaved(false), 2000);
  };

  // Format Helper functions
  const fmtDate = (ms: any) => {
    if (!ms) return "—";
    const d = new Date(Number(ms));
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString();
  };

  const chartDateLabel = (ms: any) => {
    const d = new Date(Number(ms));
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const chartNum = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const pct = (n: any) => {
    return n == null ? "—" : (n * 100).toFixed(0) + "%";
  };

  const getOrgName = (id: string) => {
    if (orgDetailsCache[id]?.organizationName) return orgDetailsCache[id].organizationName;
    if (DEMO_ORG_LABELS[id]) return DEMO_ORG_LABELS[id];
    if (orgDetailsCache[id]?.accountNumber) return orgDetailsCache[id].accountNumber;
    return id.substring(0, 8) + '...';
  };

  // Fetch names in background
  const resolveOrgNames = async (orgIds: string[]) => {
    const missing = [...new Set(orgIds)].filter(id => {
      if (DEMO_ORG_LABELS[id]) return false;
      const cached = orgDetailsCache[id];
      return !cached?.organizationName;
    });

    if (!missing.length) return;

    const batchSize = 40;
    for (let i = 0; i < missing.length; i += batchSize) {
      const chunk = missing.slice(i, i + batchSize);
      try {
        const res = await apiCall("RESOLVE_ORGANIZATION_NAMES", { organizationIds: chunk });
        const body = res.body || {};
        setOrgDetailsCache(prev => {
          const next = { ...prev };
          Object.entries(body).forEach(([id, details]: [string, any]) => {
            next[id] = { organizationId: id, ...details };
          });
          return next;
        });
      } catch (e) {
        console.warn("Org name resolve batch failed:", e);
      }
    }
  };

  // Load portfolio analytics
  const loadPortfolio = async () => {
    setLoading(true);
    setStatusBar({ message: "Loading portfolio analytics and resolving account names...", type: 'info' });
    try {
      const res = await apiCall("GET_PORTFOLIO_ANALYTICS", { trendDays: 14, useLatestPerOrg: true, enrichOrgDetails: true });
      const data = res.body;

      setPortfolioData(data);

      // Pre-fill cache with whatever came in the accounts list
      const initialCacheUpdate: Record<string, any> = {};
      (data.accounts || []).forEach((acc: any) => {
        if (acc.organizationId) {
          initialCacheUpdate[acc.organizationId] = {
            organizationId: acc.organizationId,
            organizationName: acc.organizationName || null,
            accountNumber: acc.accountNumber || null,
            emailAddress: acc.emailAddress || null,
            organizationType: acc.organizationType || null,
            countryCode: acc.countryCode || null,
          };
        }
      });
      setOrgDetailsCache(prev => ({ ...prev, ...initialCacheUpdate }));

      setLastUpdated(new Date().toLocaleTimeString());
      setStatusBar({ message: `Loaded ${data.summary?.totalAccounts || 0} accounts successfully!`, type: 'success' });

      // Trigger background resolution of missing names
      resolveOrgNames((data.accounts || []).map((a: any) => a.organizationId));
    } catch (e: any) {
      setStatusBar({ message: "Error loading portfolio: " + e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Drill into account detail
  const drillIntoOrg = async (orgId: string) => {
    if (!orgId) return;
    setDrillOrgId(orgId);
    setDetailLoading(true);
    setStatusBar({ message: `Loading full customer intelligence profile...`, type: 'info' });

    try {
      const res = await apiCall("GET_ACCOUNT_DETAIL", { organizationId: orgId, days: 30, historyDays: 14 });
      const data = res.body;
      setAccountDetail(data);

      if (data.profile) {
        setOrgDetailsCache(prev => ({
          ...prev,
          [orgId]: { organizationId: orgId, ...data.profile }
        }));
      }
      setStatusBar({ message: `Loaded full intelligence profile for ${getOrgName(orgId)}`, type: 'success' });
    } catch (e: any) {
      setStatusBar({ message: "Account detail error: " + e.message, type: 'error' });
    } finally {
      setDetailLoading(false);
    }
  };

  const clearDrill = () => {
    setDrillOrgId('');
    setAccountDetail(null);
    setStatusBar({ message: "Returned to global portfolio.", type: 'info' });
  };

  // Render main portfolio charts when portfolioData loads
  useEffect(() => {
    if (!portfolioData) return;

    const s = portfolioData.summary;
    const accounts = portfolioData.accounts || [];
    const trend = portfolioData.dailyTrend || [];
    const moduleUsage = portfolioData.moduleUsageSummary || [];

    // Chart 1: Health Mix
    if (canvasRefs.healthMix.current) {
      destroyChart("healthMix");
      chartsRef.current.healthMix = new ChartJS(canvasRefs.healthMix.current, {
        type: "doughnut",
        data: {
          labels: ["Healthy", "At Risk", "Critical"],
          datasets: [{
            data: [s.distribution.healthy, s.distribution.atRisk, s.distribution.critical],
            backgroundColor: ["#10b981", "#f59e0b", "#ef4444"],
            borderWidth: 0,
            hoverOffset: 4
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: { boxWidth: 12, font: { size: 11 }, padding: 15 }
            }
          },
          cutout: "65%"
        },
      });
    }

    // Chart 2: Trend Mix
    if (canvasRefs.trendMix.current) {
      destroyChart("trendMix");
      chartsRef.current.trendMix = new ChartJS(canvasRefs.trendMix.current, {
        type: "pie",
        data: {
          labels: ["Improving", "Stable", "Declining"],
          datasets: [{
            data: [s.trends.improving, s.trends.stable, s.trends.declining],
            backgroundColor: ["#10b981", "#64748b", "#ef4444"],
            borderWidth: 0
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: { boxWidth: 12, font: { size: 11 }, padding: 15 }
            }
          }
        },
      });
    }

    // Chart 3: Avg Health Score Daily Trend
    if (canvasRefs.dailyTrend.current) {
      destroyChart("dailyTrend");
      chartsRef.current.dailyTrend = new ChartJS(canvasRefs.dailyTrend.current, {
        type: "line",
        data: {
          labels: trend.map((t: any) => chartDateLabel(t.date)),
          datasets: [{
            label: "Avg Health",
            data: trend.map((t: any) => chartNum(t.avgHealthScore)),
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: "#3b82f6"
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { min: 0, max: 100, grid: { color: "#f1f5f9" } },
            x: { grid: { display: false } }
          }
        },
      });
    }

    // Chart 4: Lowest Health Scores Bar Chart
    if (canvasRefs.atRisk.current) {
      const bottom15 = [...accounts]
        .sort((a, b) => a.healthScore - b.healthScore)
        .slice(0, 15);

      destroyChart("atRisk");
      chartsRef.current.atRisk = new ChartJS(canvasRefs.atRisk.current, {
        type: "bar",
        data: {
          labels: bottom15.map(a => getOrgName(a.organizationId).slice(0, 22)),
          datasets: [{
            label: "Health Score",
            data: bottom15.map(a => a.healthScore),
            backgroundColor: bottom15.map(a =>
              a.healthBucket === "critical" ? "#ef4444" :
              a.healthBucket === "at-risk" ? "#f59e0b" : "#10b981"
            ),
            borderRadius: 4
          }],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { min: 0, max: 100, grid: { color: "#f1f5f9" } },
            y: { grid: { display: false } }
          }
        },
      });
    }

    // Chart 5: Scatter Plot
    if (canvasRefs.scatter.current) {
      destroyChart("scatter");
      chartsRef.current.scatter = new ChartJS(canvasRefs.scatter.current, {
        type: "scatter",
        data: {
          datasets: [{
            label: "Accounts",
            data: accounts.map((a: any) => ({
              x: chartNum(a.stickinessRatio) * 100,
              y: chartNum(a.healthScore),
              orgId: a.organizationId
            })),
            backgroundColor: accounts.map((a: any) =>
              a.healthBucket === "critical" ? "rgba(239, 68, 68, 0.7)" :
              a.healthBucket === "at-risk" ? "rgba(245, 158, 11, 0.7)" : "rgba(16, 185, 129, 0.7)"
            ),
            pointRadius: 6,
            pointHoverRadius: 8
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx: any) => {
                  const item = ctx.raw;
                  return `${getOrgName(item.orgId)}: Health ${item.y}, Stickiness ${item.x.toFixed(0)}%`;
                }
              }
            }
          },
          scales: {
            x: {
              title: { display: true, text: "Stickiness Ratio %", font: { weight: 'bold' } },
              grid: { color: "#f1f5f9" }
            },
            y: {
              title: { display: true, text: "Health Score", font: { weight: 'bold' } },
              min: 0,
              max: 100,
              grid: { color: "#f1f5f9" }
            }
          },
        },
      });
    }

    // Chart 6: Module Usage Summary
    if (canvasRefs.moduleUsage.current) {
      destroyChart("moduleUsage");
      chartsRef.current.moduleUsage = new ChartJS(canvasRefs.moduleUsage.current, {
        type: "bar",
        data: {
          labels: moduleUsage.length
            ? moduleUsage.map((m: any) => (m.label || formatModuleName(m.logSource)).slice(0, 22))
            : ["No activity"],
          datasets: [{
            label: "Active Accounts",
            data: moduleUsage.length ? moduleUsage.map((m: any) => m.orgCount) : [0],
            backgroundColor: "#4f46e5",
            borderRadius: 4
          }],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              enabled: moduleUsage.length > 0,
              callbacks: {
                title: (items) => {
                  const idx = items[0]?.dataIndex ?? 0;
                  return moduleUsage[idx]?.label || moduleUsage[idx]?.logSource || "";
                },
                afterBody: (items) => {
                  const idx = items[0]?.dataIndex ?? 0;
                  const feats = moduleUsage[idx]?.topFeatures || [];
                  if (!feats.length) return "";
                  return ["", "Top Actions Completed:", ...feats.slice(0, 5).map((f: any) => `• ${f.label} (${f.activityCount})`)];
                }
              }
            }
          },
          scales: {
            x: { grid: { color: "#f1f5f9" }, ticks: { stepSize: 1 } },
            y: { grid: { display: false } }
          }
        },
      });
    }

    // Chart 7: Automation Level
    if (canvasRefs.automation.current) {
      const autoBuckets = { low: 0, mid: 0, high: 0 };
      accounts.forEach((a: any) => {
        const score = a.automationAdoptionScore || 0;
        if (score < 35) autoBuckets.low++;
        else if (score < 65) autoBuckets.mid++;
        else autoBuckets.high++;
      });

      destroyChart("automation");
      chartsRef.current.automation = new ChartJS(canvasRefs.automation.current, {
        type: "bar",
        data: {
          labels: ["Low (0–34)", "Medium (35–64)", "High (65+)"],
          datasets: [{
            data: [autoBuckets.low, autoBuckets.mid, autoBuckets.high],
            backgroundColor: ["#ef4444", "#f59e0b", "#10b981"],
            borderRadius: 4
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { grid: { color: "#f1f5f9" }, ticks: { stepSize: 1 } },
            x: { grid: { display: false } }
          }
        },
      });
    }

    // Chart 8: MAU Distribution
    if (canvasRefs.mauDist.current) {
      const mauBuckets = { zero: 0, low: 0, mid: 0, high: 0 };
      accounts.forEach((a: any) => {
        const m = a.mau || 0;
        if (m === 0) mauBuckets.zero++;
        else if (m <= 2) mauBuckets.low++;
        else if (m <= 5) mauBuckets.mid++;
        else mauBuckets.high++;
      });

      destroyChart("mauDist");
      chartsRef.current.mauDist = new ChartJS(canvasRefs.mauDist.current, {
        type: "doughnut",
        data: {
          labels: ["0 Users", "1–2 Active", "3–5 Active", "6+ Active"],
          datasets: [{
            data: [mauBuckets.zero, mauBuckets.low, mauBuckets.mid, mauBuckets.high],
            backgroundColor: ["#94a3b8", "#60a5fa", "#2563eb", "#1d4ed8"],
            borderWidth: 0
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: { boxWidth: 10, font: { size: 10 }, padding: 10 }
            }
          },
          cutout: "60%"
        },
      });
    }

    // Chart 9: Recency Distribution
    if (canvasRefs.recency.current) {
      const recency = { last7d: 0, days8to14: 0, days15to30: 0, dormant: 0 };
      const now = Date.now();
      accounts.forEach((a: any) => {
        if (!a.lastActivityAt) { recency.dormant++; return; }
        const days = Math.floor((now - a.lastActivityAt) / 86400000);
        if (days <= 7) recency.last7d++;
        else if (days <= 14) recency.days8to14++;
        else if (days <= 30) recency.days15to30++;
        else recency.dormant++;
      });

      destroyChart("recency");
      chartsRef.current.recency = new ChartJS(canvasRefs.recency.current, {
        type: "bar",
        data: {
          labels: ["≤7 days", "8–14 days", "15–30 days", "30+ days / inactive"],
          datasets: [{
            data: [recency.last7d, recency.days8to14, recency.days15to30, recency.dormant],
            backgroundColor: ["#10b981", "#f59e0b", "#f97316", "#ef4444"],
            borderRadius: 4
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { grid: { color: "#f1f5f9" }, ticks: { stepSize: 1 } },
            x: { grid: { display: false } }
          }
        },
      });
    }

  }, [portfolioData, orgDetailsCache, isPresentationMode, currentSlide]);

  // Render detail charts when accountDetail loads
  useEffect(() => {
    if (!accountDetail) return;

    const h = accountDetail.health || {};
    const ad = accountDetail.adoption || {};
    const hist = accountDetail.healthHistory || [];
    const timeline = accountDetail.activityTimeline || [];
    const modAct = ad.moduleActivity || [];

    const hasTrend = hist.length > 0 && hist.some((r: any) => chartNum(r.healthScore) > 0 || chartNum(r.stickinessRatio) > 0);

    // Detail Chart 1: Health Score Trend (14d)
    if (canvasRefs.detailHealth.current) {
      destroyChart("detailHealth");
      chartsRef.current.detailHealth = new ChartJS(canvasRefs.detailHealth.current, {
        type: "line",
        data: {
          labels: hist.length ? hist.map((r: any) => chartDateLabel(r.date)) : ["No Data"],
          datasets: [{
            label: "Health",
            data: hist.length ? hist.map((r: any) => chartNum(r.healthScore)) : [0],
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            fill: true,
            tension: 0.3,
            pointRadius: hist.length > 1 ? 3 : 5,
            spanGaps: true
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            subtitle: {
              display: !hasTrend,
              text: "No history data available",
              color: "#64748b",
              font: { size: 12 }
            }
          },
          scales: {
            y: { min: 0, max: 100, grid: { color: "#f1f5f9" } },
            x: { grid: { display: false } }
          }
        },
      });
    }

    // Detail Chart 2: Daily Activity (14d)
    if (canvasRefs.detailActivity.current) {
      destroyChart("detailActivity");
      chartsRef.current.detailActivity = new ChartJS(canvasRefs.detailActivity.current, {
        type: "bar",
        data: {
          labels: timeline.length ? timeline.map((r: any) => chartDateLabel(r.date)) : ["No activity"],
          datasets: [
            {
              label: "Actions Completed",
              data: timeline.map((r: any) => chartNum(r.activityCount)),
              backgroundColor: "rgba(59, 130, 246, 0.6)",
              borderRadius: 3
            },
            {
              label: "Unique Users",
              data: timeline.map((r: any) => chartNum(r.uniqueUsers)),
              backgroundColor: "rgba(16, 185, 129, 0.6)",
              borderRadius: 3
            }
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: { boxWidth: 10, font: { size: 10 } }
            }
          },
          scales: {
            y: { grid: { color: "#f1f5f9" }, ticks: { stepSize: 1 } },
            x: { grid: { display: false } }
          }
        },
      });
    }

    // Detail Chart 3: Module Activity Breakdown
    if (canvasRefs.detailModule.current) {
      destroyChart("detailModule");
      chartsRef.current.detailModule = new ChartJS(canvasRefs.detailModule.current, {
        type: "bar",
        data: {
          labels: modAct.length ? modAct.map((m: any) => (m.label || "").slice(0, 16)) : ["No modules"],
          datasets: [{
            data: modAct.map((m: any) => chartNum(m.activityCount)),
            backgroundColor: "#8b5cf6",
            borderRadius: 3
          }],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: "#f1f5f9" }, ticks: { stepSize: 1 } },
            y: { grid: { display: false } }
          }
        },
      });
    }

    // Detail Chart 4: Stickiness Trend (14d)
    if (canvasRefs.detailStick.current) {
      destroyChart("detailStick");
      chartsRef.current.detailStick = new ChartJS(canvasRefs.detailStick.current, {
        type: "line",
        data: {
          labels: hist.length ? hist.map((r: any) => chartDateLabel(r.date)) : ["No Data"],
          datasets: [{
            label: "Stickiness %",
            data: hist.length ? hist.map((r: any) => chartNum(r.stickinessRatio) * 100) : [0],
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            fill: true,
            tension: 0.3,
            pointRadius: hist.length > 1 ? 3 : 5,
            spanGaps: true
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              min: 0,
              max: 100,
              grid: { color: "#f1f5f9" },
              ticks: { callback: (val) => val + "%" }
            },
            x: { grid: { display: false } }
          }
        },
      });
    }

  }, [accountDetail]);

  // Filtering Logic
  const getFilteredAccounts = () => {
    if (!portfolioData?.accounts) return [];
    let list = [...portfolioData.accounts];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a => {
        const details = orgDetailsCache[a.organizationId];
        const searchPool = [
          getOrgName(a.organizationId),
          a.organizationId,
          details?.accountNumber,
          details?.emailAddress,
          a.accountNumber,
          a.emailAddress
        ].filter(Boolean).join(" ").toLowerCase();
        return searchPool.includes(q);
      });
    }

    if (filterBucket) {
      list = list.filter(a => a.healthBucket === filterBucket);
    }

    if (filterTrend) {
      list = list.filter(a => (a.healthTrend || 'stable') === filterTrend);
    }

    // CS Quick Filters
    if (csQuickFilter === 'declining') {
      list = list.filter(a => (a.healthTrend || 'stable') === 'declining');
    } else if (csQuickFilter === 'critical') {
      list = list.filter(a => a.healthBucket === 'critical');
    } else if (csQuickFilter === 'alert_heavy') {
      list = list.filter(a => a.openAlertsCritical > 0 || (a.healthScore && a.healthScore < 50));
    }

    // Sort
    list.sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];

      if (sortKey === "name") {
        va = getOrgName(a.organizationId);
        vb = getOrgName(b.organizationId);
        return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
      }

      if (sortKey === "lastModuleUsed") {
        va = a.lastModuleUsed || "";
        vb = b.lastModuleUsed || "";
        return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
      }

      if (sortKey === "moduleBreadth") {
        va = (a.modulesUsed || []).length;
        vb = (b.modulesUsed || []).length;
      }

      va = va ?? 0;
      vb = vb ?? 0;

      return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });

    return list;
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "name" ? true : key === "healthScore" ? true : false);
    }
  };

  const copyToClipboard = async (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setStatusBar({ message: "Organization ID copied to clipboard!", type: "success" });
    } catch (_) {
      window.prompt("Organization ID:", text);
    }
  };

  const copyWeeklySummaryText = async () => {
    if (!portfolioData) return;
    const s = portfolioData.summary || {};
    const filtered = getFilteredAccounts();
    const declining = filtered.filter(a => a.healthTrend === 'declining');
    const critical = filtered.filter(a => a.healthBucket === 'critical');
    
    let text = `## 📊 AEC Telemetry Customer Success Weekly Presentation Summary\n`;
    text += `*Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}*\n\n`;
    text += `### 🔑 Key Portfolio Metrics:\n`;
    text += `- **Total Filtered Portals**: ${filtered.length} / ${portfolioData.accounts?.length || 0}\n`;
    text += `- **Average Health Score**: ${s.avgHealthScore || '—'} / 100\n`;
    text += `- **Active Anomalies/Alerts**: ${s.totalCriticalAlerts || 0} critical alerts in system\n`;
    text += `- **Avg Stickiness Ratio (DAU/MAU)**: ${pct(s.avgStickiness)}\n\n`;
    
    text += `### ⚠️ CS Team Review & At-Risk Priorities:\n`;
    if (critical.length > 0) {
      text += `*Below are the **${critical.length}** accounts with **Critical Health (< 40)**:*\n`;
      critical.slice(0, 5).forEach(a => {
        const name = a.organizationName || orgDetailsCache[a.organizationId]?.organizationName || getOrgName(a.organizationId);
        text += `- **${name}** (Health: **${Math.round(a.healthScore)}**/100, Trend: *${a.healthTrend || 'stable'}*, Alerts: ${a.openAlertsCritical || 0})\n`;
      });
      if (critical.length > 5) text += `- *And ${critical.length - 5} more critical accounts...*\n`;
    } else {
      text += `- ✅ No accounts currently in Critical health in this filtered list.\n`;
    }
    
    if (declining.length > 0) {
      text += `\n*The following accounts have **Declining health trends**:*\n`;
      declining.slice(0, 5).forEach(a => {
        const name = a.organizationName || orgDetailsCache[a.organizationId]?.organizationName || getOrgName(a.organizationId);
        text += `- **${name}** (Health: **${Math.round(a.healthScore)}**/100, Alerts: ${a.openAlertsCritical || 0})\n`;
      });
      if (declining.length > 5) text += `- *And ${declining.length - 5} more declining accounts...*\n`;
    }

    text += `\n### 🚀 Automation Adoption & Engagement:\n`;
    text += `- Average Automation Score: **${Math.round(s.avgAutomationScore || 0)}**/100\n`;
    text += `- High Churn Risk flag count: **${s.churnRiskOrgs || 0}** accounts flagged\n\n`;
    text += `*Created via CS Command Center. Ready to present to key stakeholders.*`;

    try {
      await navigator.clipboard.writeText(text);
      setIsCopiedSummary(true);
      setStatusBar({ message: "Weekly Presentation Summary copied to clipboard (Markdown format)!", type: "success" });
      setTimeout(() => setIsCopiedSummary(false), 3000);
    } catch (err) {
      setStatusBar({ message: "Failed to copy summary to clipboard.", type: "error" });
    }
  };

  const renderTrendIcon = (trend: string) => {
    if (trend === 'improving') return <TrendingUp className="w-4 h-4 text-emerald-500 inline mr-1" />;
    if (trend === 'declining') return <TrendingDown className="w-4 h-4 text-red-500 inline mr-1" />;
    return <Minus className="w-4 h-4 text-slate-400 inline mr-1" />;
  };

  const renderHealthPill = (score: number, bucket: string) => {
    const rounded = Math.round(score);
    let colors = 'border-emerald-500 text-emerald-600 bg-emerald-50/30';
    if (bucket === 'at-risk') colors = 'border-amber-500 text-amber-600 bg-amber-50/30';
    if (bucket === 'critical') colors = 'border-red-500 text-red-600 bg-red-50/30';

    return (
      <span className={`inline-flex items-center justify-center w-9 h-9 font-extrabold text-sm rounded-full border-2 ${colors}`}>
        {rounded}
      </span>
    );
  };

  const activeAccounts = getFilteredAccounts();

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans antialiased">
      {/* Top Banner Control Center */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center bg-indigo-600 text-white rounded-lg p-2 shadow-md">
              <Shield className="w-6 h-6" />
            </span>
            <div>
              <h1 className="font-extrabold text-xl tracking-tight text-slate-900">CS Command Center</h1>
              <p className="text-xs text-slate-500 font-medium">Customer Portfolio Intelligence Panel • AECAutopilot</p>
            </div>
          </div>
        </div>

        {/* Presentation controls & status */}
        <div className="flex flex-wrap items-center gap-2.5">
          {portfolioData && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPresentationMode(!isPresentationMode)}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition shadow-sm border ${
                  isPresentationMode
                    ? 'bg-indigo-600 border-indigo-700 text-white hover:bg-indigo-700'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
                title="Toggle Weekly Slide Presentation Mode"
              >
                <Presentation className="w-4 h-4" />
                <span>{isPresentationMode ? 'Exit Presentation' : 'Weekly Presenter'}</span>
                <span className="bg-emerald-500 text-white text-[9px] px-1 rounded animate-pulse">Live</span>
              </button>

              <button
                onClick={copyWeeklySummaryText}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg transition shadow-sm"
                title="Copy weekly briefing to clipboard (Markdown)"
              >
                <FileText className="w-4 h-4 text-indigo-500" />
                <span>{isCopiedSummary ? 'Briefing Copied ✓' : 'Copy Briefing'}</span>
              </button>
            </div>
          )}

          {lastUpdated && (
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 font-semibold bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-md">
              <Clock className="w-3.5 h-3.5" />
              Sync: {lastUpdated}
            </div>
          )}
          <div className={`text-xs font-semibold px-3 py-1.5 rounded-md shadow-sm border ${
            statusBar.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
            statusBar.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-indigo-50 border-indigo-100 text-indigo-700'
          }`}>
            {statusBar.message}
          </div>
        </div>
      </header>

      {/* CS Actions Control Bar */}
      <section className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm">
        {/* Left Side: Sync / Telemetry Status */}
        <div className="flex items-center gap-3">
          <button
            onClick={loadPortfolio}
            disabled={loading}
            className="bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm transition flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing Portfolio...' : 'Sync Portfolio'}
          </button>
          
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs text-slate-500 font-semibold">
              Live Connection Securely Routed
            </span>
          </div>
        </div>

        {/* Right Side: Drill down input direct lookup (Excepted by user) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-50 border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 transition shadow-sm">
            <div className="pl-3 text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              className="bg-transparent text-slate-800 font-medium px-3 py-2 text-xs w-72 focus:outline-none placeholder-slate-400"
              placeholder="Enter Organization ID (UUID) to inspect..."
              value={drillOrgId}
              onChange={(e) => setDrillOrgId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && drillOrgId) {
                  drillIntoOrg(drillOrgId);
                }
              }}
            />
            {drillOrgId && (
              <button onClick={clearDrill} className="p-1 hover:text-slate-700 text-slate-400 mr-1 rounded-full hover:bg-slate-200 transition">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => drillIntoOrg(drillOrgId)}
            disabled={!drillOrgId || detailLoading}
            className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm transition"
          >
            {detailLoading ? 'Searching...' : 'Inspect Account'}
          </button>
        </div>
      </section>

      {/* MAIN CONTAINER */}
      <main className="px-6 py-6 max-w-7xl mx-auto">
        {/* If no data loaded yet, show empty welcome screen */}
        {!portfolioData && !detailLoading && !loading && (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm max-w-xl mx-auto mt-12">
            <span className="inline-flex items-center justify-center bg-indigo-50 rounded-full p-4 text-indigo-600 mb-4">
              <Activity className="w-10 h-10" />
            </span>
            <h2 className="font-extrabold text-slate-900 text-xl mb-2">CS Command Center Inactive</h2>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Authenticate and synchronize with AECAutopilot's telemetry stream to unlock real-time portfolio analytics, customer success scoring, and critical alerts.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={loadPortfolio}
                className="bg-indigo-600 text-white hover:bg-indigo-500 font-bold text-sm px-6 py-3 rounded-lg shadow-md transition flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Sync Telemetry Now
              </button>
            </div>
          </div>
        )}

        {/* Global Loading Spinner */}
        {(loading || (detailLoading && !accountDetail)) && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 md:p-12 shadow-sm max-w-2xl mx-auto my-12 animate-pulse">
            <div className="flex flex-col items-center justify-center text-center">
              {/* Outer pulsing ring */}
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full bg-indigo-100 animate-ping opacity-75"></div>
                <div className="relative p-6 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100 shadow-inner">
                  <Activity className="w-10 h-10 animate-bounce" />
                </div>
              </div>
              
              <h3 className="font-extrabold text-slate-900 text-lg tracking-tight mb-2">Syncing Real-Time CS Telemetry</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed mb-8">
                Securing channel connection, resolving account identifiers, and rendering customer intelligence matrix...
              </p>

              {/* Progress Steps Simulation */}
              <div className="w-full max-w-sm space-y-3 bg-slate-50 border border-slate-100 p-4 rounded-xl text-left">
                <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-600">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-[10px]">✓</span>
                  <span>Established secure proxy to {apiBase === '/api' ? 'AEC Autopilot' : apiBase}</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-600">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-[10px] animate-spin">
                    <RefreshCw className="w-2 h-2" />
                  </span>
                  <span>Fetching portfolio metadata and historical analytics...</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs font-medium text-slate-400">
                  <span className="h-4 w-4 shrink-0 rounded-full border-2 border-slate-200"></span>
                  <span>Aggregating daily adoption rates and automation logs</span>
                </div>
              </div>

              {/* Skeleton Mock-up Elements to feel super premium */}
              <div className="w-full mt-8 pt-6 border-t border-slate-100 grid grid-cols-3 gap-3">
                <div className="h-8 bg-slate-100 rounded-md"></div>
                <div className="h-8 bg-slate-100 rounded-md"></div>
                <div className="h-8 bg-slate-100 rounded-md"></div>
              </div>
            </div>
          </div>
        )}

        {/* WEEKLY SYNC PRESENTATION PANEL */}
        {isPresentationMode && portfolioData && !loading && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl text-white animate-fade-in mb-8">
            {/* Top Presentation Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 mb-6 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center bg-indigo-500/10 text-indigo-400 p-1.5 rounded border border-indigo-500/20">
                    <Presentation className="w-5 h-5" />
                  </span>
                  <h2 className="font-black text-lg tracking-tight text-slate-100 uppercase">
                    Weekly CS Review Desk
                  </h2>
                </div>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">
                  Live Telemetry Slideshow for Team Syncs • Last updated: {lastUpdated || 'Synced'}
                </p>
              </div>

              {/* Autoplay & Navigation Controls */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsSlidePlaying(!isSlidePlaying)}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                    isSlidePlaying
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 hover:bg-emerald-600/30'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${isSlidePlaying ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
                  <span>{isSlidePlaying ? 'Auto-Advancing (12s)' : 'Auto-Play'}</span>
                </button>

                <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setCurrentSlide(prev => (prev - 1 + 3) % 3)}
                    className="p-1 hover:bg-slate-700 rounded text-slate-300 transition text-xs font-bold"
                  >
                    ←
                  </button>
                  <span className="text-xs font-mono font-black text-slate-300 px-1">
                    0{currentSlide + 1} / 03
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentSlide(prev => (prev + 1) % 3)}
                    className="p-1 hover:bg-slate-700 rounded text-slate-300 transition text-xs font-bold"
                  >
                    →
                  </button>
                </div>
              </div>
            </div>

            {/* Slide Navigation Buttons */}
            <div className="grid grid-cols-3 gap-2 mb-6 text-center">
              {[
                { title: "01. Executive Overview", desc: "Overall Health & Trends" },
                { title: "02. Critical Action Items", desc: "Highest Risk Customer Portals" },
                { title: "03. Adoption & Automation", desc: "Integration Penetration" }
              ].map((slide, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setCurrentSlide(idx);
                    setIsSlidePlaying(false);
                  }}
                  className={`p-3 rounded-xl border text-left transition ${
                    currentSlide === idx
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                      : 'bg-slate-800/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-extrabold text-xs">{slide.title}</div>
                  <div className="text-[10px] opacity-75 font-medium mt-0.5">{slide.desc}</div>
                </button>
              ))}
            </div>

            {/* Slide 0: Executive Overview */}
            {currentSlide === 0 && (
              <div className="space-y-6 animate-fade-in">
                {/* 4 Large Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-5 shadow-sm text-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Portals Monitored</span>
                    <div className="font-black text-indigo-400 text-4xl my-2">{portfolioData.summary?.totalAccounts || 0}</div>
                    <span className="text-xs text-slate-500 font-semibold">Active client environments</span>
                  </div>
                  <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-5 shadow-sm text-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Average Portfolio Health</span>
                    <div className="font-black text-emerald-400 text-4xl my-2">{portfolioData.summary?.avgHealthScore || 0} / 100</div>
                    <span className="text-xs text-slate-500 font-semibold">Healthy threshold is 70+</span>
                  </div>
                  <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-5 shadow-sm text-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Urgent Team Alerts</span>
                    <div className="font-black text-red-400 text-4xl my-2">{portfolioData.summary?.accountsNeedingAttention || 0}</div>
                    <span className="text-xs text-slate-500 font-semibold">Declining & critical score</span>
                  </div>
                  <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-5 shadow-sm text-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active System Anomalies</span>
                    <div className="font-black text-amber-400 text-4xl my-2">{portfolioData.summary?.totalCriticalAlerts || 0}</div>
                    <span className="text-xs text-slate-500 font-semibold">Critical telemetry flags</span>
                  </div>
                </div>

                {/* Dual charts container */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-slate-800/50 border border-slate-800 p-5 rounded-xl flex flex-col h-72">
                    <h4 className="font-black text-slate-200 text-xs uppercase tracking-wider mb-3">Portfolio Health Allocation</h4>
                    <div className="flex-1 relative">
                      <canvas ref={canvasRefs.healthMix}></canvas>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 border border-slate-800 p-5 rounded-xl flex flex-col h-72">
                    <h4 className="font-black text-slate-200 text-xs uppercase tracking-wider mb-3">Weekly Trend Trajectory</h4>
                    <div className="flex-1 relative">
                      <canvas ref={canvasRefs.trendMix}></canvas>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 border border-slate-800 p-5 rounded-xl flex flex-col h-72">
                    <h4 className="font-black text-slate-200 text-xs uppercase tracking-wider mb-3">Portfolio Avg Health (14 Days)</h4>
                    <div className="flex-1 relative">
                      <canvas ref={canvasRefs.dailyTrend}></canvas>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Slide 1: At-Risk Priorities */}
            {currentSlide === 1 && (
              <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left horizontal bar chart */}
                  <div className="lg:col-span-1 bg-slate-800/50 border border-slate-800 p-5 rounded-xl flex flex-col h-[340px]">
                    <h4 className="font-black text-slate-200 text-xs uppercase tracking-wider mb-3">Lowest Health Accounts</h4>
                    <div className="flex-1 relative">
                      <canvas ref={canvasRefs.atRisk}></canvas>
                    </div>
                  </div>

                  {/* Right: Critical action tables */}
                  <div className="lg:col-span-2 bg-slate-800/40 border border-slate-800 rounded-xl p-5">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                      <h4 className="font-black text-slate-200 text-xs uppercase tracking-wider">Top At-Risk Accounts (Urgent Priority)</h4>
                      <span className="bg-red-500/15 text-red-400 font-bold text-[10px] px-2 py-0.5 rounded border border-red-500/20 uppercase tracking-widest">Action Required</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs font-semibold text-slate-300">
                        <thead>
                          <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase tracking-wider text-left">
                            <th className="pb-2">Account Name</th>
                            <th className="pb-2 text-center">Health</th>
                            <th className="pb-2 text-center">Trend</th>
                            <th className="pb-2 text-center">Anomalies</th>
                            <th className="pb-2 text-right">Last Activity</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {[...portfolioData.accounts]
                            .sort((a, b) => a.healthScore - b.healthScore)
                            .slice(0, 5)
                            .map((acc, i) => {
                              const name = acc.organizationName || orgDetailsCache[acc.organizationId]?.organizationName || getOrgName(acc.organizationId);
                              return (
                                <tr key={i} className="hover:bg-slate-800/30 transition">
                                  <td className="py-3 font-extrabold text-white truncate max-w-[180px]" title={name}>{name}</td>
                                  <td className="py-3 text-center">
                                    <span className={`inline-block px-2 py-0.5 text-[11px] font-black rounded-full ${
                                      acc.healthBucket === 'critical' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
                                    }`}>
                                      {Math.round(acc.healthScore)}/100
                                    </span>
                                  </td>
                                  <td className="py-3 text-center capitalize text-slate-400 italic">
                                    {acc.healthTrend || 'stable'}
                                  </td>
                                  <td className="py-3 text-center">
                                    {acc.openAlertsCritical > 0 ? (
                                      <span className="bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded font-black text-[10px]">
                                        {acc.openAlertsCritical} Critical
                                      </span>
                                    ) : (
                                      <span className="text-slate-500">0</span>
                                    )}
                                  </td>
                                  <td className="py-3 text-right text-slate-400">
                                    {fmtDate(acc.lastActivityAt)}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>

                    {/* CS Action playbook */}
                    <div className="bg-slate-800/30 border border-slate-800/80 rounded-lg p-3.5 mt-4">
                      <h5 className="text-[11px] font-black uppercase text-indigo-400 tracking-wider mb-2">🛡️ Customer Success Action Playbook</h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[10px] text-slate-400 leading-relaxed font-semibold">
                        <div className="bg-slate-900/40 p-2 rounded">
                          <strong className="text-slate-300 block mb-1">1. Sync with Champions</strong>
                          Locate top power users via intelligence profile; arrange a check-in to clear roadblock telemetry.
                        </div>
                        <div className="bg-slate-900/40 p-2 rounded">
                          <strong className="text-slate-300 block mb-1">2. Resolve Anomalies</strong>
                          Open the details card to check exact anomaly triggers (e.g. low stickiness, failed workflow execution).
                        </div>
                        <div className="bg-slate-900/40 p-2 rounded">
                          <strong className="text-slate-300 block mb-1">3. Drive Module Breadth</strong>
                          Identify un-integrated capabilities & demo them to client to increase usage longevity.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Slide 2: Adoption Insights */}
            {currentSlide === 2 && (
              <div className="space-y-6 animate-fade-in">
                {/* Visual grid of 3 adoption charts */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-slate-800/50 border border-slate-800 p-5 rounded-xl flex flex-col h-80">
                    <h4 className="font-black text-slate-200 text-xs uppercase tracking-wider mb-3">Module Penetration Index</h4>
                    <div className="flex-1 relative">
                      <canvas ref={canvasRefs.moduleUsage}></canvas>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 border border-slate-800 p-5 rounded-xl flex flex-col h-80">
                    <h4 className="font-black text-slate-200 text-xs uppercase tracking-wider mb-3">Automation Adoption Index</h4>
                    <div className="flex-1 relative">
                      <canvas ref={canvasRefs.automation}></canvas>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 border border-slate-800 p-5 rounded-xl flex flex-col h-80">
                    <h4 className="font-black text-slate-200 text-xs uppercase tracking-wider mb-3">Health vs Stickiness Matrix</h4>
                    <div className="flex-1 relative">
                      <canvas ref={canvasRefs.scatter}></canvas>
                    </div>
                  </div>
                </div>

                {/* Extra presentation metrics on bottom */}
                <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                      <Cpu className="w-5 h-5 animate-spin-slow" />
                    </span>
                    <div>
                      <h4 className="font-bold text-slate-200 text-xs">AECAutopilot Workflow Optimization</h4>
                      <p className="text-[10px] text-slate-400 font-semibold">Average Automation Adoption score is <strong className="text-indigo-400 font-black">{Math.round(portfolioData.summary?.avgAutomationScore || 0)}</strong>/100 across client portals</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-center">
                      <div className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Average Stickiness</div>
                      <div className="text-xs font-black text-emerald-400 font-mono">{pct(portfolioData.summary?.avgStickiness)}</div>
                    </div>
                    <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-center">
                      <div className="text-slate-500 text-[9px] font-black uppercase tracking-wider">High Adoption Orgs</div>
                      <div className="text-xs font-black text-indigo-400 font-mono">{(portfolioData.accounts || []).filter(a => (a.automationAdoptionScore || 0) > 65).length} Portals</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ACCOUNT DETAIL DRILLED PROFILE (If drillOrgId is active and has detail) */}
        {!isPresentationMode && drillOrgId && accountDetail && !detailLoading && (
          <div className="animate-fade-in">
            {/* Header profile title */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-black text-2xl tracking-tight text-slate-900">
                      {accountDetail.profile?.organizationName || getOrgName(drillOrgId)}
                    </h2>
                    {!accountDetail.hasSnapshot && (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                        Live Streamed Data
                      </span>
                    )}
                    <button
                      onClick={(e) => copyToClipboard(drillOrgId, e)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 p-1 rounded transition text-xs flex items-center gap-1"
                      title="Copy Org ID"
                    >
                      <Copy className="w-3 h-3" />
                      <span className="text-[10px] font-bold">Copy ID</span>
                    </button>
                  </div>
                  {/* Subtitle details */}
                  <div className="text-xs text-slate-500 font-semibold mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                    {accountDetail.profile?.accountNumber && <span>Acc: {accountDetail.profile.accountNumber}</span>}
                    {accountDetail.profile?.organizationType && <span>Type: {accountDetail.profile.organizationType}</span>}
                    {accountDetail.profile?.countryCode && <span>Region: {accountDetail.profile.countryCode}</span>}
                    {accountDetail.profile?.emailAddress && <span>Contact: {accountDetail.profile.emailAddress}</span>}
                    {accountDetail.profile?.subscription?.paymentTenure && (
                      <span className="text-indigo-600">
                        Plan: {accountDetail.profile.subscription.paymentTenure} ({accountDetail.profile.subscription.isSubscriptionPlanActive ? 'Active' : 'Expired'})
                      </span>
                    )}
                    {accountDetail.profile?.subscription?.licenseCount && (
                      <span>
                        Licenses: {accountDetail.profile.subscription.licenseCountUsed ?? 0}/{accountDetail.profile.subscription.licenseCount}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={clearDrill}
                  className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm transition"
                >
                  ← Back to Portfolio Overview
                </button>
              </div>
            </div>

            {/* Metric KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center flex flex-col justify-between">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Health Score</span>
                <div className="my-2">{renderHealthPill(accountDetail.health?.healthScore || 0, accountDetail.health?.healthBucket || 'critical')}</div>
                <span className="text-[10px] text-slate-500 font-bold capitalize">{accountDetail.health?.healthBucket || '—'}</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center flex flex-col justify-between">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Health Trend</span>
                <div className="my-2 flex justify-center items-center gap-1">
                  {renderTrendIcon(accountDetail.health?.healthTrend)}
                  <span className="font-black text-slate-800 text-lg capitalize">{accountDetail.health?.healthTrend || 'Stable'}</span>
                </div>
                <span className="text-[10px] text-slate-500 font-bold">Based on 14 days</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center flex flex-col justify-between">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Stickiness Ratio</span>
                <div className="font-black text-slate-900 text-2xl my-2">{pct(accountDetail.health?.stickinessRatio)}</div>
                <span className="text-[10px] text-slate-500 font-bold">DAU / MAU ratio</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center flex flex-col justify-between">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">User Engagement</span>
                <div className="font-black text-slate-900 text-lg my-2">
                  {accountDetail.health?.dau ?? '0'}/{accountDetail.health?.wau ?? '0'}/{accountDetail.health?.mau ?? '0'}
                </div>
                <span className="text-[10px] text-slate-500 font-bold">DAU / WAU / MAU</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center flex flex-col justify-between">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Active (30d)</span>
                <div className="font-black text-slate-900 text-2xl my-2">{accountDetail.health?.activeUsers30d ?? '0'}</div>
                <span className="text-[10px] text-slate-500 font-bold">Unique users active</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center flex flex-col justify-between">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Last Module</span>
                <div className="font-black text-indigo-600 text-sm truncate my-2.5 px-1" title={accountDetail.adoption?.lastModuleUsedLabel || '—'}>
                  {accountDetail.adoption?.lastModuleUsedLabel || '—'}
                </div>
                <span className="text-[10px] text-slate-500 font-bold">Most recent interaction</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center flex flex-col justify-between">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Critical Alerts</span>
                <div className={`font-black text-2xl my-2 ${accountDetail.health?.openAlerts?.critical > 0 ? 'text-red-500' : 'text-slate-900'}`}>
                  {accountDetail.health?.openAlerts?.critical || 0}
                </div>
                <span className="text-[10px] text-slate-500 font-bold">Requiring attention</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center flex flex-col justify-between">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Last Active</span>
                <div className="font-black text-slate-900 text-xs my-3 truncate px-1">
                  {fmtDate(accountDetail.health?.lastActivityAt)}
                </div>
                <span className="text-[10px] text-slate-500 font-bold">Activity recency</span>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-widest mb-3 text-slate-400">Health Score Trend (14d)</h4>
                <div className="h-44 relative">
                  <canvas ref={canvasRefs.detailHealth}></canvas>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-widest mb-3 text-slate-400">Daily Telemetry Load (14d)</h4>
                <div className="h-44 relative">
                  <canvas ref={canvasRefs.detailActivity}></canvas>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-widest mb-3 text-slate-400">Activity by Module (30d)</h4>
                <div className="h-44 relative">
                  <canvas ref={canvasRefs.detailModule}></canvas>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-widest mb-3 text-slate-400">Stickiness Trend (14d)</h4>
                <div className="h-44 relative">
                  <canvas ref={canvasRefs.detailStick}></canvas>
                </div>
              </div>
            </div>

            {/* Split panels for deep intelligence */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Engagement metrics & risks */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h4 className="font-black text-sm text-slate-900 mb-4 border-b border-slate-100 pb-2 flex items-center gap-1.5 text-indigo-600">
                  <Activity className="w-4 h-4" /> Engagement & Risk Analysis
                </h4>
                <div className="space-y-3.5 text-xs font-semibold">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Predicted Churn Risk Score</span>
                    <span className={`font-bold ${
                      (accountDetail.health?.riskScore || 0) > 70 ? 'text-red-500' :
                      (accountDetail.health?.riskScore || 0) > 40 ? 'text-amber-500' : 'text-emerald-500'
                    }`}>
                      {accountDetail.health?.riskScore ?? '—'} / 100
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Modules Integrated</span>
                    <span>{accountDetail.health?.moduleBreadth ?? '—'} modules</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Automation Adoption index</span>
                    <span>{accountDetail.health?.automationAdoptionScore ?? '—'} / 100</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Open Critical Warnings</span>
                    <span className="text-amber-500">{accountDetail.health?.openAlerts?.warning ?? 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Open Escalation Tickets</span>
                    <span className="text-orange-500">{accountDetail.health?.openAlerts?.escalated ?? 0}</span>
                  </div>
                  {accountDetail.snapshotDate && (
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Snapshot timestamp</span>
                      <span>{new Date(accountDetail.snapshotDate).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Automation Health */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h4 className="font-black text-sm text-slate-900 mb-4 border-b border-slate-100 pb-2 flex items-center gap-1.5 text-indigo-600">
                  <Cpu className="w-4 h-4" /> Automation Health Metrics
                </h4>
                <div className="space-y-3.5 text-xs font-semibold">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Active Workflow Routines</span>
                    <span className="font-black text-indigo-600">{accountDetail.automation?.activeWorkflowCount ?? '—'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Executions (30 days)</span>
                    <span className="text-slate-700">
                      <strong className="text-emerald-500">{accountDetail.automation?.executionsCompleted ?? 0}</strong> completed / <strong className="text-red-500">{accountDetail.automation?.executionsFailed ?? 0}</strong> failed
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Workflow Execution Failure Rate</span>
                    <span className={accountDetail.automation?.failureRate > 0.1 ? 'text-red-500 font-bold' : 'text-emerald-500 font-bold'}>
                      {pct(accountDetail.automation?.failureRate)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Last Workflow Triggered</span>
                    <span>{fmtDate(accountDetail.automation?.lastExecutionAt)}</span>
                  </div>
                </div>
              </div>

              {/* Onboarding milestones */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h4 className="font-black text-sm text-slate-900 mb-4 border-b border-slate-100 pb-2 flex items-center gap-1.5 text-indigo-600">
                  <Milestone className="w-4 h-4" /> Onboarding & Milestone Health
                </h4>
                <div className="space-y-2.5 max-h-44 overflow-y-auto pr-1">
                  {(accountDetail.onboarding?.milestones || []).map((m: any, i: number) => (
                    <div key={i} className="flex justify-between items-center text-xs font-semibold py-1.5 border-b border-slate-50">
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        <span className="capitalize">{m.milestoneKey.replace(/_/g, " ")}</span>
                      </span>
                      <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded text-[10px] font-bold">
                        Achieved in {m.daysToAchieve?.toFixed(0)}d
                      </span>
                    </div>
                  ))}
                  {(accountDetail.onboarding?.missingMilestones || []).map((m: any, i: number) => (
                    <div key={i} className="flex justify-between items-center text-xs font-semibold py-1.5 border-b border-slate-50">
                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                        <span className="capitalize">{m.replace(/_/g, " ")}</span>
                      </span>
                      <span className="bg-red-50 text-red-500 px-1.5 py-0.5 rounded text-[10px] font-bold">
                        Pending
                      </span>
                    </div>
                  ))}
                  {!(accountDetail.onboarding?.milestones || []).length && !(accountDetail.onboarding?.missingMilestones || []).length && (
                    <div className="text-center py-6 text-slate-400 text-xs font-medium">No milestone telemetries found.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Expansion panel for features list breakdown */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-6">
              <h4 className="font-black text-sm text-slate-900 mb-1 flex items-center gap-1.5 text-indigo-600">
                <Layers className="w-4 h-4" /> Feature & Actions Breakdown (30 days)
              </h4>
              <p className="text-xs text-slate-500 font-semibold mb-4">Expand a module to inspect feature-level interaction volume.</p>

              {(!accountDetail.adoption?.moduleBreakdown || accountDetail.adoption.moduleBreakdown.length === 0) ? (
                <div className="text-center py-6 text-slate-400 text-xs font-semibold">No features telemetry streamed in the past 30 days.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {accountDetail.adoption.moduleBreakdown.map((mod: any, i: number) => (
                    <details key={i} className="group bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-lg overflow-hidden transition duration-150">
                      <summary className="cursor-pointer list-none flex items-center justify-between p-3.5 focus:outline-none select-none">
                        <div>
                          <h5 className="font-extrabold text-xs text-slate-900 tracking-tight">
                            {mod.label || formatModuleName(mod.logSource)}
                          </h5>
                          <span className="text-[10px] text-slate-500 font-bold mt-1 block">
                            {mod.totalActivityCount?.toLocaleString()} operations · Last used: {fmtDate(mod.lastUsedAt)}
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-90" />
                      </summary>
                      <div className="p-3 border-t border-slate-200 bg-white space-y-2.5 max-h-48 overflow-y-auto">
                        {(mod.features || []).map((f: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-[11px] font-semibold">
                            <span className="text-slate-600 truncate mr-2" title={f.label || formatLogEvent(f.logEvent)}>
                              {f.label || formatLogEvent(f.logEvent)}
                            </span>
                            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-black">
                              {f.activityCount?.toLocaleString()}
                            </span>
                          </div>
                        ))}
                        {!(mod.features || []).length && (
                          <div className="text-center py-2 text-slate-400 text-[10px]">No feature action metadata.</div>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>

            {/* Modules Unused */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-6">
              <h4 className="font-black text-sm text-slate-900 mb-3 flex items-center gap-1.5 text-indigo-600">
                <BookOpen className="w-4 h-4" /> Feature Discovery & Unused Modules
              </h4>
              <div className="flex flex-wrap gap-2">
                {(accountDetail.adoption?.modulesUnusedLabels || []).map((l: string, i: number) => (
                  <span key={i} className="bg-slate-100 border border-slate-200 text-slate-500 font-bold text-xs px-3 py-1 rounded-full line-through">
                    {l}
                  </span>
                ))}
                {!(accountDetail.adoption?.modulesUnusedLabels || []).length && (
                  <div className="text-xs text-slate-400 font-semibold">All tracked modules have interaction data. Excellent portfolio penetration!</div>
                )}
              </div>
            </div>

            {/* Champion Users & Inactive Users */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h4 className="font-black text-sm text-slate-900 mb-4 border-b border-slate-100 pb-2 flex items-center gap-1.5 text-indigo-600">
                  <Users className="w-4 h-4" /> Champion Power Users (Top 10)
                </h4>
                {(!accountDetail.topUsers || accountDetail.topUsers.length === 0) ? (
                  <div className="text-center py-8 text-slate-400 text-xs font-semibold">No telemetry for user accounts in past 30 days.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs font-semibold">
                      <thead>
                        <tr className="border-b border-slate-200 text-[10px] text-slate-400 uppercase tracking-wider text-left">
                          <th className="pb-2">User Email / Handle</th>
                          <th className="pb-2 text-center">Activities</th>
                          <th className="pb-2 text-center">Modules</th>
                          <th className="pb-2">Preferred Module</th>
                          <th className="pb-2 text-right">Last Telemetry</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accountDetail.topUsers.map((u: any, i: number) => (
                          <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-2.5 max-w-[140px] truncate" title={u.userName}>{u.userName}</td>
                            <td className="py-2.5 text-center font-black text-slate-900">{u.activityCount}</td>
                            <td className="py-2.5 text-center">{u.distinctModules}</td>
                            <td className="py-2.5 text-indigo-600 font-bold">{u.lastModuleLabel || '—'}</td>
                            <td className="py-2.5 text-right text-slate-500">{fmtDate(u.lastActivityAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h4 className="font-black text-sm text-slate-900 mb-4 border-b border-slate-100 pb-2 flex items-center gap-1.5 text-indigo-600">
                  <Clock className="w-4 h-4" /> Inactive Users & Churn Warning Signs
                </h4>
                {(!accountDetail.inactiveUsers || accountDetail.inactiveUsers.length === 0) ? (
                  <div className="text-center py-8 text-slate-400 text-xs font-semibold font-medium">All users are actively interacting with the suite.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs font-semibold">
                      <thead>
                        <tr className="border-b border-slate-200 text-[10px] text-slate-400 uppercase tracking-wider text-left">
                          <th className="pb-2">User Email / Handle</th>
                          <th className="pb-2 text-center">Duration Inactive</th>
                          <th className="pb-2 text-right">Primary Module</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accountDetail.inactiveUsers.slice(0, 10).map((u: any, i: number) => (
                          <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-2.5 max-w-[180px] truncate" title={u.userName}>{u.userName}</td>
                            <td className="py-2.5 text-center text-red-500 font-black">{u.daysSinceLastActive ?? '—'} days</td>
                            <td className="py-2.5 text-right text-slate-500 font-bold">{u.lastModuleLabel || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Account Specific Alerts */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-10">
              <h4 className="font-black text-sm text-slate-900 mb-4 border-b border-slate-100 pb-2 flex items-center gap-1.5 text-red-600">
                <AlertTriangle className="w-4 h-4" /> Active Anomalies & Core Alerts ({(accountDetail.alerts || []).length})
              </h4>
              {(!accountDetail.alerts || accountDetail.alerts.length === 0) ? (
                <div className="text-center py-6 text-slate-400 text-xs font-semibold">No critical or warning anomalies currently active for this account.</div>
              ) : (
                <div className="space-y-3">
                  {accountDetail.alerts.map((al: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100/50 transition">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider mt-0.5 ${
                        al.severity === 'CRITICAL' || al.severity === 'ALERT' ? 'bg-red-100 text-red-700 border border-red-200' :
                        al.severity === 'WARNING' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                        'bg-orange-100 text-orange-700 border border-orange-200'
                      }`}>
                        {al.severity}
                      </span>
                      <div className="flex-1 text-xs font-semibold">
                        <div className="font-extrabold text-slate-900">{al.ruleName}</div>
                        {al.description && <div className="text-slate-500 font-medium mt-1">{al.description}</div>}
                        <div className="text-[10px] text-slate-400 mt-1.5 font-bold">
                          System Scope: {al.entityType} • First Detected: {fmtDate(al.firstDetectedAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PORTFOLIO STREAM OVERVIEW PANEL (Default view) */}
        {!isPresentationMode && portfolioData && !drillOrgId && !loading && (
          <div className="animate-fade-in">
            {/* 8 Stats KPI dashboard cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest leading-normal">Total Portfolios</span>
                <div className="font-black text-indigo-600 text-3xl my-2 leading-none">{portfolioData.summary?.totalAccounts || 0}</div>
                <span className="text-[10px] text-slate-400 font-bold">Monitored Orgs</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest leading-normal">Average Health</span>
                <div className="font-black text-emerald-500 text-3xl my-2 leading-none">{portfolioData.summary?.avgHealthScore || 0}</div>
                <span className="text-[10px] text-slate-400 font-bold">Portfolio Index</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest leading-normal">Urgent Attention</span>
                <div className={`font-black text-3xl my-2 leading-none ${portfolioData.summary?.accountsNeedingAttention > 0 ? 'text-red-500' : 'text-slate-900'}`}>
                  {portfolioData.summary?.accountsNeedingAttention || 0}
                </div>
                <span className="text-[10px] text-slate-400 font-bold">Low score & Declining</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest leading-normal">Critical Score</span>
                <div className={`font-black text-3xl my-2 leading-none ${portfolioData.summary?.distribution?.critical > 0 ? 'text-red-500' : 'text-slate-900'}`}>
                  {portfolioData.summary?.distribution?.critical || 0}
                </div>
                <span className="text-[10px] text-slate-400 font-bold">Score &lt; 40 index</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest leading-normal">Stickiness Index</span>
                <div className="font-black text-slate-900 text-3xl my-2 leading-none">{pct(portfolioData.summary?.avgStickiness)}</div>
                <span className="text-[10px] text-slate-400 font-bold">Average DAU / MAU</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest leading-normal">Automation Score</span>
                <div className="font-black text-slate-900 text-3xl my-2 leading-none">{portfolioData.summary?.avgAutomationScore || 0}</div>
                <span className="text-[10px] text-slate-400 font-bold">Process Adoption</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest leading-normal">Critical Alerts</span>
                <div className={`font-black text-3xl my-2 leading-none ${portfolioData.summary?.totalCriticalAlerts > 0 ? 'text-red-500' : 'text-slate-900'}`}>
                  {portfolioData.summary?.totalCriticalAlerts || 0}
                </div>
                <span className="text-[10px] text-slate-400 font-bold">Active system anomalies</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest leading-normal">High Churn Risk</span>
                <div className={`font-black text-3xl my-2 leading-none ${portfolioData.summary?.churnRiskOrgs > 0 ? 'text-red-500' : 'text-slate-900'}`}>
                  {portfolioData.summary?.churnRiskOrgs || 0}
                </div>
                <span className="text-[10px] text-slate-400 font-bold">Imminent churn warning</span>
              </div>
            </div>

            {/* First Charts row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col">
                <h4 className="font-bold text-slate-400 text-[10px] uppercase tracking-widest mb-3">Portfolio Health Breakdown</h4>
                <div className="h-48 relative flex-1">
                  <canvas ref={canvasRefs.healthMix}></canvas>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col">
                <h4 className="font-bold text-slate-400 text-[10px] uppercase tracking-widest mb-3">Health Trend Direction</h4>
                <div className="h-48 relative flex-1">
                  <canvas ref={canvasRefs.trendMix}></canvas>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col">
                <h4 className="font-bold text-slate-400 text-[10px] uppercase tracking-widest mb-3">Portfolio Avg Health (14 Days)</h4>
                <div className="h-48 relative flex-1">
                  <canvas ref={canvasRefs.dailyTrend}></canvas>
                </div>
              </div>
            </div>

            {/* Second Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col">
                <h4 className="font-bold text-slate-400 text-[10px] uppercase tracking-widest mb-3">Lowest Health Accounts (Critical Priority)</h4>
                <div className="h-64 relative flex-1">
                  <canvas ref={canvasRefs.atRisk}></canvas>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col">
                <h4 className="font-bold text-slate-400 text-[10px] uppercase tracking-widest mb-3">Customer Engagement Matrix (Health vs Stickiness)</h4>
                <div className="h-64 relative flex-1">
                  <canvas ref={canvasRefs.scatter}></canvas>
                </div>
              </div>
            </div>

            {/* Third Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col">
                <h4 className="font-bold text-slate-400 text-[10px] uppercase tracking-widest mb-3">Integrated Module Penetration (Active accounts)</h4>
                <div className="h-64 relative flex-1">
                  <canvas ref={canvasRefs.moduleUsage}></canvas>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col">
                <h4 className="font-bold text-slate-400 text-[10px] uppercase tracking-widest mb-3">Automation Flow Implementation Index</h4>
                <div className="h-64 relative flex-1">
                  <canvas ref={canvasRefs.automation}></canvas>
                </div>
              </div>
            </div>

            {/* Fourth Charts row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col hover:shadow-md transition duration-200">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
                  <Users className="w-4 h-4 text-indigo-500" />
                  <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Monthly Active User Distribution</h4>
                </div>
                <div className="h-56 relative flex-1">
                  <canvas ref={canvasRefs.mauDist}></canvas>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col hover:shadow-md transition duration-200">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Most Recent Telemetry Recency</h4>
                </div>
                <div className="h-56 relative flex-1">
                  <canvas ref={canvasRefs.recency}></canvas>
                </div>
              </div>
            </div>

            {/* Master Customer Accounts Listing */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="font-black text-slate-900 text-base">Customer Account Telemetry Directory</h3>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">Real-time health indices across integrated portals</p>
                </div>
                <span className="text-xs font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-full">
                  {activeAccounts.length} / {portfolioData.accounts?.length || 0} Portals filtered
                </span>
              </div>

              {/* CS Quick-Review Presentation Toggles */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4 bg-indigo-50/40 border border-indigo-100/60 p-2.5 rounded-xl">
                <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider pl-1.5 flex items-center gap-1 flex-shrink-0">
                  <Award className="w-3.5 h-3.5" />
                  CS Quick Focus:
                </span>
                <div className="flex flex-wrap gap-1.5 sm:ml-2">
                  {[
                    { id: 'all', label: "🎯 Show All Portfolio", count: portfolioData.accounts?.length || 0, color: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-indigo-200' },
                    { id: 'declining', label: "📉 Declining Trajectory", count: (portfolioData.accounts || []).filter(a => a.healthTrend === 'declining').length, color: 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100' },
                    { id: 'critical', label: "🚨 Critical Health (< 40)", count: (portfolioData.accounts || []).filter(a => a.healthBucket === 'critical').length, color: 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' },
                    { id: 'alert_heavy', label: "🔥 Active Critical Alerts", count: (portfolioData.accounts || []).filter(a => (a.openAlertsCritical || 0) > 0).length, color: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' }
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      type="button"
                      onClick={() => setCsQuickFilter(btn.id as any)}
                      className={`text-[11px] font-extrabold px-3 py-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                        csQuickFilter === btn.id
                          ? 'bg-slate-800 border-slate-900 text-white shadow-sm'
                          : btn.color
                      }`}
                    >
                      <span>{btn.label}</span>
                      <span className={`text-[9px] px-1 rounded-full ${csQuickFilter === btn.id ? 'bg-slate-700 text-slate-100' : 'bg-black/5 text-slate-600'}`}>{btn.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Filtering bar in UI */}
              <div className="flex flex-wrap gap-3 mb-5 items-center bg-slate-50 border border-slate-200 p-3.5 rounded-lg text-xs font-bold">
                <div className="flex items-center bg-white border border-slate-300 rounded-lg px-3.5 py-1.5 shadow-sm max-w-xs flex-1">
                  <Search className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
                  <input
                    type="text"
                    className="focus:outline-none bg-transparent w-full font-semibold placeholder-slate-400 text-slate-700"
                    placeholder="Search client portals, UUIDs or contacts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="p-0.5 hover:text-slate-800 text-slate-400">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <select
                    className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-bold shadow-sm focus:outline-none"
                    value={filterBucket}
                    onChange={(e) => setFilterBucket(e.target.value)}
                  >
                    <option value="">All Health Categories</option>
                    <option value="healthy">Healthy (70+)</option>
                    <option value="at-risk">At Risk (40-69)</option>
                    <option value="critical">Critical (&lt;40)</option>
                  </select>

                  <select
                    className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-bold shadow-sm focus:outline-none"
                    value={filterTrend}
                    onChange={(e) => setFilterTrend(e.target.value)}
                  >
                    <option value="">All Directions</option>
                    <option value="improving">Improving</option>
                    <option value="stable">Stable</option>
                    <option value="declining">Declining</option>
                  </select>
                </div>
              </div>

              {/* Portal list table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="min-w-full text-xs font-semibold text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] uppercase tracking-wider text-left select-none">
                    <tr>
                      <th onClick={() => handleSort('name')} className="px-5 py-3 cursor-pointer hover:bg-slate-100 transition">
                        <div className="flex items-center gap-1.5">
                          Customer Profile <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </th>
                      <th onClick={() => handleSort('healthScore')} className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          Health <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </th>
                      <th onClick={() => handleSort('healthTrend')} className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          Trend <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </th>
                      <th onClick={() => handleSort('stickinessRatio')} className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          Stickiness <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </th>
                      <th onClick={() => handleSort('mau')} className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          MAU <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </th>
                      <th onClick={() => handleSort('moduleBreadth')} className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition">
                        <div className="flex items-center gap-1.5">
                          Integrated Capabilities <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </th>
                      <th onClick={() => handleSort('lastModuleUsed')} className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition">
                        <div className="flex items-center gap-1.5">
                          Last Module <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </th>
                      <th onClick={() => handleSort('automationAdoptionScore')} className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          Automation <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </th>
                      <th onClick={() => handleSort('openAlertsCritical')} className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          Anomalies <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </th>
                      <th onClick={() => handleSort('lastActivityAt')} className="px-5 py-3 cursor-pointer hover:bg-slate-100 transition text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          Last Active <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {activeAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-5 py-12 text-center text-slate-400 font-semibold">
                          No matching active clients found with specified metrics.
                        </td>
                      </tr>
                    ) : (
                      activeAccounts.map((acc: any) => {
                        const cached = orgDetailsCache[acc.organizationId] || {};
                        const name = acc.organizationName || cached.organizationName || getOrgName(acc.organizationId);
                        const hasKeyMetas = acc.accountNumber || cached.accountNumber || acc.organizationType || cached.organizationType || acc.countryCode || cached.countryCode;

                        return (
                          <tr
                            key={acc.organizationId}
                            onClick={() => drillIntoOrg(acc.organizationId)}
                            className="hover:bg-indigo-50/40 cursor-pointer transition duration-150"
                          >
                            <td className="px-5 py-3 max-w-[240px]">
                              <div className="flex items-start gap-2.5">
                                <div className="flex-1 min-w-0">
                                  <div className="font-extrabold text-slate-900 truncate" title={name}>{name}</div>
                                  {hasKeyMetas && (
                                    <div className="text-[10px] text-slate-400 font-bold truncate mt-0.5">
                                      {[
                                        acc.accountNumber || cached.accountNumber,
                                        acc.organizationType || cached.organizationType,
                                        acc.countryCode || cached.countryCode
                                      ].filter(Boolean).join(" • ")}
                                    </div>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  title="Copy unique org ID"
                                  onClick={(e) => copyToClipboard(acc.organizationId, e)}
                                  className="p-1 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-white rounded-md border border-slate-200 shadow-sm transition"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {renderHealthPill(acc.healthScore, acc.healthBucket)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                acc.healthTrend === 'improving' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                acc.healthTrend === 'declining' ? 'bg-red-50 text-red-600 border border-red-100' :
                                'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}>
                                {acc.healthTrend || 'stable'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-slate-800">
                              {pct(acc.stickinessRatio)}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-slate-800">
                              {acc.mau ?? 0}
                            </td>
                            <td className="px-4 py-3 max-w-[180px]">
                              <div className="flex flex-wrap gap-1.5">
                                {(acc.modulesUsed || []).slice(0, 3).map((m: string, i: number) => (
                                  <span key={i} className="bg-indigo-50 border border-indigo-100 text-indigo-600 font-bold px-1.5 py-0.5 rounded text-[9px] truncate max-w-[70px]">
                                    {formatModuleName(m)}
                                  </span>
                                ))}
                                {(acc.modulesUsed || []).length > 3 && (
                                  <span className="bg-slate-100 border border-slate-200 text-slate-500 font-bold px-1.5 py-0.5 rounded text-[9px]">
                                    +{(acc.modulesUsed || []).length - 3}
                                  </span>
                                )}
                                {!(acc.modulesUsed || []).length && (
                                  <span className="text-slate-400 font-medium italic">None</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 font-extrabold text-indigo-600">
                              {acc.lastModuleUsed ? formatModuleName(acc.lastModuleUsed) : '—'}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-slate-800">
                              {Math.round(acc.automationAdoptionScore)}
                            </td>
                            <td className="px-4 py-3 text-center font-black">
                              {acc.openAlertsCritical > 0 ? (
                                <span className="text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded font-black text-[10px]">
                                  {acc.openAlertsCritical}
                                </span>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )}
                            </td>
                            <td className="px-5 py-3 text-right text-slate-500 font-bold">
                              {fmtDate(acc.lastActivityAt)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
