import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  aggregateBy,
  buildDailyChart,
  buildEquipeData,
  buildKpis,
  filterByDateRange,
} from "../models/dashboardModel.js";

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

export function useDashboardController({
  authToken,
  viewScope = "own",
  canUpload = false,
  onUnauthorized,
} = {}) {
  const [cons, setCons] = useState([]);
  const [atend, setAtend] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("resumo");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dayTypeFilter, setDayTypeFilter] = useState("all");
  const [seriesVis, setSeriesVis] = useState({
    lig: true,
    transf: true,
    erros: true,
  });
  const [metricSel, setMetricSel] = useState("Atendidas");
  const [saveStatus, setSaveStatus] = useState({
    state: "idle",
    message: "",
  });
  const [isRestoring, setIsRestoring] = useState(true);
  const [incrementalStatus, setIncrementalStatus] = useState({
    state: "idle",
    message: "",
  });
  const [reprocessStatus, setReprocessStatus] = useState({
    state: "idle",
    message: "",
  });
  const [teamTotals, setTeamTotals] = useState(null);
  const [ticketGoalPct, setTicketGoalPct] = useState(20);
  const [teamConsFetched, setTeamConsFetched] = useState([]);
  const [teamTicketsFetched, setTeamTicketsFetched] = useState([]);
  const [ownConsFetched, setOwnConsFetched] = useState([]);
  const [ownAtendFetched, setOwnAtendFetched] = useState([]);
  const [ownTicketsFetched, setOwnTicketsFetched] = useState([]);
  const restoreRequestIdRef = useRef(0);
  const incrementalFileRef = useRef();
  const reprocessFileRef = useRef();

  const loadFromDatabase = useCallback(
    async ({ requestId } = {}) => {
      const isStale =
        requestId != null && requestId !== restoreRequestIdRef.current;

      if (isStale) {
        return false;
      }

      if (!authToken) {
        setLoaded(false);
        setIsRestoring(false);
        return false;
      }

      try {
        const query = viewScope === "team" ? "?scope=team" : "?scope=own";
        const resp = await fetch(apiUrl(`/api/dashboard-data${query}`), {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (requestId != null && requestId !== restoreRequestIdRef.current) {
          return false;
        }

        if (resp.status === 401 || resp.status === 403) {
          onUnauthorized?.();
          return false;
        }

        if (!resp.ok) {
          let msg = "Nao foi possivel carregar os dados salvos.";
          try {
            const body = await resp.json();
            msg = body?.error || msg;
          } catch {
            // Keep generic message when response is not JSON.
          }
          setSaveStatus({
            state: "error",
            message: msg,
          });
          return false;
        }

        const body = await resp.json();
        const data = body?.data;

        if (requestId != null && requestId !== restoreRequestIdRef.current) {
          return false;
        }

        if (!data) {
          setSaveStatus({
            state: "error",
            message: "Resposta da API sem dados para o dashboard.",
          });
          return false;
        }

        const nextCons = (data.cons || []).map((row) => ({
          ...row,
          dateReal: parseApiDate(row.dateReal),
        }));
        const nextAtend = (data.atend || []).map((row) => ({
          ...row,
          dateReal: parseApiDate(row.dateReal),
        }));
        const nextTickets = (data.tickets || []).map((row) => ({
          ...row,
          dateReal: parseApiDate(row.dataAbertura),
        }));

        setCons(nextCons);
        setAtend(nextAtend);
        setTickets(nextTickets);
        setTeamTotals(data.teamTotals || null);

        const parseConsList = (list) =>
          (list || []).map((row) => ({
            ...row,
            dateReal: parseApiDate(row.dateReal),
          }));
        const parseTicketList = (list) =>
          (list || []).map((row) => ({
            ...row,
            dateReal: parseApiDate(row.dataAbertura),
          }));

        setTeamConsFetched(parseConsList(data.teamCons));
        setTeamTicketsFetched(parseTicketList(data.teamTickets));
        setOwnConsFetched(parseConsList(data.ownCons));
        setOwnAtendFetched(parseConsList(data.ownAtend));
        setOwnTicketsFetched(parseTicketList(data.ownTickets));
        const nextTicketGoalPct = Number(data.ticketGoalPct);
        if (Number.isFinite(nextTicketGoalPct)) {
          setTicketGoalPct(nextTicketGoalPct);
        }
        setSaveStatus({ state: "idle", message: "" });
        setLoaded(true);
        return true;
      } catch {
        setSaveStatus({
          state: "error",
          message:
            "API local indisponivel. Inicie com 'npm run dev' (ou 'npm run dev:api').",
        });
        return false;
      }
    },
    [authToken, onUnauthorized, viewScope],
  );

  const restoreFromDatabaseWithRetry = useCallback(async () => {
    const requestId = restoreRequestIdRef.current + 1;
    restoreRequestIdRef.current = requestId;

    const maxAttempts = 20;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (requestId !== restoreRequestIdRef.current) {
        return false;
      }

      const ok = await loadFromDatabase({ requestId });

      if (requestId !== restoreRequestIdRef.current) {
        return false;
      }

      if (ok) {
        setIsRestoring(false);
        return true;
      }

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
    }

    if (requestId === restoreRequestIdRef.current) {
      setIsRestoring(false);
    }
    return false;
  }, [loadFromDatabase]);

  const retryLoadFromDatabase = useCallback(async () => {
    setIsRestoring(true);
    await restoreFromDatabaseWithRetry();
  }, [restoreFromDatabaseWithRetry]);

  const uploadToDatabase = useCallback(
    async (file, options = {}) => {
      const { onlyNew = false, statusSetter = setSaveStatus } = options;

      if (!canUpload) {
        statusSetter({
          state: "error",
          message: "Apenas usuários master podem atualizar o banco.",
        });
        return;
      }

      try {
        statusSetter({
          state: "saving",
          message: onlyNew
            ? "Adicionando somente linhas novas no SQLite..."
            : "Salvando no SQLite...",
        });
        const fd = new FormData();
        fd.append("file", file);
        if (onlyNew) {
          fd.append("onlyNew", "true");
        }

        const resp = await fetch(apiUrl("/api/import-dashboard"), {
          method: "POST",
          body: fd,
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (!resp.ok) {
          let msg = "Não foi possível salvar no banco.";
          try {
            const body = await resp.json();
            msg = body?.error || msg;
          } catch {
            // Ignore parse errors and keep generic message.
          }
          if (resp.status === 401 || resp.status === 403) {
            throw new Error("Apenas usuários master podem atualizar o banco.");
          }
          throw new Error(msg);
        }

        const data = await resp.json();
        const r = data?.result;
        await loadFromDatabase();
        statusSetter({
          state: "success",
          message: onlyNew
            ? `Atualizacao incremental concluida. Novas linhas: Cons ${r?.consRows ?? 0}, Atend ${r?.atendRows ?? 0}, Tickets ${r?.ticketRows ?? 0}. Ignoradas (ja existentes): Cons ${r?.skippedConsRows ?? 0}, Atend ${r?.skippedAtendRows ?? 0}, Tickets ${r?.skippedTicketRows ?? 0}. Tickets em aberto que vieram fechados tambem sao atualizados.`
            : `Dados salvos no SQLite. Cons: ${r?.consRows ?? 0}, Atend: ${r?.atendRows ?? 0}, Tickets: ${r?.ticketRows ?? 0}`,
        });
      } catch (error) {
        const isNetworkError =
          error instanceof TypeError && /fetch/i.test(error.message || "");
        statusSetter({
          state: "error",
          message: isNetworkError
            ? "API local indisponivel. Inicie com 'npm run dev' (ou 'npm run dev:api') para salvar no SQLite."
            : error instanceof Error
              ? error.message
              : "Falha ao salvar automaticamente no banco.",
        });
      }
    },
    [authToken, canUpload, loadFromDatabase],
  );

  const handleIncrementalFile = useCallback(
    (file) => {
      uploadToDatabase(file, {
        onlyNew: true,
        statusSetter: setIncrementalStatus,
      });
    },
    [uploadToDatabase],
  );

  const handleReprocessFile = useCallback(
    (file) => {
      uploadToDatabase(file, {
        onlyNew: false,
        statusSetter: setReprocessStatus,
      });
    },
    [uploadToDatabase],
  );

  const fCons = useMemo(
    () => filterByDateRange(cons, dateFrom, dateTo, dayTypeFilter),
    [cons, dateFrom, dateTo, dayTypeFilter],
  );
  const fAtend = useMemo(
    () => filterByDateRange(atend, dateFrom, dateTo, dayTypeFilter),
    [atend, dateFrom, dateTo, dayTypeFilter],
  );
  const fTickets = useMemo(
    () => filterByDateRange(tickets, dateFrom, dateTo, dayTypeFilter),
    [tickets, dateFrom, dateTo, dayTypeFilter],
  );

  // Cross-scope filtered data for attendant daily evolution cards.
  // When viewScope="own": fOwnCons=fCons, fTeamCons uses teamConsFetched from API.
  // When viewScope="team": fTeamCons=fCons, fOwnCons uses ownConsFetched from API.
  const fOwnCons = useMemo(
    () =>
      filterByDateRange(
        viewScope === "own" ? cons : ownConsFetched,
        dateFrom,
        dateTo,
        dayTypeFilter,
      ),
    [viewScope, cons, ownConsFetched, dateFrom, dateTo, dayTypeFilter],
  );
  const fTeamCons = useMemo(
    () =>
      filterByDateRange(
        viewScope === "team" ? cons : teamConsFetched,
        dateFrom,
        dateTo,
        dayTypeFilter,
      ),
    [viewScope, cons, teamConsFetched, dateFrom, dateTo, dayTypeFilter],
  );
  const fOwnAtend = useMemo(
    () =>
      filterByDateRange(
        viewScope === "own" ? atend : ownAtendFetched,
        dateFrom,
        dateTo,
        dayTypeFilter,
      ),
    [viewScope, atend, ownAtendFetched, dateFrom, dateTo, dayTypeFilter],
  );
  const fOwnTickets = useMemo(
    () =>
      filterByDateRange(
        viewScope === "own" ? tickets : ownTicketsFetched,
        dateFrom,
        dateTo,
        dayTypeFilter,
      ),
    [viewScope, tickets, ownTicketsFetched, dateFrom, dateTo, dayTypeFilter],
  );
  const fTeamTickets = useMemo(
    () =>
      filterByDateRange(
        viewScope === "team" ? tickets : teamTicketsFetched,
        dateFrom,
        dateTo,
        dayTypeFilter,
      ),
    [viewScope, tickets, teamTicketsFetched, dateFrom, dateTo, dayTypeFilter],
  );

  const kpis = useMemo(() => buildKpis(fCons, fTickets), [fCons, fTickets]);

  const dateRangeInvalid =
    dateFrom !== "" && dateTo !== "" && dateTo < dateFrom;

  const catData = useMemo(() => aggregateBy(fTickets, "categoria"), [fTickets]);
  const sevData = useMemo(
    () =>
      aggregateBy(fTickets, (t) =>
        t.severidade && t.severidade !== "-" ? t.severidade : null,
      ),
    [fTickets],
  );
  const natData = useMemo(() => aggregateBy(fTickets, "natureza"), [fTickets]);
  const qualData = useMemo(
    () =>
      aggregateBy(fTickets, (t) => {
        const q = t.qualificacao;
        return q && q !== "-" ? q : "(sem qualificação)";
      }),
    [fTickets],
  );
  const respData = useMemo(
    () =>
      aggregateBy(
        fTickets,
        (t) => t.responsavel?.split(" ").slice(0, 2).join(" ") || "N/I",
      ),
    [fTickets],
  );

  const equipe = useMemo(
    () => buildEquipeData(fAtend, fTickets),
    [fAtend, fTickets],
  );

  const dailyChart = useMemo(() => buildDailyChart(fCons), [fCons]);

  useEffect(() => {
    restoreFromDatabaseWithRetry();

    return () => {
      restoreRequestIdRef.current += 1;
    };
  }, [restoreFromDatabaseWithRetry]);

  return {
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
    teamTotals,
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
    setSaveStatus,
    handleIncrementalFile,
    handleReprocessFile,
    retryLoadFromDatabase,
  };
}
