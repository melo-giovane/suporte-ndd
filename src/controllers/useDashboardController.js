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
  attendantsCatalog = [],
} = {}) {
  const [cons, setCons] = useState([]);
  const [atend, setAtend] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [chamados, setChamados] = useState([]);
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
  // Dedicated own/team datasets — always populated regardless of viewScope.
  const [allOwnCons, setAllOwnCons] = useState([]);
  const [allOwnAtend, setAllOwnAtend] = useState([]);
  const [allOwnTickets, setAllOwnTickets] = useState([]);
  const [allOwnChamados, setAllOwnChamados] = useState([]);
  const [allTeamCons, setAllTeamCons] = useState([]);
  const [allTeamAtend, setAllTeamAtend] = useState([]);
  const [allTeamTickets, setAllTeamTickets] = useState([]);
  const [allTeamChamados, setAllTeamChamados] = useState([]);
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
        const nextChamados = (data.chamados || []).map((row) => ({
          ...row,
          dateReal: parseApiDate(row.dateReal),
        }));

        setCons(nextCons);
        setAtend(nextAtend);
        setTickets(nextTickets);
        setChamados(nextChamados);
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
        const parseChamadoList = (list) =>
          (list || []).map((row) => ({
            ...row,
            dateReal: parseApiDate(row.dateReal),
          }));

        setAllOwnCons(parseConsList(data.ownCons));
        setAllOwnAtend(parseConsList(data.ownAtend));
        setAllOwnTickets(parseTicketList(data.ownTickets));
        setAllOwnChamados(parseChamadoList(data.ownChamados));
        setAllTeamCons(parseConsList(data.teamCons));
        setAllTeamAtend(parseConsList(data.teamAtend));
        setAllTeamTickets(parseTicketList(data.teamTickets));
        setAllTeamChamados(parseChamadoList(data.teamChamados));
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

  const fChamados = useMemo(
    () => filterByDateRange(chamados, dateFrom, dateTo, dayTypeFilter),
    [chamados, dateFrom, dateTo, dayTypeFilter],
  );

  // Dedicated own/team filtered data — always populated regardless of viewScope.
  const fOwnCons = useMemo(
    () => filterByDateRange(allOwnCons, dateFrom, dateTo, dayTypeFilter),
    [allOwnCons, dateFrom, dateTo, dayTypeFilter],
  );
  const fTeamCons = useMemo(
    () => filterByDateRange(allTeamCons, dateFrom, dateTo, dayTypeFilter),
    [allTeamCons, dateFrom, dateTo, dayTypeFilter],
  );
  const fOwnAtend = useMemo(
    () => filterByDateRange(allOwnAtend, dateFrom, dateTo, dayTypeFilter),
    [allOwnAtend, dateFrom, dateTo, dayTypeFilter],
  );
  const fTeamAtend = useMemo(
    () => filterByDateRange(allTeamAtend, dateFrom, dateTo, dayTypeFilter),
    [allTeamAtend, dateFrom, dateTo, dayTypeFilter],
  );
  const fOwnTickets = useMemo(
    () => filterByDateRange(allOwnTickets, dateFrom, dateTo, dayTypeFilter),
    [allOwnTickets, dateFrom, dateTo, dayTypeFilter],
  );
  const fOwnChamados = useMemo(
    () => filterByDateRange(allOwnChamados, dateFrom, dateTo, dayTypeFilter),
    [allOwnChamados, dateFrom, dateTo, dayTypeFilter],
  );
  const fTeamTickets = useMemo(
    () => filterByDateRange(allTeamTickets, dateFrom, dateTo, dayTypeFilter),
    [allTeamTickets, dateFrom, dateTo, dayTypeFilter],
  );
  const fTeamChamados = useMemo(
    () => filterByDateRange(allTeamChamados, dateFrom, dateTo, dayTypeFilter),
    [allTeamChamados, dateFrom, dateTo, dayTypeFilter],
  );

  const kpis = useMemo(() => buildKpis(fCons, fTickets), [fCons, fTickets]);

  const dateRangeInvalid =
    dateFrom !== "" && dateTo !== "" && dateTo < dateFrom;

  const catData = useMemo(
    () =>
      aggregateBy(fTickets, (t) => {
        const q = t.qualificacao;
        return q && q !== "-" ? q : "(sem qualificação)";
      }),
    [fTickets],
  );
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

  const equipe = useMemo(() => {
    // viewScope="own" only happens for attendants in "Meus" mode.
    // Show only entries with data (only the own attendant's row will be non-zero).
    if (viewScope === "own") {
      return buildEquipeData(fOwnAtend, fOwnTickets, attendantsCatalog).filter(
        (e) => e.total > 0,
      );
    }
    // viewScope="team" with fTeamAtend available → attendant in "Totais da equipe"
    // or master. Use full team data so the equipe chart shows all members.
    if (fTeamAtend.length > 0) {
      return buildEquipeData(fTeamAtend, fTeamTickets, attendantsCatalog);
    }
    // Fallback (master without dedicated teamAtend): use primary fAtend/fTickets.
    return buildEquipeData(fAtend, fTickets, attendantsCatalog);
  }, [
    viewScope,
    fAtend,
    fOwnAtend,
    fTeamAtend,
    fTickets,
    fOwnTickets,
    fTeamTickets,
    attendantsCatalog,
  ]);

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
    chamados,
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
    fChamados,
    fOwnCons,
    fTeamCons,
    fOwnAtend,
    fTeamAtend,
    fOwnTickets,
    fOwnChamados,
    fTeamTickets,
    fTeamChamados,
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
