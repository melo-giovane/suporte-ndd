import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AGENT_MAP,
  fmtSec,
  fmtPct,
  isErroApp,
  isTransferencia,
} from "./utils.js";
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
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#6366f1",
  "#14b8a6",
  "#f97316",
  "#a855f7",
  "#22d3ee",
  "#fb7185",
];

const PIE_C_LIGHT = [
  "#5500FF",
  "#0086D1",
  "#ED008C",
  "#FF0080",
  "#74CFD0",
  "#00D4AA",
  "#00997A",
  "#FFC000",
  "#E65100",
  "#FF0000",
  "#3C3C3C",
  "#888888",
  "#000000",
];

const INITIAL_THEME_MODE =
  typeof window !== "undefined" &&
  window.localStorage.getItem("theme-mode") === "light"
    ? "light"
    : "dark";

let P = INITIAL_THEME_MODE === "light" ? LIGHT_THEME : DARK_THEME;
let PIE_C = INITIAL_THEME_MODE === "light" ? PIE_C_LIGHT : PIE_C_DARK;

const ResumoTab = lazy(() => import("./tabs/ResumoTab.jsx"));

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

function KPI({ label, value, sub, color, icon }) {
  return (
    <div
      style={{
        background: P.card,
        borderRadius: 14,
        padding: "16px 18px",
        border: `1px solid ${P.bdr}`,
        flex: "1 1 150px",
        minWidth: 140,
        transition: "all .2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color || P.accent;
        e.currentTarget.style.background = P.cardH;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = P.bdr;
        e.currentTarget.style.background = P.card;
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: P.dim,
          textTransform: "uppercase",
          letterSpacing: 1.5,
          marginBottom: 4,
          fontWeight: 600,
        }}
      >
        {icon} {label}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 800,
          color: color || P.text,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: P.muted, marginTop: 3 }}>{sub}</div>
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

function Table({ headers, rows, onRowClick, selectedRowIndex }) {
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
          {rows.map((row, ri) => (
            <tr
              key={ri}
              onClick={() => onRowClick?.(ri, row)}
              style={{
                background:
                  selectedRowIndex === ri
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
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginTop: 2 }}>
          {p.name}:{" "}
          <b>
            {typeof p.value === "number" && p.value < 1 && p.value > 0
              ? fmtPct(p.value)
              : p.value}
          </b>
        </div>
      ))}
    </div>
  );
};

function ChartCard({ title, children, h = 240 }) {
  return (
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
          fontSize: 10,
          fontWeight: 600,
          color: P.dim,
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      <div style={{ height: h }}>{children}</div>
    </div>
  );
}

function TabBtn({ id, icon, label, activeTab, onSelect }) {
  return (
    <button
      onClick={() => onSelect(id)}
      style={{
        padding: "9px 16px",
        border: "none",
        borderRadius: 8,
        cursor: "pointer",
        background: activeTab === id ? P.accent : "transparent",
        color: activeTab === id ? "#fff" : P.dim,
        fontWeight: activeTab === id ? 700 : 500,
        fontSize: 12.5,
        transition: "all .2s",
        display: "flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      {icon} {label}
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
  const [hourlyVolumeMode, setHourlyVolumeMode] = useState("volume");
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
    seriesVis,
    metricSel,
    saveStatus,
    isRestoring,
    incrementalStatus,
    reprocessStatus,
    ticketGoalPct,
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
    equipe,
    dailyChart,
    setTab,
    setDateFrom,
    setDateTo,
    setDayTypeFilter,
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

  const filteredTicketsList = useMemo(() => {
    if (ticketListFilterSel === "todos") return fTickets;
    if (ticketListFilterSel === "abertos")
      return fTickets.filter((t) => t.status === "Aberto");
    if (ticketListFilterSel === "fechados")
      return fTickets.filter((t) => t.status === "Fechado");
    if (ticketListFilterSel === "erros")
      return fTickets.filter((t) => isErroApp(t));
    if (ticketListFilterSel === "transferencias")
      return fTickets.filter((t) => isTransferencia(t));
    if (ticketListFilterSel === "outros")
      return fTickets.filter((t) => !isErroApp(t) && !isTransferencia(t));
    return fTickets;
  }, [fTickets, ticketListFilterSel]);

  const visibleTicketsList = useMemo(() => {
    if (!isAttendant || isAttendantTeamTicketsScope) return filteredTicketsList;

    const responsibleName = (authUser?.attendantResponsavel || "")
      .trim()
      .toLowerCase();

    if (!responsibleName) {
      return [];
    }

    return filteredTicketsList.filter(
      (t) => (t.responsavel || "").trim().toLowerCase() === responsibleName,
    );
  }, [
    authUser?.attendantResponsavel,
    filteredTicketsList,
    isAttendant,
    isAttendantTeamTicketsScope,
  ]);

  const hourlyActivity = useMemo(() => {
    const buckets = new Map();

    fCons.forEach((row) => {
      const hour = resolveHourFromConsEntry(row);
      if (hour === null) return;
      const dayKey = resolveDayGroupFromConsEntry(row)?.key;

      const current = buckets.get(hour) || {
        hora: hour,
        total: 0,
        atendidas: 0,
        naoAtendidas: 0,
        abandonadas: 0,
        registros: 0,
        dayKeys: new Set(),
      };

      current.total += Number(row.total) || 0;
      current.atendidas += Number(row.atendidas) || 0;
      current.naoAtendidas += Number(row.naoAtendidas) || 0;
      current.abandonadas += Number(row.abandonadas) || 0;
      current.registros += 1;
      if (dayKey) {
        current.dayKeys.add(dayKey);
      }

      buckets.set(hour, current);
    });

    return Array.from(buckets.values())
      .sort((a, b) => a.hora - b.hora)
      .map((row) => {
        const { dayKeys, ...baseRow } = row;
        const daysCount = dayKeys.size || row.registros || 0;
        const indisponiveis = row.naoAtendidas + row.abandonadas;
        return {
          ...baseRow,
          horaLabel: `${String(row.hora).padStart(2, "0")}:00`,
          indisponiveis,
          daysCount,
          mediaTotalHora: daysCount
            ? Math.round((row.total / daysCount) * 10) / 10
            : 0,
          mediaAtendidasHora: daysCount
            ? Math.round((row.atendidas / daysCount) * 10) / 10
            : 0,
          txAtend: row.total ? row.atendidas / row.total : 0,
          txAbandono: row.total ? indisponiveis / row.total : 0,
        };
      });
  }, [fCons]);

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

  const ticketFilterLabel = useMemo(() => {
    const labels = {
      todos: "Todos",
      abertos: "Abertos",
      fechados: "Fechados",
      erros: "Erros/App",
      transferencias: "Transferências",
      outros: "Outros",
    };
    return labels[ticketListFilterSel] || "Todos";
  }, [ticketListFilterSel]);

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
        <form
          onSubmit={handleLogin}
          style={{
            width: "min(420px, 100%)",
            background: P.card,
            border: `1px solid ${P.bdr}`,
            borderRadius: 14,
            padding: 22,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              color: P.text,
              fontWeight: 800,
            }}
          >
            Login · Suporte NDD
          </h1>
          <p style={{ margin: "8px 0 18px", fontSize: 12, color: P.dim }}>
            Acesso por perfil: master ou atendente.
          </p>

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
              padding: "9px 10px",
              marginBottom: 12,
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
              padding: "9px 10px",
            }}
            required
          />

          <button
            type="submit"
            style={{
              width: "100%",
              marginTop: 14,
              background: P.accent,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Entrar
          </button>

          <div
            style={{
              marginTop: 10,
              fontSize: 12,
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
          <div style={{ flexShrink: 0 }}>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 800,
                margin: 0,
                letterSpacing: -0.5,
                color: themeMode === "light" ? P.accent : P.text,
                background:
                  themeMode === "dark"
                    ? `linear-gradient(135deg, ${P.accent}, ${P.purple})`
                    : "none",
                WebkitBackgroundClip:
                  themeMode === "dark" ? "text" : "border-box",
                WebkitTextFillColor:
                  themeMode === "dark" ? "transparent" : P.accent,
              }}
            >
              Suporte NDD
            </h1>
            <p style={{ fontSize: 11, color: P.dim, margin: "2px 0 0" }}>
              {kpis.dias} dias filtrados · {totalDaysCount} dias total ·{" "}
              {isAttendant && attendantScope === "team"
                ? kpis.tkt
                : tickets.length}{" "}
              tickets
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
            {(dateFrom || dateTo || dayTypeFilter !== "all") && (
              <button
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setDayTypeFilter("all");
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
            gap: 3,
            background: P.card,
            borderRadius: 10,
            padding: 3,
            marginBottom: 18,
            border: `1px solid ${P.bdr}`,
            flexWrap: "wrap",
          }}
        >
          <TabBtn
            id="resumo"
            icon="📊"
            label="Resumo"
            activeTab={tab}
            onSelect={setTab}
          />
          <TabBtn
            id="telefonia"
            icon="📞"
            label="Telefonia"
            activeTab={tab}
            onSelect={setTab}
          />
          <TabBtn
            id="atividade-hora"
            icon="🕒"
            label="Atividade/Hora"
            activeTab={tab}
            onSelect={setTab}
          />
          <TabBtn
            id="tickets"
            icon="🎫"
            label="Tickets"
            activeTab={tab}
            onSelect={setTab}
          />
          {isMaster && (
            <TabBtn
              id="equipe"
              icon="👥"
              label="Equipe"
              activeTab={tab}
              onSelect={setTab}
            />
          )}
          {isMaster && (
            <TabBtn
              id="atualizacao"
              icon="➕"
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
              metricSel={metricSel}
              setMetricSel={setMetricSel}
              dailyChart={dailyChart}
              fCons={fCons}
              fAtend={fAtend}
              fTickets={fTickets}
              catData={catData}
              sevData={sevData}
              equipe={equipe}
              seriesVis={seriesVis}
              setSeriesVis={setSeriesVis}
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
              icon="🏆"
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
            <Section title="Detalhamento Diário" icon="📅">
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
          <>
            {hourlyActivity.length === 0 ? (
              <Section title="Atividade por Hora" icon="🕒">
                <div
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    border: `1px solid ${P.bdr}`,
                    background: P.card,
                    color: P.dim,
                    fontSize: 12,
                    lineHeight: 1.5,
                  }}
                >
                  Nenhum registro por hora foi encontrado no período filtrado.
                  Reprocesse a base completa com o novo modelo para habilitar
                  esta análise.
                </div>
              </Section>
            ) : (
              <>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  <ChartCard title="Ligações por Hora" h={260}>
                    {!isAttendant && (
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          marginBottom: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        {[
                          { id: "volume", label: "Volume" },
                          { id: "media", label: "Média/Hora" },
                        ].map((option) => {
                          const isActive = hourlyVolumeMode === option.id;
                          return (
                            <button
                              key={option.id}
                              onClick={() => setHourlyVolumeMode(option.id)}
                              style={{
                                border: `1px solid ${isActive ? P.accent : P.bdr}`,
                                background: isActive ? `${P.accent}22` : P.card,
                                color: isActive ? P.text : P.dim,
                                borderRadius: 999,
                                padding: "4px 10px",
                                fontSize: 10,
                                fontWeight: 700,
                                letterSpacing: 0.4,
                                cursor: "pointer",
                              }}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <ResponsiveContainer>
                      <BarChart data={hourlyActivity} barGap={3}>
                        <CartesianGrid strokeDasharray="3 3" stroke={P.bdr} />
                        <XAxis
                          dataKey="horaLabel"
                          tick={{ fill: P.dim, fontSize: 10 }}
                        />
                        <YAxis tick={{ fill: P.dim, fontSize: 10 }} />
                        <Tooltip content={<TT />} />
                        {isAttendant ? (
                          <Bar
                            dataKey="atendidas"
                            name="Ligações Atendidas"
                            fill={P.green}
                            radius={[4, 4, 0, 0]}
                          />
                        ) : hourlyVolumeMode === "volume" ? (
                          <>
                            <Bar
                              dataKey="total"
                              name="Total"
                              fill={P.accent}
                              radius={[4, 4, 0, 0]}
                            />
                            <Bar
                              dataKey="atendidas"
                              name="Atendidas"
                              fill={P.green}
                              radius={[4, 4, 0, 0]}
                            />
                          </>
                        ) : (
                          <>
                            <Bar
                              dataKey="mediaTotalHora"
                              name="Média Total"
                              fill={P.accent}
                              radius={[4, 4, 0, 0]}
                            />
                            <Bar
                              dataKey="mediaAtendidasHora"
                              name="Média Atendidas"
                              fill={P.green}
                              radius={[4, 4, 0, 0]}
                            />
                          </>
                        )}
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  {!isAttendant && (
                    <ChartCard
                      title="Taxa de abandono/Não atendidas por hora"
                      h={260}
                    >
                      <ResponsiveContainer>
                        <LineChart data={hourlyActivity}>
                          <CartesianGrid strokeDasharray="3 3" stroke={P.bdr} />
                          <XAxis
                            dataKey="horaLabel"
                            tick={{ fill: P.dim, fontSize: 10 }}
                          />
                          <YAxis
                            tick={{ fill: P.dim, fontSize: 10 }}
                            domain={[0, 1]}
                            tickFormatter={(v) => fmtPct(v)}
                          />
                          <Tooltip content={<TT />} />
                          <Line
                            type="monotone"
                            dataKey="txAbandono"
                            name="Tx Ab./NA"
                            stroke={P.red}
                            strokeWidth={2}
                            dot={{ r: 2 }}
                          />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  )}
                </div>

                <Section title="Detalhamento por Hora" icon="📋">
                  <Table
                    headers={
                      isAttendant
                        ? ["Hora", "Total", "Atend.", "Não At.", "Aband."]
                        : [
                            "Hora",
                            "Total",
                            "Atend.",
                            "Não At.",
                            "Aband.",
                            "Tx Atend.",
                            "Tx Ab./NA",
                          ]
                    }
                    rows={hourlyActivity.map((h) =>
                      isAttendant
                        ? [
                            h.horaLabel,
                            h.total,
                            h.atendidas,
                            h.naoAtendidas,
                            h.abandonadas,
                          ]
                        : [
                            h.horaLabel,
                            h.total,
                            h.atendidas,
                            h.naoAtendidas,
                            h.abandonadas,
                            fmtPct(h.txAtend),
                            fmtPct(h.txAbandono),
                          ],
                    )}
                  />
                </Section>
              </>
            )}
          </>
        )}

        {tab === "tickets" && (
          <>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <ChartCard title="Por Categoria" h={280}>
                <ResponsiveContainer>
                  <BarChart data={catData} barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke={P.bdr} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: P.dim, fontSize: 9 }}
                      angle={-35}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fill: P.dim, fontSize: 10 }} />
                    <Tooltip content={<TT />} />
                    <Bar dataKey="value" fill={P.accent} radius={[4, 4, 0, 0]}>
                      {catData.map((_, i) => (
                        <Cell key={i} fill={PIE_C[i % PIE_C.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Por Qualificação" h={280}>
                <ResponsiveContainer>
                  <BarChart
                    data={qualData.slice(0, 8)}
                    layout="vertical"
                    barSize={18}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={P.bdr} />
                    <XAxis type="number" tick={{ fill: P.dim, fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: P.dim, fontSize: 9 }}
                      width={180}
                    />
                    <Tooltip content={<TT />} />
                    <Bar
                      dataKey="value"
                      fill={P.purple}
                      radius={[0, 4, 4, 0]}
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
              <ChartCard title="Por Natureza" h={200}>
                <ResponsiveContainer>
                  <BarChart data={natData} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke={P.bdr} />
                    <XAxis dataKey="name" tick={{ fill: P.dim, fontSize: 9 }} />
                    <YAxis tick={{ fill: P.dim, fontSize: 10 }} />
                    <Tooltip content={<TT />} />
                    <Bar dataKey="value" fill={P.cyan} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              {!isAttendantTeamTicketsScope && (
                <ChartCard title="Por Responsável" h={200}>
                  <ResponsiveContainer>
                    <BarChart data={respData} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke={P.bdr} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: P.dim, fontSize: 9 }}
                      />
                      <YAxis tick={{ fill: P.dim, fontSize: 10 }} />
                      <Tooltip content={<TT />} />
                      <Bar
                        dataKey="value"
                        fill={P.pink}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
            </div>
            <Section title="Tabelas Detalhadas" icon="📋">
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <Table
                  headers={["Severidade", "Qtd", "%"]}
                  rows={sevData.map((s) => [
                    s.name,
                    s.value,
                    fmtPct(kpis.tkt ? s.value / kpis.tkt : 0),
                  ])}
                />
                <Table
                  headers={["Natureza", "Qtd", "%"]}
                  rows={natData.map((n) => [
                    n.name,
                    n.value,
                    fmtPct(kpis.tkt ? n.value / kpis.tkt : 0),
                  ])}
                />
                <Table
                  headers={["Qualificação", "Qtd", "%"]}
                  rows={qualData.map((q) => [
                    q.name,
                    q.value,
                    fmtPct(kpis.tkt ? q.value / kpis.tkt : 0),
                  ])}
                />
              </div>
            </Section>
            <div ref={ticketListSectionRef}>
              <Section
                title={`Lista de Tickets · ${ticketFilterLabel}`}
                icon="🧾"
              >
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                    marginBottom: 10,
                  }}
                >
                  {[
                    { key: "todos", label: "Todos" },
                    { key: "abertos", label: "Abertos" },
                    { key: "fechados", label: "Fechados" },
                    { key: "erros", label: "Erros/App" },
                    { key: "transferencias", label: "Transferências" },
                    { key: "outros", label: "Outros" },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => {
                        setTicketListFilterSel(opt.key);
                        setSelectedTicket(null);
                      }}
                      style={{
                        padding: "4px 10px",
                        border: `1px solid ${ticketListFilterSel === opt.key ? P.accent : P.bdr}`,
                        borderRadius: 18,
                        background:
                          ticketListFilterSel === opt.key
                            ? `${P.accent}22`
                            : "transparent",
                        color:
                          ticketListFilterSel === opt.key ? P.accent : P.dim,
                        fontSize: 10,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {attendantNotLinked ? (
                  <div
                    style={{
                      padding: 18,
                      textAlign: "center",
                      color: P.orange,
                      background: P.card,
                      borderRadius: 12,
                      border: `1px solid ${P.orange}`,
                    }}
                  >
                    ⚠️ Perfil sem atendente vinculado. Contate o administrador.
                  </div>
                ) : visibleTicketsList.length === 0 ? (
                  <div
                    style={{
                      padding: 18,
                      textAlign: "center",
                      color: P.green,
                      background: P.card,
                      borderRadius: 12,
                      border: `1px solid ${P.bdr}`,
                    }}
                  >
                    Nenhum ticket para o filtro selecionado.
                  </div>
                ) : (
                  <Table
                    headers={[
                      "Chamado",
                      "Título",
                      "Status",
                      "Responsável",
                      "Severidade",
                      "Categoria",
                    ]}
                    rows={visibleTicketsList.map((t) => [
                      t.chamado || "-",
                      (t.titulo || "-").slice(0, 45),
                      t.status || "-",
                      (t.responsavel || "-").split(" ").slice(0, 2).join(" "),
                      t.severidade || "-",
                      t.categoria || "-",
                    ])}
                    onRowClick={(idx) =>
                      setSelectedTicket(visibleTicketsList[idx])
                    }
                    selectedRowIndex={
                      selectedTicket
                        ? visibleTicketsList.findIndex(
                            (t) => t.chamado === selectedTicket.chamado,
                          )
                        : -1
                    }
                  />
                )}
              </Section>
            </div>
          </>
        )}

        {tab === "equipe" && (
          <>
            <Section title="Visão Unificada — Telefone + Tickets" icon="👥">
              <p style={{ fontSize: 12, color: P.dim, margin: "-8px 0 14px" }}>
                Chamados = ligações atendidas + tickets (contagem separada).
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
            <Section title="Registros" icon="🧾">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {(() => {
                  const ratio = Number(kpis.txRegistros) || 0;
                  const goal = Number(ticketGoalPct) / 100;
                  const goalReached = Number.isFinite(goal) && ratio >= goal;
                  return (
                    <>
                      <KPI
                        icon="🧾"
                        label="Registros / Ligações Atendidas"
                        value={fmtPct(ratio)}
                        sub={`${kpis.tkt} tickets de ${kpis.ta} ligações atendidas`}
                        color={P.purple}
                      />
                      <KPI
                        icon="🎯"
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
            <Section title="Alertas" icon="🚨">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {equipe
                  .filter((e) => e.tktAbertos > 3)
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
                      aberto
                    </div>
                  ))}
                {equipe
                  .filter((e) => e.tma > 300)
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
                      de 5min)
                    </div>
                  ))}
                {equipe.every((e) => e.tktAbertos <= 3 && e.tma <= 300) && (
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
            <Section title="Atualização Incremental" icon="➕">
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

            <Section title="Gestão de Usuários" icon="🔐">
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
                <b>Severidade:</b> {selectedTicket.severidade || "-"}
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
                <b>Tempo Chamado:</b> {selectedTicket.tempoChamadoRaw || "-"}
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
