import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AGENT_MAP, fmtSec, fmtPct } from "./utils.js";
import { useDashboardController } from "./controllers/useDashboardController.js";
import {
  filterByDateRange,
  pickConsRowsForKpisByDay,
} from "./models/dashboardModel.js";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  ClipboardList,
  Clock,
  Phone,
  Plus,
  Receipt,
  ShieldCheck,
  Target,
  Ticket,
  Trophy,
  Users,
} from "lucide-react";

const Ico = ({ Icon, size = 14, stroke = 2.25 }) => (
  <Icon
    size={size}
    strokeWidth={stroke}
    style={{ display: "inline-block", verticalAlign: "-2px" }}
  />
);

const DARK_THEME = {
  bg: "#0c0e14",
  card: "#13161f",
  cardH: "#191d2a",
  bdr: "#1e2233",
  accent: "#3b82f6",
  green: "#10b981",
  greenD: "#064e3b",
  red: "#ef4444",
  redD: "#7f1d1d",
  orange: "#f59e0b",
  orangeD: "#78350f",
  purple: "#8b5cf6",
  cyan: "#06b6d4",
  pink: "#ec4899",
  text: "#e2e8f0",
  dim: "#64748b",
  muted: "#334155",
};

const LIGHT_THEME = {
  bg: "#F5F5F7",
  card: "#FFFFFF",
  cardH: "#F2F2F2",
  bdr: "#DDDDDD",
  accent: "#5500FF",
  green: "#00D4AA",
  greenD: "#EDEDEE",
  red: "#FF0000",
  redD: "#FFEAEA",
  orange: "#E65100",
  orangeD: "#FFF2E8",
  purple: "#0086D1",
  cyan: "#74CFD0",
  pink: "#ED008C",
  text: "#3C3C3B",
  dim: "#888888",
  muted: "#3C3C3C",
};

const PIE_C_DARK = [
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#64748b",
];

const PIE_C_LIGHT = [
  "#5500FF",
  "#ED008C",
  "#00D4AA",
  "#FFC000",
  "#0086D1",
  "#E65100",
  "#888888",
];

const INITIAL_THEME_MODE =
  typeof window !== "undefined" &&
  window.localStorage.getItem("theme-mode") === "light"
    ? "light"
    : "dark";

let P = INITIAL_THEME_MODE === "light" ? LIGHT_THEME : DARK_THEME;
let PIE_C = INITIAL_THEME_MODE === "light" ? PIE_C_LIGHT : PIE_C_DARK;

const ResumoTab = lazy(() => import("./tabs/ResumoTab.jsx"));
const TicketsTab = lazy(() => import("./tabs/TicketsTab.jsx"));
const AtividadeHoraTab = lazy(() => import("./tabs/AtividadeHoraTab.jsx"));

const API_BASE = String(import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

function parseApiDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const text = String(value).trim();
  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const year = Number.parseInt(dateOnly[1], 10);
    const month = Number.parseInt(dateOnly[2], 10);
    const day = Number.parseInt(dateOnly[3], 10);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function KPI({ label, value, sub, color, icon, series, hero = false }) {
  const lineColor = color || P.accent;
  const sparkData = useMemo(() => {
    if (!Array.isArray(series) || series.length < 2) return null;
    const cleaned = series
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v));
    if (cleaned.length < 2) return null;
    if (cleaned.every((v) => v === 0)) return null;
    return cleaned.map((v, i) => ({ i, v }));
  }, [series]);
  const gradientId = useMemo(
    () => `spark-${Math.random().toString(36).slice(2, 9)}`,
    [],
  );

  return (
    <div
      style={{
        background: P.card,
        borderRadius: 14,
        padding: hero ? "20px 22px 18px" : "16px 18px",
        border: `1px solid ${hero ? `${lineColor}55` : P.bdr}`,
        flex: hero ? "2 1 320px" : "1 1 150px",
        minWidth: hero ? 280 : 140,
        transition: "all .2s",
        boxShadow: hero ? `0 1px 0 ${lineColor}10 inset` : "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = lineColor;
        e.currentTarget.style.background = P.cardH;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = hero ? `${lineColor}55` : P.bdr;
        e.currentTarget.style.background = P.card;
      }}
    >
      <div
        style={{
          fontSize: hero ? 11 : 10,
          color: P.dim,
          textTransform: "uppercase",
          letterSpacing: hero ? 1.8 : 1.5,
          marginBottom: hero ? 6 : 4,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {icon} {label}
      </div>
      <div
        style={{
          fontSize: hero ? 46 : 26,
          fontWeight: 800,
          color: color || P.text,
          lineHeight: 1.05,
          letterSpacing: hero ? -1 : -0.2,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: hero ? 12 : 11,
            color: P.muted,
            marginTop: hero ? 6 : 3,
          }}
        >
          {sub}
        </div>
      )}
      {sparkData && (
        <div
          title={`Últimos ${sparkData.length} dias`}
          style={{
            height: hero ? 56 : 34,
            marginTop: hero ? 14 : 10,
            marginLeft: -6,
            marginRight: -6,
            cursor: "help",
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={sparkData}
              margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={lineColor}
                    stopOpacity={hero ? 0.45 : 0.35}
                  />
                  <stop
                    offset="100%"
                    stopColor={lineColor}
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={lineColor}
                strokeWidth={hero ? 2 : 1.5}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
                dot={false}
                activeDot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div style={{ marginTop: 28 }}>
      <h2
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: P.text,
          margin: "0 0 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          letterSpacing: 0.5,
        }}
      >
        {icon} {title}
      </h2>
      {children}
    </div>
  );
}

function Table({
  headers,
  rows,
  onRowClick,
  selectedRowIndex,
  sortable = false,
  getSortValue,
}) {
  const [sort, setSort] = useState({ col: null, dir: null });

  const sortedView = useMemo(() => {
    if (!sortable || sort.col == null || sort.dir == null) {
      return rows.map((row, ri) => ({ row, originalIndex: ri }));
    }

    const indexed = rows.map((row, ri) => ({ row, originalIndex: ri }));
    const extract = (row) => {
      const cell = row[sort.col];
      const fromGetter = getSortValue
        ? getSortValue(cell, sort.col, row)
        : undefined;
      const value = fromGetter !== undefined ? fromGetter : cell;

      if (value == null) return { num: null, str: "" };
      if (typeof value === "number") return { num: value, str: "" };
      if (value instanceof Date) return { num: value.getTime(), str: "" };

      const str = String(value);
      const numericMatch = str.match(/-?\d+(?:[.,]\d+)?/);
      const num = numericMatch
        ? Number.parseFloat(numericMatch[0].replace(",", "."))
        : Number.NaN;

      return {
        num: Number.isFinite(num) ? num : null,
        str: str.toLowerCase(),
      };
    };

    indexed.sort((a, b) => {
      const va = extract(a.row);
      const vb = extract(b.row);
      let cmp;
      if (va.num != null && vb.num != null) {
        cmp = va.num - vb.num;
      } else {
        cmp = va.str.localeCompare(vb.str, "pt-BR");
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });

    return indexed;
  }, [rows, sort, sortable, getSortValue]);

  const handleHeaderClick = (colIndex) => {
    if (!sortable) return;
    setSort((current) => {
      if (current.col !== colIndex) return { col: colIndex, dir: "asc" };
      if (current.dir === "asc") return { col: colIndex, dir: "desc" };
      return { col: null, dir: null };
    });
  };

  const sortIndicator = (colIndex) => {
    if (!sortable || sort.col !== colIndex || !sort.dir) return null;
    return (
      <span
        style={{
          marginLeft: 4,
          fontFamily: "'JetBrains Mono','Fira Code',ui-monospace,monospace",
          color: P.accent,
          fontSize: 9,
        }}
      >
        {sort.dir === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  return (
    <div
      style={{
        overflowX: "auto",
        borderRadius: 12,
        border: `1px solid ${P.bdr}`,
      }}
    >
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
      >
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                onClick={() => handleHeaderClick(i)}
                style={{
                  padding: "10px 10px",
                  textAlign: i === 0 ? "left" : "right",
                  color:
                    sortable && sort.col === i && sort.dir ? P.accent : P.dim,
                  fontWeight: 600,
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  background: P.card,
                  borderBottom: `1px solid ${P.bdr}`,
                  whiteSpace: "nowrap",
                  cursor: sortable ? "pointer" : "default",
                  userSelect: "none",
                }}
              >
                {h}
                {sortIndicator(i)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedView.map(({ row, originalIndex }, ri) => (
            <tr
              key={originalIndex}
              onClick={() => onRowClick?.(originalIndex, row)}
              style={{
                background:
                  selectedRowIndex === originalIndex
                    ? `${P.accent}22`
                    : ri % 2 === 0
                      ? "transparent"
                      : P.card,
                cursor: onRowClick ? "pointer" : "default",
              }}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: "8px 10px",
                    textAlign: ci === 0 ? "left" : "right",
                    color: P.text,
                    fontWeight: ci === 0 ? 500 : 400,
                    whiteSpace: "nowrap",
                    borderBottom: `1px solid ${P.bdr}15`,
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: P.card,
        border: `1px solid ${P.bdr}`,
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 11,
        boxShadow: "0 8px 32px #0008",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4, color: P.text }}>
        {label}
      </div>
      {payload.map((p, i) => {
        const key = String(p.dataKey ?? "");
        const isRate = /^(tx|taxa|ratio|pct|percent)/i.test(key);
        return (
          <div key={i} style={{ color: p.color, marginTop: 2 }}>
            {p.name}:{" "}
            <b>
              {isRate && typeof p.value === "number"
                ? fmtPct(p.value)
                : p.value}
            </b>
          </div>
        );
      })}
    </div>
  );
};

function ChartCard({ title, children, h = 240, allowExpand = false }) {
  const [isFull, setIsFull] = useState(false);

  useEffect(() => {
    // prevent body scroll when fullscreen
    if (isFull) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isFull]);

  useEffect(() => {
    if (!isFull) return;
    const onKey = (e) => {
      if (e.key === "Escape") setIsFull(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFull]);

  const base = (
    <div
      style={{
        background: P.card,
        borderRadius: 14,
        border: `1px solid ${P.bdr}`,
        padding: "14px 14px 6px",
        flex: "1 1 340px",
        minWidth: 300,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 10,
          borderBottom: `1px solid ${P.bdr}`,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: P.dim,
            textTransform: "uppercase",
            letterSpacing: 1.4,
            fontFamily:
              "'JetBrains Mono','Fira Code',ui-monospace,monospace",
          }}
        >
          {title}
        </div>
        {allowExpand && (
          <button
            onClick={() => setIsFull(true)}
            title="Expandir"
            style={{
              border: "none",
              background: "transparent",
              color: P.dim,
              cursor: "pointer",
              fontSize: 14,
              padding: 0,
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = P.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = P.dim;
            }}
          >
            ⤢
          </button>
        )}
      </div>

      <div
        style={{ height: h, cursor: allowExpand ? "pointer" : "default" }}
        onClick={() => {
          // clicking the chart area expands when allowed
          if (allowExpand) setIsFull(true);
        }}
      >
        {!isFull && children}
      </div>
    </div>
  );

  if (!isFull) return base;

  // fullscreen overlay
  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => setIsFull(false)}
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.55)",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "calc(100% - 32px)",
          height: "calc(100% - 32px)",
          background: P.card,
          borderRadius: 12,
          border: `1px solid ${P.bdr}`,
          padding: 12,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: P.text,
              textTransform: "uppercase",
              letterSpacing: 1.4,
              fontFamily:
                "'JetBrains Mono','Fira Code',ui-monospace,monospace",
            }}
          >
            {title}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setIsFull(false)}
              title="Fechar"
              style={{
                border: "none",
                background: "transparent",
                color: P.dim,
                cursor: "pointer",
                fontSize: 16,
              }}
            >
              ✕
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
      </div>
    </div>
  );

  return (
    <>
      {base}
      {createPortal(overlay, document.body)}
    </>
  );
}

function TabBtn({ id, icon, label, activeTab, onSelect }) {
  const isActive = activeTab === id;
  return (
    <button
      onClick={() => onSelect(id)}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.color = P.text;
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.color = P.dim;
      }}
      style={{
        position: "relative",
        padding: "10px 14px 12px",
        border: "none",
        borderRadius: 0,
        cursor: "pointer",
        background: "transparent",
        color: isActive ? P.text : P.dim,
        fontWeight: isActive ? 700 : 500,
        fontSize: 12.5,
        transition: "color .2s ease",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {icon} {label}
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          bottom: 0,
          height: 2,
          background: P.accent,
          borderRadius: 2,
          transform: isActive ? "scaleX(1)" : "scaleX(0)",
          transformOrigin: "center",
          opacity: isActive ? 1 : 0,
          transition: "transform .25s ease, opacity .2s ease",
        }}
      />
    </button>
  );
}

function resolveHourFromConsEntry(entry) {
  const fromField = Number.parseInt(String(entry?.hora ?? ""), 10);
  if (Number.isInteger(fromField) && fromField >= 0 && fromField <= 23) {
    return fromField;
  }

  const label = String(entry?.data || "").trim();
  const match = label.match(/(?:\s|^)([01]?\d|2[0-3])(?::\d{2})?(?::\d{2})?$/);
  if (!match) return null;

  const parsed = Number.parseInt(match[1], 10);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 23
    ? parsed
    : null;
}

function resolveDayGroupFromConsEntry(entry) {
  const rawDate = entry?.dateReal;
  const parsedDate =
    rawDate instanceof Date ? rawDate : rawDate ? new Date(rawDate) : null;

  if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
    const yyyy = parsedDate.getFullYear();
    const mm = `${parsedDate.getMonth() + 1}`.padStart(2, "0");
    const dd = `${parsedDate.getDate()}`.padStart(2, "0");
    return {
      key: `${yyyy}-${mm}-${dd}`,
      label: `${dd}/${mm}`,
    };
  }

  const label = String(entry?.data || "").trim();
  const csvMatch = label.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (csvMatch) {
    const dd = csvMatch[1].padStart(2, "0");
    const mm = csvMatch[2].padStart(2, "0");
    const yyyy = csvMatch[3];
    return {
      key: `${yyyy}-${mm}-${dd}`,
      label: `${dd}/${mm}`,
    };
  }

  return {
    key: label || "(sem-data)",
    label: label || "-",
  };
}

function resolveDayGroupFromTicketEntry(entry) {
  return resolveDayGroupFromConsEntry({
    dateReal: entry?.dateReal || entry?.dataAbertura || null,
    data: entry?.dataAbertura || "",
  });
}

export default function App() {
  const [themeMode, setThemeMode] = useState(INITIAL_THEME_MODE);
  const [ticketListFilterSel, setTicketListFilterSel] = useState("abertos");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [pendingTicketListScroll, setPendingTicketListScroll] = useState(false);
  const ticketListSectionRef = useRef(null);
  const [authToken, setAuthToken] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("auth-token") || "";
  });
  const [authUser, setAuthUser] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem("auth-user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginStatus, setLoginStatus] = useState({
    state: "idle",
    message: "",
  });
  const [attendantScope, setAttendantScope] = useState("own");
  const [usersList, setUsersList] = useState([]);
  const [userMgmtStatus, setUserMgmtStatus] = useState({
    state: "idle",
    message: "",
  });
  const [attendantForm, setAttendantForm] = useState({
    id: "",
    name: "",
    atplusAlias: "",
    ticketsAlias: "",
  });
  const [attendantMgmtStatus, setAttendantMgmtStatus] = useState({
    state: "idle",
    message: "",
  });
  const [ticketGoalInput, setTicketGoalInput] = useState("20");
  const [ticketGoalStatus, setTicketGoalStatus] = useState({
    state: "idle",
    message: "",
  });
  const [alertSettingsInput, setAlertSettingsInput] = useState({
    tktAbertosLimit: "3",
    tmaLimitSec: "300",
  });
  const [alertSettingsStatus, setAlertSettingsStatus] = useState({
    state: "idle",
    message: "",
  });
  const [userForm, setUserForm] = useState({
    username: "",
    password: "",
    role: "atendente",
    attendantId: "",
  });
  const [userLinkOptions, setUserLinkOptions] = useState({
    attendants: [],
  });
  const [expandedTelefoniaDays, setExpandedTelefoniaDays] = useState({});
  const [telefoniaTrendAgentSel, setTelefoniaTrendAgentSel] =
    useState("__ALL__");
  const [attendantTeamTrendData, setAttendantTeamTrendData] = useState({
    cons: [],
    tickets: [],
  });
  const [attendantOwnTrendConsData, setAttendantOwnTrendConsData] = useState(
    [],
  );

  const isMaster = authUser?.role === "master";
  const isAttendant = authUser?.role === "atendente";
  const isAttendantTeamTicketsScope = isAttendant && attendantScope === "team";
  const attendantNotLinked =
    isAttendant &&
    !isAttendantTeamTicketsScope &&
    !authUser?.attendantResponsavel;

  const handleLogout = useCallback(async () => {
    if (authToken) {
      try {
        await fetch(apiUrl("/api/auth/logout"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
      } catch {
        // Logout local é suficiente se API não responder.
      }
    }

    setAuthToken("");
    setAuthUser(null);
    setUsersList([]);
    setAttendantScope("own");
    setAttendantForm({
      id: "",
      name: "",
      atplusAlias: "",
      ticketsAlias: "",
    });
    setAttendantMgmtStatus({ state: "idle", message: "" });
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("auth-token");
      window.localStorage.removeItem("auth-user");
    }
  }, [authToken]);

  useEffect(() => {
    window.localStorage.setItem("theme-mode", themeMode);
  }, [themeMode]);

  const {
    cons,
    tickets,
    loaded,
    tab,
    dateFrom,
    dateTo,
    dayTypeFilter,
    produtoFilter,
    produtoOptions,
    seriesVis,
    metricSel,
    saveStatus,
    isRestoring,
    incrementalStatus,
    reprocessStatus,
    ticketGoalPct,
    alertSettings,
    incrementalFileRef,
    reprocessFileRef,
    fCons,
    fAtend,
    fTickets,
    fOwnCons,
    fTeamCons,
    fOwnAtend,
    fOwnTickets,
    fTeamTickets,
    kpis,
    dateRangeInvalid,
    catData,
    sevData,
    natData,
    qualData,
    respData,
    clienteData,
    equipe,
    dailyChart,
    kpiSeries,
    setTab,
    setDateFrom,
    setDateTo,
    setDayTypeFilter,
    setProdutoFilter,
    setSeriesVis,
    setMetricSel,
    handleIncrementalFile,
    handleReprocessFile,
    retryLoadFromDatabase,
  } = useDashboardController({
    authToken,
    viewScope: isAttendant ? attendantScope : "team",
    canUpload: isMaster,
    onUnauthorized: handleLogout,
    attendantsCatalog: userLinkOptions.attendants,
  });

  const alertTktLimit = Number.isFinite(Number(alertSettings?.tktAbertosLimit))
    ? Number(alertSettings.tktAbertosLimit)
    : 3;
  const alertTmaLimit = Number.isFinite(Number(alertSettings?.tmaLimitSec))
    ? Number(alertSettings.tmaLimitSec)
    : 300;

  const totalDaysCount = useMemo(() => {
    const uniqueDays = new Set();
    cons.forEach((row) => {
      const group = resolveDayGroupFromConsEntry(row);
      if (group?.key) uniqueDays.add(group.key);
    });
    return uniqueDays.size;
  }, [cons]);

  const fetchUsers = useCallback(async () => {
    if (!authToken || !isMaster) return;

    try {
      const resp = await fetch(apiUrl("/api/users"), {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!resp.ok) {
        throw new Error("Não foi possível carregar usuários.");
      }

      const body = await resp.json();
      setUsersList(body?.users || []);
    } catch {
      setUserMgmtStatus({
        state: "error",
        message: "Falha ao carregar a lista de usuários.",
      });
    }
  }, [authToken, isMaster]);

  const fetchUserLinkOptions = useCallback(async () => {
    if (!authToken || !isMaster) return;

    try {
      const resp = await fetch(apiUrl("/api/users/link-options"), {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!resp.ok) {
        throw new Error("Não foi possível carregar opções de vínculo.");
      }

      const body = await resp.json();
      setUserLinkOptions({
        attendants: body?.options?.attendants || [],
      });
    } catch {
      setUserMgmtStatus((prev) => ({
        ...prev,
        state: prev.state === "idle" ? "error" : prev.state,
        message:
          prev.message ||
          "Falha ao carregar opções de atendente para cadastro.",
      }));
    }
  }, [authToken, isMaster]);

  const loadAttendantIntoForm = useCallback((attendant) => {
    if (!attendant) return;

    setAttendantForm({
      id: String(attendant.id || ""),
      name: attendant.name || "",
      atplusAlias: attendant.atplusAlias || "",
      ticketsAlias: attendant.ticketsAlias || "",
    });
    setAttendantMgmtStatus({ state: "idle", message: "" });
  }, []);

  const handleLogin = useCallback(
    async (e) => {
      e.preventDefault();

      setLoginStatus({ state: "saving", message: "Validando acesso..." });

      try {
        const resp = await fetch(apiUrl("/api/auth/login"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(loginForm),
        });

        const body = await resp.json();
        if (!resp.ok || !body?.token || !body?.user) {
          throw new Error(body?.error || "Credenciais inválidas.");
        }

        setAuthToken(body.token);
        setAuthUser(body.user);
        setAttendantScope("own");
        setLoginStatus({ state: "success", message: "Login realizado." });
        if (typeof window !== "undefined") {
          window.localStorage.setItem("auth-token", body.token);
          window.localStorage.setItem("auth-user", JSON.stringify(body.user));
        }
      } catch (error) {
        setLoginStatus({
          state: "error",
          message:
            error instanceof Error ? error.message : "Falha ao autenticar.",
        });
      }
    },
    [loginForm],
  );

  const handleCreateUser = useCallback(
    async (e) => {
      e.preventDefault();
      setUserMgmtStatus({
        state: "saving",
        message: "Criando usuário...",
      });

      try {
        const payload = {
          ...userForm,
          username: userForm.username.trim(),
        };

        const resp = await fetch(apiUrl("/api/users"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(payload),
        });

        const body = await resp.json();
        if (!resp.ok) {
          throw new Error(body?.error || "Falha ao criar usuário.");
        }

        setUserForm({
          username: "",
          password: "",
          role: "atendente",
          attendantId: "",
        });
        setUserMgmtStatus({
          state: "success",
          message: `Usuário ${body?.user?.username || ""} criado com sucesso.`,
        });
        await fetchUsers();
      } catch (error) {
        setUserMgmtStatus({
          state: "error",
          message:
            error instanceof Error ? error.message : "Falha ao criar usuário.",
        });
      }
    },
    [authToken, fetchUsers, userForm],
  );

  const handleSaveAttendant = useCallback(
    async (e) => {
      e.preventDefault();

      setAttendantMgmtStatus({
        state: "saving",
        message: attendantForm.id
          ? "Atualizando atendente..."
          : "Salvando atendente...",
      });

      try {
        const payload = {
          id: attendantForm.id,
          name: attendantForm.name.trim(),
          atplusAlias: attendantForm.atplusAlias.trim(),
          ticketsAlias: attendantForm.ticketsAlias.trim(),
        };

        const resp = await fetch(apiUrl("/api/attendants"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(payload),
        });

        const body = await resp.json();
        if (!resp.ok) {
          throw new Error(body?.error || "Falha ao salvar atendente.");
        }

        setAttendantForm({
          id: "",
          name: "",
          atplusAlias: "",
          ticketsAlias: "",
        });
        setAttendantMgmtStatus({
          state: "success",
          message: `Atendente ${body?.attendant?.name || ""} salvo com sucesso.`,
        });
        await fetchUserLinkOptions();
      } catch (error) {
        setAttendantMgmtStatus({
          state: "error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao salvar atendente.",
        });
      }
    },
    [attendantForm, authToken, fetchUserLinkOptions],
  );

  const handleClearAttendants = useCallback(async () => {
    const confirmed =
      typeof window === "undefined"
        ? true
        : window.confirm(
            "Tem certeza que deseja limpar toda a tabela de atendentes? Os vínculos dos usuários serão removidos.",
          );

    if (!confirmed) return;

    setAttendantMgmtStatus({
      state: "saving",
      message: "Limpando tabela de atendentes...",
    });

    try {
      const resp = await fetch(apiUrl("/api/attendants"), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const body = await resp.json();
      if (!resp.ok) {
        throw new Error(body?.error || "Falha ao limpar atendentes.");
      }

      setAttendantForm({
        id: "",
        name: "",
        atplusAlias: "",
        ticketsAlias: "",
      });
      setAttendantMgmtStatus({
        state: "success",
        message: "Tabela de atendentes limpa com sucesso.",
      });
      await fetchUserLinkOptions();
      await fetchUsers();
    } catch (error) {
      setAttendantMgmtStatus({
        state: "error",
        message:
          error instanceof Error
            ? error.message
            : "Falha ao limpar atendentes.",
      });
    }
  }, [authToken, fetchUserLinkOptions, fetchUsers]);

  const handleSaveTicketGoal = useCallback(
    async (e) => {
      e.preventDefault();

      const parsed = Number.parseFloat(
        String(ticketGoalInput || "").replace(",", "."),
      );

      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        setTicketGoalStatus({
          state: "error",
          message: "Informe uma meta válida entre 0 e 100%.",
        });
        return;
      }

      setTicketGoalStatus({
        state: "saving",
        message: "Salvando meta...",
      });

      try {
        const resp = await fetch(apiUrl("/api/settings/ticket-goal"), {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ ticketGoalPct: parsed }),
        });

        const body = await resp.json();
        if (!resp.ok || !body?.ok) {
          throw new Error(body?.error || "Não foi possível salvar a meta.");
        }

        const nextGoal = Number(body?.settings?.ticketGoalPct);
        if (Number.isFinite(nextGoal)) {
          setTicketGoalInput(String(nextGoal));
        }

        setTicketGoalStatus({
          state: "success",
          message: "Meta atualizada com sucesso.",
        });
        await retryLoadFromDatabase();
      } catch (error) {
        setTicketGoalStatus({
          state: "error",
          message:
            error instanceof Error ? error.message : "Falha ao salvar a meta.",
        });
      }
    },
    [authToken, retryLoadFromDatabase, ticketGoalInput],
  );

  useEffect(() => {
    if (Number.isFinite(Number(ticketGoalPct))) {
      setTicketGoalInput(String(ticketGoalPct));
    }
  }, [ticketGoalPct]);

  useEffect(() => {
    if (!alertSettings) return;
    setAlertSettingsInput({
      tktAbertosLimit: String(alertSettings.tktAbertosLimit ?? 3),
      tmaLimitSec: String(alertSettings.tmaLimitSec ?? 300),
    });
  }, [alertSettings]);

  const handleSaveAlertSettings = useCallback(
    async (e) => {
      e.preventDefault();

      const parsedTkt = Number.parseInt(
        String(alertSettingsInput.tktAbertosLimit || "").replace(/[^\d-]/g, ""),
        10,
      );
      const parsedTma = Number.parseInt(
        String(alertSettingsInput.tmaLimitSec || "").replace(/[^\d-]/g, ""),
        10,
      );

      if (!Number.isFinite(parsedTkt) || parsedTkt < 0 || parsedTkt > 9999) {
        setAlertSettingsStatus({
          state: "error",
          message: "Informe um limite válido de tickets em aberto (0 a 9999).",
        });
        return;
      }

      if (!Number.isFinite(parsedTma) || parsedTma < 0 || parsedTma > 86400) {
        setAlertSettingsStatus({
          state: "error",
          message: "Informe um limite válido de TMA em segundos (0 a 86400).",
        });
        return;
      }

      setAlertSettingsStatus({
        state: "saving",
        message: "Salvando parâmetros...",
      });

      try {
        const resp = await fetch(apiUrl("/api/settings/alerts"), {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            tktAbertosLimit: parsedTkt,
            tmaLimitSec: parsedTma,
          }),
        });

        const body = await resp.json();
        if (!resp.ok || !body?.ok) {
          throw new Error(
            body?.error || "Não foi possível salvar os parâmetros.",
          );
        }

        setAlertSettingsStatus({
          state: "success",
          message: "Parâmetros atualizados com sucesso.",
        });
        await retryLoadFromDatabase();
      } catch (error) {
        setAlertSettingsStatus({
          state: "error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao salvar os parâmetros.",
        });
      }
    },
    [authToken, retryLoadFromDatabase, alertSettingsInput],
  );

  useEffect(() => {
    if (isMaster) {
      fetchUsers();
      fetchUserLinkOptions();
    } else {
      setUsersList([]);
      setUserLinkOptions({ attendants: [] });
      setAttendantForm({
        id: "",
        name: "",
        atplusAlias: "",
        ticketsAlias: "",
      });
      setAttendantMgmtStatus({ state: "idle", message: "" });
    }
  }, [fetchUserLinkOptions, fetchUsers, isMaster]);

  useEffect(() => {
    if (!isAttendant || !authToken) {
      setAttendantTeamTrendData({ cons: [], tickets: [] });
      return;
    }

    let cancelled = false;

    async function loadAttendantTeamTrendData() {
      try {
        const resp = await fetch(apiUrl("/api/dashboard-data?scope=team"), {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (!resp.ok) return;

        const body = await resp.json();
        const data = body?.data;
        if (!data || cancelled) return;

        const cons = (data.cons || []).map((row) => ({
          ...row,
          dateReal: parseApiDate(row.dateReal),
        }));
        const tickets = (data.tickets || []).map((row) => ({
          ...row,
          dateReal: parseApiDate(row.dataAbertura),
        }));

        if (!cancelled) {
          setAttendantTeamTrendData({ cons, tickets });
        }
      } catch {
        // Se a API falhar, mantemos o estado atual para evitar quebra da UI.
      }
    }

    loadAttendantTeamTrendData();

    return () => {
      cancelled = true;
    };
  }, [authToken, isAttendant]);

  useEffect(() => {
    if (!isAttendant || !authToken) {
      setAttendantOwnTrendConsData([]);
      return;
    }

    let cancelled = false;

    async function loadAttendantOwnTrendConsData() {
      try {
        const resp = await fetch(apiUrl("/api/dashboard-data?scope=own"), {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (!resp.ok) return;

        const body = await resp.json();
        const data = body?.data;
        if (!data || cancelled) return;

        const cons = (data.cons || []).map((row) => ({
          ...row,
          dateReal: parseApiDate(row.dateReal),
        }));

        if (!cancelled) {
          setAttendantOwnTrendConsData(cons);
        }
      } catch {
        // Se a API falhar, mantemos o estado atual para evitar quebra da UI.
      }
    }

    loadAttendantOwnTrendConsData();

    return () => {
      cancelled = true;
    };
  }, [authToken, isAttendant]);

  useEffect(() => {
    if (isMaster && (tab === "equipe" || tab === "atualizacao")) {
      return;
    }
    if (!isMaster && (tab === "equipe" || tab === "atualizacao")) {
      setTab("resumo");
    }
  }, [isMaster, setTab, tab]);


  const telefoniaDailyGroups = useMemo(() => {
    const groups = new Map();

    fCons.forEach((row) => {
      const { key, label } = resolveDayGroupFromConsEntry(row);
      const hour = resolveHourFromConsEntry(row);
      const rowTotal = Number(row.total) || 0;
      const rowAtendidas = Number(row.atendidas) || 0;
      const rowNaoAtendidas = Number(row.naoAtendidas) || 0;
      const rowAbandonadas = Number(row.abandonadas) || 0;
      const rowTma = Number(row.tma) || 0;
      const rowTme = Number(row.tme) || 0;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label,
          total: 0,
          atendidas: 0,
          naoAtendidas: 0,
          abandonadas: 0,
          tmaSum: 0,
          tmeSum: 0,
          rowsCount: 0,
          rows: [],
        });
      }

      const group = groups.get(key);
      group.total += rowTotal;
      group.atendidas += rowAtendidas;
      group.naoAtendidas += rowNaoAtendidas;
      group.abandonadas += rowAbandonadas;
      group.tmaSum += rowTma;
      group.tmeSum += rowTme;
      group.rowsCount += 1;
      group.rows.push({
        hour,
        hourLabel:
          hour === null
            ? String(row.data || "-")
            : `${String(hour).padStart(2, "0")}:00`,
        total: rowTotal,
        atendidas: rowAtendidas,
        naoAtendidas: rowNaoAtendidas,
        abandonadas: rowAbandonadas,
        txAbandono: Number(row.txAbandono) || 0,
        tma: rowTma,
        tme: rowTme,
      });
    });

    return Array.from(groups.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((group) => {
        const hasHourlyRows = group.rows.some((row) => row.hour !== null);
        const baseRows = hasHourlyRows
          ? group.rows.filter((row) => row.hour !== null)
          : group.rows;

        const rows = [...baseRows].sort((a, b) => {
          const ah = a.hour === null ? 99 : a.hour;
          const bh = b.hour === null ? 99 : b.hour;
          if (ah !== bh) return ah - bh;
          return String(a.hourLabel).localeCompare(
            String(b.hourLabel),
            "pt-BR",
          );
        });

        const totals = baseRows.reduce(
          (acc, row) => {
            acc.total += row.total;
            acc.atendidas += row.atendidas;
            acc.naoAtendidas += row.naoAtendidas;
            acc.abandonadas += row.abandonadas;
            acc.tmaSum += row.tma;
            acc.tmeSum += row.tme;
            acc.rowsCount += 1;
            return acc;
          },
          {
            total: 0,
            atendidas: 0,
            naoAtendidas: 0,
            abandonadas: 0,
            tmaSum: 0,
            tmeSum: 0,
            rowsCount: 0,
          },
        );

        const txAbandono = totals.total
          ? (totals.naoAtendidas + totals.abandonadas) / totals.total
          : 0;
        const txAtend = totals.total ? totals.atendidas / totals.total : 0;
        const hasExpandableDetails = rows.length > 1;

        return {
          key: group.key,
          label: group.label,
          total: totals.total,
          atendidas: totals.atendidas,
          naoAtendidas: totals.naoAtendidas,
          abandonadas: totals.abandonadas,
          txAbandono,
          tma: totals.rowsCount
            ? Math.round(totals.tmaSum / totals.rowsCount)
            : 0,
          tme: totals.rowsCount
            ? Math.round(totals.tmeSum / totals.rowsCount)
            : 0,
          txAtend,
          hasHourlyDetails: hasExpandableDetails,
          rows,
        };
      });
  }, [fCons]);

  const telefoniaTrendAgentOptions = useMemo(() => {
    if (isAttendant) {
      const selfLabel =
        String(authUser?.attendantRamal || "")
          .trim()
          .replace(" - Central", "") ||
        String(authUser?.attendantResponsavel || "").trim() ||
        "Meus dados";

      return [
        {
          value: "__SELF__",
          label: selfLabel,
        },
      ];
    }

    const availableCallsRamais = new Set(
      fAtend.map((row) => String(row.ramal || "").trim()).filter(Boolean),
    );
    const availableTicketResponsaveis = new Set(
      fTickets
        .map((ticket) =>
          String(ticket.responsavel || "")
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    );

    return Object.entries(AGENT_MAP)
      .filter(([ramal, responsavel]) => {
        const hasCalls = availableCallsRamais.has(ramal);
        const hasTickets = availableTicketResponsaveis.has(
          String(responsavel).trim().toLowerCase(),
        );
        return hasCalls || hasTickets;
      })
      .map(([ramal]) => ({
        value: ramal,
        label: ramal.replace(" - Central", ""),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [
    authUser?.attendantRamal,
    authUser?.attendantResponsavel,
    fAtend,
    fTickets,
    isAttendant,
  ]);

  const attendantTeamTrendCons = useMemo(
    () =>
      filterByDateRange(
        attendantTeamTrendData.cons,
        dateFrom,
        dateTo,
        dayTypeFilter,
      ),
    [attendantTeamTrendData.cons, dateFrom, dateTo, dayTypeFilter],
  );

  const attendantTeamTrendTickets = useMemo(
    () =>
      filterByDateRange(
        attendantTeamTrendData.tickets,
        dateFrom,
        dateTo,
        dayTypeFilter,
      ),
    [attendantTeamTrendData.tickets, dateFrom, dateTo, dayTypeFilter],
  );

  const attendantOwnTrendCons = useMemo(
    () =>
      filterByDateRange(
        attendantOwnTrendConsData,
        dateFrom,
        dateTo,
        dayTypeFilter,
      ),
    [attendantOwnTrendConsData, dateFrom, dateTo, dayTypeFilter],
  );

  const telefoniaDailyCallsVsTicketsChart = useMemo(() => {
    const merged = new Map();

    const selectedIsSelf = isAttendant && telefoniaTrendAgentSel === "__SELF__";
    const selectedIsTeamForAttendant =
      isAttendant && telefoniaTrendAgentSel === "__ALL__";
    const selectedRamal =
      telefoniaTrendAgentSel === "__ALL__" || selectedIsSelf
        ? null
        : telefoniaTrendAgentSel;
    const selectedResponsavel = selectedIsSelf
      ? String(authUser?.attendantResponsavel || "").trim() ||
        (String(authUser?.attendantRamal || "").trim()
          ? AGENT_MAP[String(authUser?.attendantRamal || "").trim()]
          : null)
      : selectedRamal
        ? AGENT_MAP[selectedRamal]
        : null;
    const selectedResponsavelNorm = String(selectedResponsavel || "")
      .trim()
      .toLowerCase();
    const sourceTickets = selectedIsTeamForAttendant
      ? attendantTeamTrendTickets
      : fTickets;

    const buildDailyAtendidasGroups = (consRows) => {
      const byDay = new Map();
      const baseConsRows = pickConsRowsForKpisByDay(consRows);

      baseConsRows.forEach((row) => {
        const { key, label } = resolveDayGroupFromConsEntry(row);
        if (!byDay.has(key)) {
          byDay.set(key, {
            key,
            label,
            atendidas: 0,
          });
        }

        const current = byDay.get(key);
        current.atendidas += Number(row.atendidas) || 0;
      });

      return Array.from(byDay.values()).sort((a, b) =>
        String(a.key).localeCompare(String(b.key), "pt-BR"),
      );
    };

    const sourceDailyGroups = selectedIsTeamForAttendant
      ? buildDailyAtendidasGroups(attendantTeamTrendCons)
      : selectedIsSelf
        ? buildDailyAtendidasGroups(attendantOwnTrendCons)
        : telefoniaDailyGroups;

    const ensureDay = (key, label) => {
      if (!merged.has(key)) {
        merged.set(key, {
          key,
          dia: label,
          Atendidas: 0,
          Tickets: 0,
        });
      }

      return merged.get(key);
    };

    if (!selectedRamal) {
      sourceDailyGroups.forEach((day) => {
        merged.set(day.key, {
          key: day.key,
          dia: day.label,
          Atendidas: day.atendidas,
          Tickets: 0,
        });
      });
    } else {
      fAtend.forEach((row) => {
        if (String(row.ramal || "") !== selectedRamal) return;

        const group = resolveDayGroupFromConsEntry(row);
        if (!group?.key) return;

        const current = ensureDay(group.key, group.label);
        current.Atendidas += Number(row.atendidas) || 0;
      });
    }

    sourceTickets.forEach((ticket) => {
      if (selectedResponsavelNorm) {
        const ticketResponsavelNorm = String(ticket.responsavel || "")
          .trim()
          .toLowerCase();

        if (ticketResponsavelNorm !== selectedResponsavelNorm) return;
      }

      const group = resolveDayGroupFromTicketEntry(ticket);
      if (!group?.key) return;

      const current = ensureDay(group.key, group.label);
      current.Tickets += 1;
      merged.set(group.key, current);
    });

    return Array.from(merged.values())
      .sort((a, b) => String(a.key).localeCompare(String(b.key), "pt-BR"))
      .map(({ key, ...row }) => row);
  }, [
    authUser?.attendantRamal,
    authUser?.attendantResponsavel,
    attendantOwnTrendCons,
    attendantTeamTrendCons,
    attendantTeamTrendTickets,
    fAtend,
    fTickets,
    isAttendant,
    telefoniaDailyGroups,
    telefoniaTrendAgentSel,
  ]);

  useEffect(() => {
    if (telefoniaTrendAgentSel === "__ALL__") return;

    const stillAvailable = telefoniaTrendAgentOptions.some(
      (opt) => opt.value === telefoniaTrendAgentSel,
    );

    if (!stillAvailable) {
      setTelefoniaTrendAgentSel("__ALL__");
    }
  }, [telefoniaTrendAgentOptions, telefoniaTrendAgentSel]);

  const toggleTelefoniaDay = useCallback((dayKey) => {
    setExpandedTelefoniaDays((prev) => ({
      ...prev,
      [dayKey]: !prev[dayKey],
    }));
  }, []);

  function handleTicketDrilldown(filterKey) {
    setTicketListFilterSel(filterKey || "todos");
    setSelectedTicket(null);
    setPendingTicketListScroll(true);
    setTab("tickets");
  }

  function fmtDateTime(value) {
    if (!value) return "-";
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("pt-BR");
  }

  useEffect(() => {
    if (tab !== "tickets" || !pendingTicketListScroll) return;
    requestAnimationFrame(() => {
      ticketListSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setPendingTicketListScroll(false);
    });
  }, [tab, pendingTicketListScroll]);

  useEffect(() => {
    if (isAttendantTeamTicketsScope) {
      setSelectedTicket(null);
    }
  }, [isAttendantTeamTicketsScope]);

  useEffect(() => {
    if (!isAttendant || !authToken) return;
    retryLoadFromDatabase();
  }, [attendantScope, authToken, isAttendant, retryLoadFromDatabase]);

  if (!authToken || !authUser) {
    return (
      <div
        style={{
          background: P.bg,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          fontFamily: "'DM Sans',-apple-system,sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            width: "min(880px, 100%)",
            background: P.card,
            border: `1px solid ${P.bdr}`,
            borderRadius: 18,
            overflow: "hidden",
            boxShadow:
              themeMode === "dark"
                ? "0 24px 64px rgba(0,0,0,0.45)"
                : "0 12px 40px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              flex: "1 1 340px",
              minWidth: 280,
              padding: "36px 32px",
              background:
                themeMode === "dark"
                  ? `linear-gradient(160deg, ${P.cardH} 0%, ${P.card} 100%)`
                  : `linear-gradient(160deg, ${P.accent}0E 0%, ${P.card} 100%)`,
              borderRight: `1px solid ${P.bdr}`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: 24,
              minHeight: 360,
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 28,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: 14,
                    height: 14,
                    background: P.accent,
                    borderRadius: 3,
                  }}
                />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: P.accent,
                    letterSpacing: -0.3,
                  }}
                >
                  Suporte NDD
                </span>
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 30,
                  fontWeight: 800,
                  color: P.text,
                  letterSpacing: -0.8,
                  lineHeight: 1.15,
                }}
              >
                Central de
                <br />
                Relacionamentos
              </h1>
              <p
                style={{
                  marginTop: 14,
                  marginBottom: 0,
                  fontSize: 13,
                  color: P.dim,
                  lineHeight: 1.6,
                  maxWidth: 320,
                }}
              >
                Telefonia, tickets e produtividade da equipe em um único
                painel — atualizado a partir do consolidado diário.
              </p>
            </div>
            <div
              style={{
                fontFamily:
                  "'JetBrains Mono','Fira Code',ui-monospace,monospace",
                fontSize: 10,
                color: P.dim,
                letterSpacing: 0.8,
                textTransform: "uppercase",
              }}
            >
              v3.3.0 · Acesso por perfil
            </div>
          </div>

          <form
            onSubmit={handleLogin}
            style={{
              flex: "1 1 340px",
              minWidth: 280,
              padding: "36px 32px",
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
            <div
              style={{
                fontFamily:
                  "'JetBrains Mono','Fira Code',ui-monospace,monospace",
                fontSize: 10,
                color: P.dim,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Login
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 800,
                color: P.text,
                letterSpacing: -0.5,
                marginBottom: 24,
              }}
            >
              Entrar na sua conta
            </h2>

            <label
              style={{
                display: "block",
                fontSize: 11,
                color: P.dim,
                marginBottom: 6,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              Usuário
            </label>
            <input
              value={loginForm.username}
              onChange={(e) =>
                setLoginForm((v) => ({ ...v, username: e.target.value }))
              }
              style={{
                width: "100%",
                background: P.cardH,
                border: `1px solid ${P.bdr}`,
                borderRadius: 8,
                color: P.text,
                fontSize: 13,
                padding: "10px 12px",
                marginBottom: 14,
                outline: "none",
                transition: "border-color .15s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = P.accent;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = P.bdr;
              }}
              required
            />

            <label
              style={{
                display: "block",
                fontSize: 11,
                color: P.dim,
                marginBottom: 6,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              Senha
            </label>
            <input
              type="password"
              value={loginForm.password}
              onChange={(e) =>
                setLoginForm((v) => ({ ...v, password: e.target.value }))
              }
              style={{
                width: "100%",
                background: P.cardH,
                border: `1px solid ${P.bdr}`,
                borderRadius: 8,
                color: P.text,
                fontSize: 13,
                padding: "10px 12px",
                outline: "none",
                transition: "border-color .15s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = P.accent;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = P.bdr;
              }}
              required
            />

            <button
              type="submit"
              style={{
                width: "100%",
                marginTop: 18,
                background: P.accent,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "12px 14px",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 0.3,
                cursor: "pointer",
                transition: "filter .15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.filter = "brightness(1.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = "none";
              }}
            >
              Entrar
            </button>

            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                minHeight: 18,
                color:
                  loginStatus.state === "error"
                    ? P.red
                    : loginStatus.state === "success"
                      ? P.green
                      : P.dim,
              }}
            >
              {loginStatus.message || ""}
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (!loaded && isRestoring) {
    return (
      <div
        style={{
          background: P.bg,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'DM Sans',-apple-system,sans-serif",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 480 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>📊</div>
          <h1
            style={{
              color: P.text,
              fontSize: 24,
              fontWeight: 800,
              margin: "0 0 8px",
              letterSpacing: -0.5,
            }}
          >
            Suporte NDD
          </h1>
          <p style={{ color: P.dim, fontSize: 14, margin: "0 0 28px" }}>
            Tentando carregar os dados salvos no SQLite...
          </p>
          {saveStatus.state !== "idle" && (
            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                color:
                  saveStatus.state === "success"
                    ? P.green
                    : saveStatus.state === "error"
                      ? P.red
                      : P.dim,
              }}
            >
              {saveStatus.message}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: P.bg,
        minHeight: "100vh",
        color: P.text,
        fontFamily: "'DM Sans',-apple-system,sans-serif",
      }}
    >
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "18px 16px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "baseline",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <h1
              style={{
                fontSize: 20,
                fontWeight: 800,
                margin: 0,
                letterSpacing: -0.5,
                color: P.accent,
                display: "flex",
                alignItems: "baseline",
                gap: 8,
              }}
            >
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  background: P.accent,
                  borderRadius: 2,
                  transform: "translateY(-2px)",
                }}
              />
              Suporte NDD
            </h1>
            <p
              style={{
                fontSize: 10.5,
                color: P.dim,
                margin: 0,
                fontFamily:
                  "'JetBrains Mono','Fira Code',ui-monospace,monospace",
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              {kpis.dias} / {totalDaysCount} dias ·{" "}
              {isAttendant && attendantScope === "team"
                ? kpis.tkt
                : tickets.length}{" "}
              tkts
            </p>
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              background: P.card,
              borderRadius: 10,
              padding: "6px 12px",
              border: `1px solid ${P.bdr}`,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: P.dim,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              {authUser?.username} · {isMaster ? "Master" : "Atendente"}
            </span>
            {isAttendant && (
              <div
                style={{
                  display: "flex",
                  background: P.cardH,
                  borderRadius: 7,
                  border: `1px solid ${P.bdr}`,
                  overflow: "hidden",
                }}
              >
                <button
                  onClick={() => setAttendantScope("own")}
                  style={{
                    border: "none",
                    background:
                      attendantScope === "own" ? P.accent : "transparent",
                    color: attendantScope === "own" ? "#fff" : P.dim,
                    padding: "4px 8px",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  Meus
                </button>
                <button
                  onClick={() => setAttendantScope("team")}
                  style={{
                    border: "none",
                    background:
                      attendantScope === "team" ? P.accent : "transparent",
                    color: attendantScope === "team" ? "#fff" : P.dim,
                    padding: "4px 8px",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  Totais da Equipe
                </button>
              </div>
            )}
            <span style={{ fontSize: 11, color: P.dim, fontWeight: 600 }}>
              📅 De
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{
                background: P.cardH,
                border: `1px solid ${P.bdr}`,
                borderRadius: 6,
                padding: "4px 8px",
                color: P.text,
                fontSize: 12,
              }}
            />
            <span style={{ fontSize: 11, color: P.dim, fontWeight: 600 }}>
              Até
            </span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{
                background: P.cardH,
                border: `1px solid ${P.bdr}`,
                borderRadius: 6,
                padding: "4px 8px",
                color: P.text,
                fontSize: 12,
              }}
            />
            <select
              value={dayTypeFilter}
              onChange={(e) => setDayTypeFilter(e.target.value)}
              style={{
                background: P.cardH,
                border: `1px solid ${P.bdr}`,
                borderRadius: 6,
                padding: "4px 8px",
                color: P.text,
                fontSize: 12,
              }}
            >
              <option value="all">Todos</option>
              <option value="weekdays">Dias úteis</option>
              <option value="holidays">Feriados</option>
              <option value="weekends">Finais de semana</option>
            </select>
            <select
              value={produtoFilter}
              onChange={(e) => setProdutoFilter(e.target.value)}
              title="Filtrar tickets por produto"
              style={{
                background: P.cardH,
                border: `1px solid ${P.bdr}`,
                borderRadius: 6,
                padding: "4px 8px",
                color: P.text,
                fontSize: 12,
              }}
            >
              <option value="">Todos os produtos</option>
              {produtoOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {dateRangeInvalid && (
              <span
                style={{
                  fontSize: 11,
                  color: P.red,
                  fontWeight: 600,
                  alignSelf: "center",
                }}
              >
                ⚠️ Período inválido
              </span>
            )}
            {(dateFrom ||
              dateTo ||
              dayTypeFilter !== "all" ||
              produtoFilter) && (
              <button
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setDayTypeFilter("all");
                  setProdutoFilter("");
                }}
                style={{
                  background: P.red,
                  border: "none",
                  borderRadius: 6,
                  padding: "4px 8px",
                  color: "#fff",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                Limpar
              </button>
            )}
            <button
              onClick={handleLogout}
              style={{
                background: P.cardH,
                border: `1px solid ${P.bdr}`,
                borderRadius: 6,
                padding: "4px 8px",
                color: P.text,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Sair
            </button>
          </div>
        </div>

        {!loaded && !isRestoring && (
          <div
            style={{
              background: P.card,
              border: `1px solid ${P.bdr}`,
              borderRadius: 10,
              padding: "10px 12px",
              marginBottom: 12,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 12, color: P.text, flex: "1 1 320px" }}>
              {saveStatus.state === "error" && saveStatus.message
                ? saveStatus.message
                : "Nao foi possivel carregar os dados automaticamente."}
            </div>
            <button
              onClick={retryLoadFromDatabase}
              style={{
                background: P.cardH,
                border: `1px solid ${P.bdr}`,
                borderRadius: 8,
                color: P.text,
                padding: "6px 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 0,
            background: "transparent",
            borderRadius: 0,
            padding: 0,
            marginBottom: 18,
            borderBottom: `1px solid ${P.bdr}`,
            flexWrap: "wrap",
          }}
        >
          <TabBtn
            id="resumo"
            icon={<Ico Icon={BarChart3} />}
            label="Resumo"
            activeTab={tab}
            onSelect={setTab}
          />
          <TabBtn
            id="telefonia"
            icon={<Ico Icon={Phone} />}
            label="Telefonia"
            activeTab={tab}
            onSelect={setTab}
          />
          <TabBtn
            id="atividade-hora"
            icon={<Ico Icon={Clock} />}
            label="Atividade/Hora"
            activeTab={tab}
            onSelect={setTab}
          />
          <TabBtn
            id="tickets"
            icon={<Ico Icon={Ticket} />}
            label="Tickets"
            activeTab={tab}
            onSelect={setTab}
          />
          {isMaster && (
            <TabBtn
              id="equipe"
              icon={<Ico Icon={Users} />}
              label="Equipe"
              activeTab={tab}
              onSelect={setTab}
            />
          )}
          {isMaster && (
            <TabBtn
              id="atualizacao"
              icon={<Ico Icon={Plus} />}
              label="Atualização"
              activeTab={tab}
              onSelect={setTab}
            />
          )}
          <div
            style={{
              display: "flex",
              background: P.cardH,
              borderRadius: 7,
              border: `1px solid ${P.bdr}`,
              overflow: "hidden",
              marginLeft: "auto",
              alignSelf: "center",
            }}
          >
            <button
              onClick={() => {
                P = DARK_THEME;
                PIE_C = PIE_C_DARK;
                setThemeMode("dark");
              }}
              style={{
                border: "none",
                background: themeMode === "dark" ? P.accent : "transparent",
                color: themeMode === "dark" ? "#fff" : P.dim,
                padding: "4px 8px",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Dark
            </button>
            <button
              onClick={() => {
                P = LIGHT_THEME;
                PIE_C = PIE_C_LIGHT;
                setThemeMode("light");
              }}
              style={{
                border: "none",
                background: themeMode === "light" ? P.accent : "transparent",
                color: themeMode === "light" ? "#fff" : P.dim,
                padding: "4px 8px",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Light
            </button>
          </div>
        </div>

        {tab === "resumo" && (
          <Suspense
            fallback={
              <div
                style={{
                  background: P.card,
                  border: `1px solid ${P.bdr}`,
                  borderRadius: 12,
                  padding: 14,
                  color: P.dim,
                  fontSize: 12,
                }}
              >
                Carregando resumo...
              </div>
            }
          >
            <ResumoTab
              P={P}
              PIE_C={PIE_C}
              KPI={KPI}
              Section={Section}
              ChartCard={ChartCard}
              TT={TT}
              fmtSec={fmtSec}
              fmtPct={fmtPct}
              kpis={kpis}
              kpiSeries={kpiSeries}
              metricSel={metricSel}
              setMetricSel={setMetricSel}
              dailyChart={dailyChart}
              fCons={fCons}
              fAtend={fAtend}
              fTickets={fTickets}
              catData={catData}
              sevData={sevData}
              equipe={equipe}
              onTicketDrilldown={handleTicketDrilldown}
              isAttendantOwnScope={isAttendant && attendantScope === "own"}
              isAttendant={isAttendant}
              attendantDisplayName={
                isAttendant
                  ? String(authUser?.attendantRamal || "")
                      .trim()
                      .replace(" - Central", "") ||
                    String(authUser?.attendantResponsavel || "").trim() ||
                    authUser?.username ||
                    "Eu"
                  : ""
              }
              fOwnCons={fOwnCons}
              fTeamCons={fTeamCons}
              fOwnAtend={fOwnAtend}
              fOwnTickets={fOwnTickets}
              fTeamTickets={fTeamTickets}
              attendantsCatalog={userLinkOptions.attendants}
              isMasterView={isMaster}
              ticketGoalPct={ticketGoalPct}
              alertSettings={alertSettings}
            />
          </Suspense>
        )}

        {tab === "telefonia" && (
          <>
            <Section
              title={
                isAttendant
                  ? "Desempenho de Atendimentos"
                  : "Ranking de Atendentes"
              }
              icon={<Ico Icon={Trophy} />}
            >
              <Table
                headers={[
                  "Atendente",
                  "Tentativas",
                  "Atendidas",
                  "Tx Atend.",
                  "TMA(s)",
                  "TME(s)",
                ]}
                rows={(() => {
                  const m = {};
                  fAtend.forEach((a) => {
                    if (!m[a.ramal])
                      m[a.ramal] = { t: 0, a: 0, ts: 0, es: 0, n: 0 };
                    m[a.ramal].t += a.tentativas;
                    m[a.ramal].a += a.atendidas;
                    m[a.ramal].ts += a.tma;
                    m[a.ramal].es += a.tme;
                    m[a.ramal].n++;
                  });
                  return Object.entries(m)
                    .sort((a, b) => b[1].a - a[1].a)
                    .map(([n, v]) => [
                      n.replace(" - Central", ""),
                      v.t,
                      v.a,
                      v.t ? fmtPct(v.a / v.t) : "-",
                      v.n ? fmtSec(Math.round(v.ts / v.n)) : "-",
                      v.n ? fmtSec(Math.round(v.es / v.n)) : "-",
                    ]);
                })()}
              />
            </Section>
            <div
              style={{
                display: "flex",
                gap: 14,
                flexWrap: "wrap",
                marginTop: 14,
              }}
            >
              <ChartCard
                title="Ligações Atendidas x Total de Tickets por Dia"
                h={200}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <select
                    value={telefoniaTrendAgentSel}
                    onChange={(e) => setTelefoniaTrendAgentSel(e.target.value)}
                    style={{
                      background: P.cardH,
                      border: `1px solid ${P.bdr}`,
                      borderRadius: 8,
                      color: P.text,
                      padding: "6px 8px",
                      fontSize: 11,
                      minWidth: 180,
                    }}
                  >
                    <option value="__ALL__">Equipe toda</option>
                    {telefoniaTrendAgentOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <ResponsiveContainer>
                  <LineChart data={telefoniaDailyCallsVsTicketsChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke={P.bdr} />
                    <XAxis
                      dataKey="dia"
                      tick={{ fill: P.dim, fontSize: 9 }}
                      interval={Math.max(
                        0,
                        Math.floor(
                          telefoniaDailyCallsVsTicketsChart.length / 12,
                        ),
                      )}
                    />
                    <YAxis
                      tick={{ fill: P.dim, fontSize: 10 }}
                      allowDecimals={false}
                    />
                    <Tooltip content={<TT />} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line
                      type="monotone"
                      dataKey="Atendidas"
                      name="Ligações Atendidas"
                      stroke={P.green}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Tickets"
                      name="Total de Tickets"
                      stroke={P.pink}
                      strokeDasharray="4 3"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
            <Section title="Detalhamento Diário" icon={<Ico Icon={Calendar} />}>
              <div
                style={{
                  overflowX: "auto",
                  borderRadius: 12,
                  border: `1px solid ${P.bdr}`,
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr>
                      {[
                        "Dia",
                        "Total",
                        "Atend.",
                        "Não At.",
                        "Aband.",
                        "Tx Ab./NA",
                        "TMA(s)",
                        "TME(s)",
                        "Tx Atend.",
                        "NS",
                      ].map((h, i) => (
                        <th
                          key={h}
                          style={{
                            padding: "10px 10px",
                            textAlign: i === 0 ? "left" : "right",
                            color: P.dim,
                            fontWeight: 600,
                            fontSize: 10,
                            textTransform: "uppercase",
                            letterSpacing: 0.8,
                            background: P.card,
                            borderBottom: `1px solid ${P.bdr}`,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {telefoniaDailyGroups.flatMap((day, idx) => {
                      const expanded = !!expandedTelefoniaDays[day.key];

                      const parentRow = (
                        <tr
                          key={`day-${day.key}`}
                          onClick={
                            day.hasHourlyDetails
                              ? () => toggleTelefoniaDay(day.key)
                              : undefined
                          }
                          style={{
                            background: idx % 2 === 0 ? "transparent" : P.card,
                            cursor: day.hasHourlyDetails
                              ? "pointer"
                              : "default",
                          }}
                        >
                          <td
                            style={{
                              padding: "8px 10px",
                              textAlign: "left",
                              color: P.text,
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                              borderBottom: `1px solid ${P.bdr}15`,
                            }}
                          >
                            {day.hasHourlyDetails
                              ? expanded
                                ? "▾ "
                                : "▸ "
                              : "• "}
                            {day.label}
                          </td>
                          <td
                            style={{
                              padding: "8px 10px",
                              textAlign: "right",
                              color: P.text,
                              borderBottom: `1px solid ${P.bdr}15`,
                            }}
                          >
                            {day.total}
                          </td>
                          <td
                            style={{
                              padding: "8px 10px",
                              textAlign: "right",
                              color: P.text,
                              borderBottom: `1px solid ${P.bdr}15`,
                            }}
                          >
                            {day.atendidas}
                          </td>
                          <td
                            style={{
                              padding: "8px 10px",
                              textAlign: "right",
                              color: P.text,
                              borderBottom: `1px solid ${P.bdr}15`,
                            }}
                          >
                            {day.naoAtendidas}
                          </td>
                          <td
                            style={{
                              padding: "8px 10px",
                              textAlign: "right",
                              color: P.text,
                              borderBottom: `1px solid ${P.bdr}15`,
                            }}
                          >
                            {day.abandonadas}
                          </td>
                          <td
                            style={{
                              padding: "8px 10px",
                              textAlign: "right",
                              color: P.text,
                              borderBottom: `1px solid ${P.bdr}15`,
                            }}
                          >
                            {fmtPct(day.txAbandono)}
                          </td>
                          <td
                            style={{
                              padding: "8px 10px",
                              textAlign: "right",
                              color: P.text,
                              borderBottom: `1px solid ${P.bdr}15`,
                            }}
                          >
                            {fmtSec(day.tma)}
                          </td>
                          <td
                            style={{
                              padding: "8px 10px",
                              textAlign: "right",
                              color: P.text,
                              borderBottom: `1px solid ${P.bdr}15`,
                            }}
                          >
                            {fmtSec(day.tme)}
                          </td>
                          <td
                            style={{
                              padding: "8px 10px",
                              textAlign: "right",
                              color: P.text,
                              borderBottom: `1px solid ${P.bdr}15`,
                            }}
                          >
                            {day.total ? fmtPct(day.txAtend) : "-"}
                          </td>
                          <td
                            style={{
                              padding: "8px 10px",
                              textAlign: "right",
                              color: P.text,
                              borderBottom: `1px solid ${P.bdr}15`,
                            }}
                          >
                            {day.total && day.txAtend >= 0.9 ? "✅" : "⚠️"}
                          </td>
                        </tr>
                      );

                      if (!day.hasHourlyDetails || !expanded) {
                        return [parentRow];
                      }

                      const children = day.rows.map((row, childIdx) => {
                        const txAtend = row.total
                          ? row.atendidas / row.total
                          : 0;
                        return (
                          <tr
                            key={`hour-${day.key}-${childIdx}`}
                            style={{ background: `${P.cardH}88` }}
                          >
                            <td
                              style={{
                                padding: "8px 10px 8px 26px",
                                textAlign: "left",
                                color: P.dim,
                                fontWeight: 500,
                                whiteSpace: "nowrap",
                                borderBottom: `1px solid ${P.bdr}15`,
                              }}
                            >
                              {row.hourLabel}
                            </td>
                            <td
                              style={{
                                padding: "8px 10px",
                                textAlign: "right",
                                color: P.dim,
                                borderBottom: `1px solid ${P.bdr}15`,
                              }}
                            >
                              {row.total}
                            </td>
                            <td
                              style={{
                                padding: "8px 10px",
                                textAlign: "right",
                                color: P.dim,
                                borderBottom: `1px solid ${P.bdr}15`,
                              }}
                            >
                              {row.atendidas}
                            </td>
                            <td
                              style={{
                                padding: "8px 10px",
                                textAlign: "right",
                                color: P.dim,
                                borderBottom: `1px solid ${P.bdr}15`,
                              }}
                            >
                              {row.naoAtendidas}
                            </td>
                            <td
                              style={{
                                padding: "8px 10px",
                                textAlign: "right",
                                color: P.dim,
                                borderBottom: `1px solid ${P.bdr}15`,
                              }}
                            >
                              {row.abandonadas}
                            </td>
                            <td
                              style={{
                                padding: "8px 10px",
                                textAlign: "right",
                                color: P.dim,
                                borderBottom: `1px solid ${P.bdr}15`,
                              }}
                            >
                              {fmtPct(row.txAbandono)}
                            </td>
                            <td
                              style={{
                                padding: "8px 10px",
                                textAlign: "right",
                                color: P.dim,
                                borderBottom: `1px solid ${P.bdr}15`,
                              }}
                            >
                              {fmtSec(row.tma)}
                            </td>
                            <td
                              style={{
                                padding: "8px 10px",
                                textAlign: "right",
                                color: P.dim,
                                borderBottom: `1px solid ${P.bdr}15`,
                              }}
                            >
                              {fmtSec(row.tme)}
                            </td>
                            <td
                              style={{
                                padding: "8px 10px",
                                textAlign: "right",
                                color: P.dim,
                                borderBottom: `1px solid ${P.bdr}15`,
                              }}
                            >
                              {row.total ? fmtPct(txAtend) : "-"}
                            </td>
                            <td
                              style={{
                                padding: "8px 10px",
                                textAlign: "right",
                                color: P.dim,
                                borderBottom: `1px solid ${P.bdr}15`,
                              }}
                            >
                              {row.total && txAtend >= 0.9 ? "✅" : "⚠️"}
                            </td>
                          </tr>
                        );
                      });

                      return [parentRow, ...children];
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        )}

        {tab === "atividade-hora" && (
          <Suspense
            fallback={
              <div style={{ padding: 24, color: P.dim }}>
                Carregando aba Atividade/Hora…
              </div>
            }
          >
            <AtividadeHoraTab
              P={P}
              ChartCard={ChartCard}
              Section={Section}
              Table={Table}
              TT={TT}
              Ico={Ico}
              fCons={fCons}
              fTickets={fTickets}
              dateFrom={dateFrom}
              dateTo={dateTo}
              produtoFilter={produtoFilter}
              fmtPct={fmtPct}
              isAttendant={isAttendant}
              resolveHourFromConsEntry={resolveHourFromConsEntry}
              resolveDayGroupFromConsEntry={resolveDayGroupFromConsEntry}
            />
          </Suspense>
        )}

        {tab === "tickets" && (
          <Suspense
            fallback={
              <div style={{ padding: 24, color: P.dim }}>
                Carregando aba Tickets…
              </div>
            }
          >
            <TicketsTab
              P={P}
              PIE_C={PIE_C}
              KPI={KPI}
              ChartCard={ChartCard}
              Section={Section}
              Table={Table}
              TT={TT}
              fmtPct={fmtPct}
              fTickets={fTickets}
              isAttendant={isAttendant}
              isAttendantTeamTicketsScope={isAttendantTeamTicketsScope}
              attendantNotLinked={attendantNotLinked}
              authUser={authUser}
              ticketListFilterSel={ticketListFilterSel}
              setTicketListFilterSel={setTicketListFilterSel}
              selectedTicket={selectedTicket}
              setSelectedTicket={setSelectedTicket}
              ticketListSectionRef={ticketListSectionRef}
            />
          </Suspense>
        )}

        {tab === "equipe" && (
          <>
            <Section title="Visão Unificada — Telefone + Tickets" icon={<Ico Icon={Users} />}>
              <p style={{ fontSize: 12, color: P.dim, margin: "-8px 0 14px" }}>
                Acionamentos = ligações atendidas + tickets (contagem separada).
              </p>
              <Table
                headers={[
                  "Atendente",
                  "Cham. Atend.",
                  "Tickets",
                  "Tkt Abertos",
                  "Total",
                  "TMA(s)",
                  "TME(s)",
                ]}
                rows={equipe.map((e) => [
                  e.nome,
                  e.chamAtend,
                  e.tickets,
                  e.tktAbertos,
                  e.total,
                  fmtSec(e.tma),
                  fmtSec(e.tme),
                ])}
              />
            </Section>
            <Section title="Registros" icon={<Ico Icon={Receipt} />}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {(() => {
                  const ratio = Number(kpis.txRegistros) || 0;
                  const goal = Number(ticketGoalPct) / 100;
                  const goalReached = Number.isFinite(goal) && ratio >= goal;
                  return (
                    <>
                      <KPI
                        icon={<Ico Icon={Receipt} />}
                        label="Registros / Ligações Atendidas"
                        value={fmtPct(ratio)}
                        sub={`${kpis.tkt} tickets de ${kpis.ta} ligações atendidas`}
                        color={P.purple}
                        series={kpiSeries?.txRegistros}
                      />
                      <KPI
                        icon={<Ico Icon={Target} />}
                        label="Objetivo de Registros"
                        value={fmtPct(Number.isFinite(goal) ? goal : 0)}
                        sub={
                          goalReached
                            ? "Objetivo atingido"
                            : `Atual ${fmtPct(ratio)}`
                        }
                        color={goalReached ? P.green : P.orange}
                      />
                    </>
                  );
                })()}
              </div>
            </Section>
            <div
              style={{
                display: "flex",
                gap: 14,
                flexWrap: "wrap",
                marginTop: 14,
              }}
            >
              <ChartCard title="Produtividade: Chamadas + Tickets" h={260}>
                <ResponsiveContainer>
                  <BarChart data={equipe} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke={P.bdr} />
                    <XAxis
                      dataKey="nome"
                      tick={{ fill: P.dim, fontSize: 10 }}
                    />
                    <YAxis tick={{ fill: P.dim, fontSize: 10 }} />
                    <Tooltip content={<TT />} />
                    <Bar
                      dataKey="chamAtend"
                      name="Chamadas"
                      fill={P.accent}
                      radius={[4, 4, 0, 0]}
                      stackId="a"
                    />
                    <Bar
                      dataKey="tickets"
                      name="Tickets"
                      fill={P.purple}
                      radius={[4, 4, 0, 0]}
                      stackId="a"
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="TMA por Atendente (seg)" h={260}>
                <ResponsiveContainer>
                  <BarChart data={equipe.filter((e) => e.tma > 0)} barSize={32}>
                    <CartesianGrid strokeDasharray="3 3" stroke={P.bdr} />
                    <XAxis
                      dataKey="nome"
                      tick={{ fill: P.dim, fontSize: 10 }}
                    />
                    <YAxis tick={{ fill: P.dim, fontSize: 10 }} />
                    <Tooltip content={<TT />} />
                    <Bar
                      dataKey="tma"
                      name="TMA(s)"
                      fill={P.orange}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
            <div
              style={{
                display: "flex",
                gap: 14,
                flexWrap: "wrap",
                marginTop: 14,
              }}
            >
              <div
                style={{
                  background: P.card,
                  borderRadius: 14,
                  border: `1px solid ${P.bdr}`,
                  padding: "14px 14px 6px",
                  flex: "1 1 340px",
                  minWidth: 300,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
                    flexWrap: "wrap",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: P.dim,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    Ligações · Transferências · Erros/App por Atendente
                  </span>
                  <div style={{ display: "flex", gap: 5 }}>
                    {[
                      { key: "lig", label: "Ligações", color: P.accent },
                      {
                        key: "transf",
                        label: "Transferências",
                        color: P.green,
                      },
                      { key: "erros", label: "Erros/App", color: P.red },
                    ].map(({ key, label, color }) => (
                      <button
                        key={key}
                        onClick={() =>
                          setSeriesVis((v) => ({ ...v, [key]: !v[key] }))
                        }
                        style={{
                          padding: "3px 10px",
                          border: `1px solid ${seriesVis[key] ? color : P.bdr}`,
                          borderRadius: 20,
                          cursor: "pointer",
                          background: seriesVis[key]
                            ? color + "22"
                            : "transparent",
                          color: seriesVis[key] ? color : P.dim,
                          fontSize: 10,
                          fontWeight: 600,
                          transition: "all .15s",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart data={equipe} barGap={3} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke={P.bdr} />
                      <XAxis
                        dataKey="nome"
                        tick={{ fill: P.dim, fontSize: 10 }}
                      />
                      <YAxis tick={{ fill: P.dim, fontSize: 10 }} />
                      <Tooltip content={<TT />} />
                      {seriesVis.lig && (
                        <Bar
                          dataKey="chamAtend"
                          name="Ligações Atendidas"
                          fill={P.accent}
                          radius={[4, 4, 0, 0]}
                        />
                      )}
                      {seriesVis.transf && (
                        <Bar
                          dataKey="transferencias"
                          name="Transferências"
                          fill={P.green}
                          radius={[4, 4, 0, 0]}
                        />
                      )}
                      {seriesVis.erros && (
                        <Bar
                          dataKey="errosApp"
                          name="Erros/App"
                          fill={P.red}
                          radius={[4, 4, 0, 0]}
                        />
                      )}
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <Section title="Alertas" icon={<Ico Icon={AlertTriangle} />}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {equipe
                  .filter((e) => e.tktAbertos > alertTktLimit)
                  .map((e) => (
                    <div
                      key={e.nome + "t"}
                      style={{
                        background: P.redD,
                        borderRadius: 10,
                        padding: "10px 14px",
                        fontSize: 12,
                        color: P.text,
                        border: `1px solid ${P.red}33`,
                      }}
                    >
                      🔴 <b>{e.nome}</b> — <b>{e.tktAbertos}</b> tickets em
                      aberto (acima de {alertTktLimit})
                    </div>
                  ))}
                {equipe
                  .filter((e) => e.tma > alertTmaLimit)
                  .map((e) => (
                    <div
                      key={e.nome + "m"}
                      style={{
                        background: P.orangeD,
                        borderRadius: 10,
                        padding: "10px 14px",
                        fontSize: 12,
                        color: P.text,
                        border: `1px solid ${P.orange}33`,
                      }}
                    >
                      ⏱ <b>{e.nome}</b> — TMA de <b>{fmtSec(e.tma)}</b> (acima
                      de {fmtSec(alertTmaLimit)})
                    </div>
                  ))}
                {equipe.every(
                  (e) =>
                    e.tktAbertos <= alertTktLimit && e.tma <= alertTmaLimit,
                ) && (
                  <div
                    style={{
                      background: P.greenD,
                      borderRadius: 10,
                      padding: "10px 14px",
                      fontSize: 12,
                      color: P.text,
                      border: `1px solid ${P.green}33`,
                    }}
                  >
                    ✅ Equipe dentro dos parâmetros.
                  </div>
                )}
              </div>
            </Section>
          </>
        )}

        {tab === "atualizacao" && (
          <>
            <Section title="Atualização Incremental" icon={<Ico Icon={Plus} />}>
              <div
                style={{
                  background: P.card,
                  borderRadius: 14,
                  border: `1px solid ${P.bdr}`,
                  padding: "16px 16px 14px",
                  maxWidth: 780,
                }}
              >
                <p
                  style={{
                    fontSize: 12,
                    color: P.dim,
                    margin: "0 0 14px",
                    lineHeight: 1.5,
                  }}
                >
                  Envie novamente o mesmo arquivo consolidado para atualizar o
                  banco sem duplicar dados. Neste modo, apenas linhas novas sao
                  aproveitadas. Tickets ja existentes em aberto podem ser
                  atualizados quando chegarem como fechados.
                </p>

                <div
                  onClick={() =>
                    incrementalStatus.state !== "saving" &&
                    incrementalFileRef.current?.click()
                  }
                  style={{
                    border: `2px dashed ${incrementalStatus.state === "saving" ? P.accent : P.bdr}`,
                    borderRadius: 12,
                    padding: "26px 18px",
                    cursor:
                      incrementalStatus.state === "saving"
                        ? "not-allowed"
                        : "pointer",
                    background: P.cardH,
                    textAlign: "center",
                    transition: "all .2s",
                    opacity: incrementalStatus.state === "saving" ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (incrementalStatus.state !== "saving")
                      e.currentTarget.style.borderColor = P.accent;
                  }}
                  onMouseLeave={(e) => {
                    if (incrementalStatus.state !== "saving")
                      e.currentTarget.style.borderColor = P.bdr;
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 8 }}>
                    {incrementalStatus.state === "saving" ? "⏳" : "📥"}
                  </div>
                  <div style={{ color: P.text, fontWeight: 600, fontSize: 13 }}>
                    {incrementalStatus.state === "saving"
                      ? "Processando..."
                      : "Clique para adicionar novas linhas"}
                  </div>
                  <div style={{ color: P.dim, fontSize: 11, marginTop: 4 }}>
                    Formato aceito: .xlsx ou .xls
                  </div>
                </div>

                {incrementalStatus.state !== "idle" && (
                  <div
                    style={{
                      marginTop: 12,
                      fontSize: 12,
                      color:
                        incrementalStatus.state === "success"
                          ? P.green
                          : incrementalStatus.state === "error"
                            ? P.red
                            : P.dim,
                    }}
                  >
                    {incrementalStatus.message}
                  </div>
                )}

                <input
                  ref={incrementalFileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    if (e.target.files[0]) {
                      handleIncrementalFile(e.target.files[0]);
                    }
                  }}
                />

                <div
                  style={{
                    marginTop: 14,
                    borderTop: `1px solid ${P.bdr}`,
                    paddingTop: 14,
                  }}
                >
                  <p
                    style={{
                      fontSize: 12,
                      color: P.dim,
                      margin: "0 0 10px",
                      lineHeight: 1.5,
                    }}
                  >
                    Reprocessar completo (upsert): atualiza registros ja
                    existentes, incluindo campos como trâmites e descrição.
                  </p>

                  <div
                    onClick={() =>
                      reprocessStatus.state !== "saving" &&
                      reprocessFileRef.current?.click()
                    }
                    style={{
                      border: `2px dashed ${reprocessStatus.state === "saving" ? P.orange : P.bdr}`,
                      borderRadius: 12,
                      padding: "22px 18px",
                      cursor:
                        reprocessStatus.state === "saving"
                          ? "not-allowed"
                          : "pointer",
                      background: P.card,
                      textAlign: "center",
                      transition: "all .2s",
                      opacity: reprocessStatus.state === "saving" ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (reprocessStatus.state !== "saving")
                        e.currentTarget.style.borderColor = P.orange;
                    }}
                    onMouseLeave={(e) => {
                      if (reprocessStatus.state !== "saving")
                        e.currentTarget.style.borderColor = P.bdr;
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 8 }}>
                      {reprocessStatus.state === "saving" ? "⏳" : "♻️"}
                    </div>
                    <div
                      style={{ color: P.text, fontWeight: 600, fontSize: 13 }}
                    >
                      {reprocessStatus.state === "saving"
                        ? "Processando..."
                        : "Reprocessar base completa"}
                    </div>
                    <div style={{ color: P.dim, fontSize: 11, marginTop: 4 }}>
                      Use o mesmo arquivo consolidado (.xlsx/.xls)
                    </div>
                  </div>

                  {reprocessStatus.state !== "idle" && (
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 12,
                        color:
                          reprocessStatus.state === "success"
                            ? P.green
                            : reprocessStatus.state === "error"
                              ? P.red
                              : P.dim,
                      }}
                    >
                      {reprocessStatus.message}
                    </div>
                  )}

                  <input
                    ref={reprocessFileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files[0]) {
                        handleReprocessFile(e.target.files[0]);
                      }
                    }}
                  />
                </div>
              </div>
            </Section>

            <Section title="Gestão de Usuários" icon={<Ico Icon={ShieldCheck} />}>
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  flexWrap: "wrap",
                }}
              >
                <form
                  onSubmit={handleCreateUser}
                  style={{
                    background: P.card,
                    borderRadius: 14,
                    border: `1px solid ${P.bdr}`,
                    padding: 14,
                    flex: "1 1 360px",
                    minWidth: 320,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: P.dim,
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      marginBottom: 10,
                    }}
                  >
                    Novo usuário
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    <input
                      placeholder="Usuário"
                      value={userForm.username}
                      onChange={(e) =>
                        setUserForm((v) => ({ ...v, username: e.target.value }))
                      }
                      style={{
                        background: P.cardH,
                        border: `1px solid ${P.bdr}`,
                        borderRadius: 8,
                        color: P.text,
                        padding: "8px 10px",
                        fontSize: 12,
                      }}
                      required
                    />
                    <input
                      type="password"
                      placeholder="Senha"
                      value={userForm.password}
                      onChange={(e) =>
                        setUserForm((v) => ({ ...v, password: e.target.value }))
                      }
                      style={{
                        background: P.cardH,
                        border: `1px solid ${P.bdr}`,
                        borderRadius: 8,
                        color: P.text,
                        padding: "8px 10px",
                        fontSize: 12,
                      }}
                      required
                    />
                    <select
                      value={userForm.role}
                      onChange={(e) =>
                        setUserForm((v) => ({ ...v, role: e.target.value }))
                      }
                      style={{
                        background: P.cardH,
                        border: `1px solid ${P.bdr}`,
                        borderRadius: 8,
                        color: P.text,
                        padding: "8px 10px",
                        fontSize: 12,
                      }}
                    >
                      <option value="atendente">Atendente</option>
                      <option value="master">Master</option>
                    </select>

                    {userForm.role === "atendente" && (
                      <select
                        value={userForm.attendantId}
                        onChange={(e) =>
                          setUserForm((v) => ({
                            ...v,
                            attendantId: e.target.value,
                          }))
                        }
                        style={{
                          background: P.cardH,
                          border: `1px solid ${P.bdr}`,
                          borderRadius: 8,
                          color: P.text,
                          padding: "8px 10px",
                          fontSize: 12,
                        }}
                        required
                      >
                        <option value="">Selecione o atendente</option>
                        {userLinkOptions.attendants.map((attendant) => (
                          <option key={attendant.id} value={attendant.id}>
                            {attendant.name}
                          </option>
                        ))}
                      </select>
                    )}

                    <button
                      type="submit"
                      style={{
                        marginTop: 4,
                        background: P.accent,
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "9px 10px",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Cadastrar usuário
                    </button>
                  </div>

                  {userMgmtStatus.state !== "idle" && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        color:
                          userMgmtStatus.state === "success"
                            ? P.green
                            : userMgmtStatus.state === "error"
                              ? P.red
                              : P.dim,
                      }}
                    >
                      {userMgmtStatus.message}
                    </div>
                  )}
                </form>

                <form
                  onSubmit={handleSaveAttendant}
                  style={{
                    background: P.card,
                    borderRadius: 14,
                    border: `1px solid ${P.bdr}`,
                    padding: 14,
                    flex: "1 1 360px",
                    minWidth: 320,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: P.dim,
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      marginBottom: 10,
                    }}
                  >
                    Novo / editar atendente
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    <select
                      value={attendantForm.id}
                      onChange={(e) => {
                        const selected = userLinkOptions.attendants.find(
                          (attendant) =>
                            String(attendant.id) === e.target.value,
                        );
                        if (!selected) {
                          setAttendantForm({
                            id: "",
                            name: "",
                            atplusAlias: "",
                            ticketsAlias: "",
                          });
                          return;
                        }
                        loadAttendantIntoForm(selected);
                      }}
                      style={{
                        background: P.cardH,
                        border: `1px solid ${P.bdr}`,
                        borderRadius: 8,
                        color: P.text,
                        padding: "8px 10px",
                        fontSize: 12,
                      }}
                    >
                      <option value="">Novo atendente</option>
                      {userLinkOptions.attendants.map((attendant) => (
                        <option key={attendant.id} value={attendant.id}>
                          {attendant.name}
                        </option>
                      ))}
                    </select>
                    <input
                      placeholder="Nome"
                      value={attendantForm.name}
                      onChange={(e) =>
                        setAttendantForm((v) => ({
                          ...v,
                          name: e.target.value,
                        }))
                      }
                      style={{
                        background: P.cardH,
                        border: `1px solid ${P.bdr}`,
                        borderRadius: 8,
                        color: P.text,
                        padding: "8px 10px",
                        fontSize: 12,
                      }}
                      required
                    />
                    <input
                      placeholder="AtPlus alias"
                      value={attendantForm.atplusAlias}
                      onChange={(e) =>
                        setAttendantForm((v) => ({
                          ...v,
                          atplusAlias: e.target.value,
                        }))
                      }
                      style={{
                        background: P.cardH,
                        border: `1px solid ${P.bdr}`,
                        borderRadius: 8,
                        color: P.text,
                        padding: "8px 10px",
                        fontSize: 12,
                      }}
                      required
                    />
                    <input
                      placeholder="Ellevo alias"
                      value={attendantForm.ticketsAlias}
                      onChange={(e) =>
                        setAttendantForm((v) => ({
                          ...v,
                          ticketsAlias: e.target.value,
                        }))
                      }
                      style={{
                        background: P.cardH,
                        border: `1px solid ${P.bdr}`,
                        borderRadius: 8,
                        color: P.text,
                        padding: "8px 10px",
                        fontSize: 12,
                      }}
                      required
                    />
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="submit"
                        style={{
                          background: P.accent,
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          padding: "9px 10px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Salvar atendente
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setAttendantForm({
                            id: "",
                            name: "",
                            atplusAlias: "",
                            ticketsAlias: "",
                          })
                        }
                        style={{
                          background: "transparent",
                          color: P.dim,
                          border: `1px solid ${P.bdr}`,
                          borderRadius: 8,
                          padding: "9px 10px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Limpar
                      </button>
                      <button
                        type="button"
                        onClick={handleClearAttendants}
                        style={{
                          background: "transparent",
                          color: P.red,
                          border: `1px solid ${P.red}`,
                          borderRadius: 8,
                          padding: "9px 10px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Limpar tabela
                      </button>
                    </div>
                  </div>

                  {attendantMgmtStatus.state !== "idle" && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        color:
                          attendantMgmtStatus.state === "success"
                            ? P.green
                            : attendantMgmtStatus.state === "error"
                              ? P.red
                              : P.dim,
                      }}
                    >
                      {attendantMgmtStatus.message}
                    </div>
                  )}

                  <div style={{ marginTop: 12 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: P.dim,
                        textTransform: "uppercase",
                        letterSpacing: 0.8,
                        marginBottom: 8,
                      }}
                    >
                      Atendentes cadastrados
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gap: 8,
                        maxHeight: 220,
                        overflow: "auto",
                        paddingRight: 2,
                      }}
                    >
                      {userLinkOptions.attendants.length ? (
                        userLinkOptions.attendants.map((attendant) => (
                          <button
                            key={attendant.id}
                            type="button"
                            onClick={() => loadAttendantIntoForm(attendant)}
                            style={{
                              textAlign: "left",
                              background: P.cardH,
                              border: `1px solid ${P.bdr}`,
                              borderRadius: 10,
                              color: P.text,
                              padding: "8px 10px",
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ fontSize: 12, fontWeight: 700 }}>
                              {attendant.name}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: P.dim,
                                marginTop: 2,
                              }}
                            >
                              {attendant.atplusAlias || "-"} ·{" "}
                              {attendant.ticketsAlias || "-"}
                            </div>
                          </button>
                        ))
                      ) : (
                        <div style={{ fontSize: 12, color: P.dim }}>
                          Nenhum atendente cadastrado.
                        </div>
                      )}
                    </div>
                  </div>
                </form>

                <form
                  onSubmit={handleSaveTicketGoal}
                  style={{
                    background: P.card,
                    borderRadius: 14,
                    border: `1px solid ${P.bdr}`,
                    padding: 14,
                    flex: "1 1 260px",
                    minWidth: 260,
                    maxWidth: 320,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: P.dim,
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      marginBottom: 10,
                    }}
                  >
                    Meta de registros
                  </div>

                  <div style={{ fontSize: 12, color: P.dim, marginBottom: 8 }}>
                    Define o objetivo de % de tickets sobre o total de ligações
                    na visão individual do atendente.
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    <label
                      style={{
                        fontSize: 11,
                        color: P.dim,
                        fontWeight: 600,
                      }}
                    >
                      Objetivo (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={ticketGoalInput}
                      onChange={(e) => {
                        setTicketGoalInput(e.target.value);
                        if (ticketGoalStatus.state !== "idle") {
                          setTicketGoalStatus({ state: "idle", message: "" });
                        }
                      }}
                      style={{
                        background: P.cardH,
                        border: `1px solid ${P.bdr}`,
                        borderRadius: 8,
                        color: P.text,
                        padding: "8px 10px",
                        fontSize: 12,
                      }}
                      required
                    />

                    <button
                      type="submit"
                      style={{
                        marginTop: 4,
                        background: P.accent,
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "9px 10px",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Salvar meta
                    </button>
                  </div>

                  {ticketGoalStatus.state !== "idle" && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        color:
                          ticketGoalStatus.state === "success"
                            ? P.green
                            : ticketGoalStatus.state === "error"
                              ? P.red
                              : P.dim,
                      }}
                    >
                      {ticketGoalStatus.message}
                    </div>
                  )}
                </form>

                <form
                  onSubmit={handleSaveAlertSettings}
                  style={{
                    background: P.card,
                    borderRadius: 14,
                    border: `1px solid ${P.bdr}`,
                    padding: 14,
                    flex: "1 1 280px",
                    minWidth: 280,
                    maxWidth: 360,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: P.dim,
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      marginBottom: 10,
                    }}
                  >
                    Parâmetros de alertas
                  </div>

                  <div style={{ fontSize: 12, color: P.dim, marginBottom: 8 }}>
                    Define os limites que disparam alertas na aba Resumo e na
                    visão de equipe. Atendentes acima destes limites são
                    sinalizados.
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <label
                        style={{
                          fontSize: 11,
                          color: P.dim,
                          fontWeight: 600,
                        }}
                      >
                        Tickets em aberto acima de
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="9999"
                        step="1"
                        value={alertSettingsInput.tktAbertosLimit}
                        onChange={(e) => {
                          setAlertSettingsInput((prev) => ({
                            ...prev,
                            tktAbertosLimit: e.target.value,
                          }));
                          if (alertSettingsStatus.state !== "idle") {
                            setAlertSettingsStatus({
                              state: "idle",
                              message: "",
                            });
                          }
                        }}
                        style={{
                          background: P.cardH,
                          border: `1px solid ${P.bdr}`,
                          borderRadius: 8,
                          color: P.text,
                          padding: "8px 10px",
                          fontSize: 12,
                        }}
                        required
                      />
                    </div>

                    <div style={{ display: "grid", gap: 4 }}>
                      <label
                        style={{
                          fontSize: 11,
                          color: P.dim,
                          fontWeight: 600,
                        }}
                      >
                        TMA acima de (segundos)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="86400"
                        step="1"
                        value={alertSettingsInput.tmaLimitSec}
                        onChange={(e) => {
                          setAlertSettingsInput((prev) => ({
                            ...prev,
                            tmaLimitSec: e.target.value,
                          }));
                          if (alertSettingsStatus.state !== "idle") {
                            setAlertSettingsStatus({
                              state: "idle",
                              message: "",
                            });
                          }
                        }}
                        style={{
                          background: P.cardH,
                          border: `1px solid ${P.bdr}`,
                          borderRadius: 8,
                          color: P.text,
                          padding: "8px 10px",
                          fontSize: 12,
                        }}
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      style={{
                        marginTop: 4,
                        background: P.accent,
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "9px 10px",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Salvar parâmetros
                    </button>
                  </div>

                  {alertSettingsStatus.state !== "idle" && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        color:
                          alertSettingsStatus.state === "success"
                            ? P.green
                            : alertSettingsStatus.state === "error"
                              ? P.red
                              : P.dim,
                      }}
                    >
                      {alertSettingsStatus.message}
                    </div>
                  )}
                </form>

                <div
                  style={{
                    background: P.card,
                    borderRadius: 14,
                    border: `1px solid ${P.bdr}`,
                    padding: 14,
                    flex: "1 1 420px",
                    minWidth: 340,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: P.dim,
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      marginBottom: 10,
                    }}
                  >
                    Usuários cadastrados
                  </div>
                  {usersList.length === 0 ? (
                    <div style={{ fontSize: 12, color: P.dim }}>
                      Nenhum usuário cadastrado.
                    </div>
                  ) : (
                    <Table
                      headers={[
                        "Usuário",
                        "Perfil",
                        "Atendente",
                        "Ramal",
                        "Responsável",
                      ]}
                      rows={usersList.map((u) => [
                        u.username,
                        u.role,
                        u.attendantName || "-",
                        u.attendantRamal || "-",
                        u.attendantResponsavel || "-",
                      ])}
                    />
                  )}
                </div>
              </div>
            </Section>
          </>
        )}
      </div>

      {selectedTicket && (
        <div
          onClick={() => setSelectedTicket(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "#0008",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(980px, 100%)",
              maxHeight: "85vh",
              overflowY: "auto",
              background: P.card,
              border: `1px solid ${P.bdr}`,
              borderRadius: 12,
              padding: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: P.text,
                  fontWeight: 700,
                }}
              >
                Detalhes do Ticket {selectedTicket.chamado}
              </h3>
              <button
                onClick={() => setSelectedTicket(null)}
                style={{
                  border: `1px solid ${P.bdr}`,
                  background: "transparent",
                  color: P.dim,
                  borderRadius: 6,
                  fontSize: 11,
                  padding: "4px 8px",
                  cursor: "pointer",
                }}
              >
                Fechar
              </button>
            </div>

            <div
              style={{
                marginTop: 10,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 8,
                fontSize: 12,
              }}
            >
              <div>
                <b>Status:</b> {selectedTicket.status || "-"}
              </div>
              <div>
                <b>Abertura:</b>{" "}
                {fmtDateTime(
                  selectedTicket.dataAbertura || selectedTicket.dateReal,
                )}
              </div>
              <div>
                <b>Fechamento:</b> {fmtDateTime(selectedTicket.dataFechamento)}
              </div>
              <div>
                <b>Responsável:</b> {selectedTicket.responsavel || "-"}
              </div>
              <div>
                <b>Nível:</b> {selectedTicket.severidade || "-"}
              </div>
              <div>
                <b>Categoria:</b> {selectedTicket.categoria || "-"}
              </div>
              <div>
                <b>Categoria Raw:</b> {selectedTicket.categoriaRaw || "-"}
              </div>
              <div>
                <b>Natureza:</b> {selectedTicket.natureza || "-"}
              </div>
              <div>
                <b>Qualificação:</b> {selectedTicket.qualificacao || "-"}
              </div>
              <div>
                <b>Cliente:</b> {selectedTicket.cliente || "-"}
              </div>
              <div>
                <b>Módulo:</b> {selectedTicket.modulo || "-"}
              </div>
              <div>
                <b>Produto:</b>{" "}
                {String(selectedTicket.produto || "").trim() || "Não informado"}
              </div>
              <div>
                <b>Tempo do Acionamento:</b> {selectedTicket.tempoChamadoRaw || "-"}
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: P.text }}>
              <b>Título:</b>
              <div style={{ marginTop: 4, color: P.dim }}>
                {selectedTicket.titulo || "-"}
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: P.text }}>
              <b>Trâmites:</b>
              <div
                style={{ marginTop: 4, color: P.dim, whiteSpace: "pre-wrap" }}
              >
                {selectedTicket.tramites || "-"}
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: P.text }}>
              <b>Descrição:</b>
              <div
                style={{ marginTop: 4, color: P.dim, whiteSpace: "pre-wrap" }}
              >
                {selectedTicket.descricao || "-"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
