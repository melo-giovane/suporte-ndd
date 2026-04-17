import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  aggregateBy,
  buildDailyChart,
  buildEquipeData,
  buildKpis,
  filterByDateRange,
  parseWorkbookData,
} from "../models/dashboardModel.js";

const API_BASE = import.meta.env.DEV ? "http://localhost:8787" : "";

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

let xlsxModulePromise;
function loadXlsxModule() {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import("xlsx");
  }
  return xlsxModulePromise;
}

export function useDashboardController({
  authToken,
  viewScope = "own",
  onUnauthorized,
} = {}) {
  const [cons, setCons] = useState([]);
  const [atend, setAtend] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("resumo");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [seriesVis, setSeriesVis] = useState({
    lig: true,
    transf: true,
    erros: true,
  });
  const [metricSel, setMetricSel] = useState("Total");
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
  const fileRef = useRef();
  const incrementalFileRef = useRef();
  const reprocessFileRef = useRef();

  const loadFromDatabase = useCallback(async () => {
    if (!authToken) {
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

      if (resp.status === 401 || resp.status === 403) {
        onUnauthorized?.();
        return false;
      }

      if (!resp.ok) return false;

      const body = await resp.json();
      const data = body?.data;
      if (!data) return false;

      const nextCons = (data.cons || []).map((row) => ({
        ...row,
        dateReal: row.dateReal ? new Date(row.dateReal) : null,
      }));
      const nextAtend = (data.atend || []).map((row) => ({
        ...row,
        dateReal: row.dateReal ? new Date(row.dateReal) : null,
      }));
      const nextTickets = (data.tickets || []).map((row) => ({
        ...row,
        dateReal: row.dataAbertura ? new Date(row.dataAbertura) : null,
      }));

      setCons(nextCons);
      setAtend(nextAtend);
      setTickets(nextTickets);
      setTeamTotals(data.teamTotals || null);
      setLoaded(true);
      return true;
    } catch {
      return false;
    }
  }, [authToken, onUnauthorized, viewScope]);

  const restoreFromDatabaseWithRetry = useCallback(async () => {
    const maxAttempts = 8;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const ok = await loadFromDatabase();
      if (ok) {
        setIsRestoring(false);
        return true;
      }

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
    }

    setIsRestoring(false);
    return false;
  }, [loadFromDatabase]);

  const retryLoadFromDatabase = useCallback(async () => {
    setIsRestoring(true);
    await restoreFromDatabaseWithRetry();
  }, [restoreFromDatabaseWithRetry]);

  const uploadToDatabase = useCallback(
    async (file, options = {}) => {
      const { onlyNew = false, statusSetter = setSaveStatus } = options;
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
            ? `Atualizacao incremental concluida. Novas linhas: Cons ${r?.consRows ?? 0}, Atend ${r?.atendRows ?? 0}, Tickets ${r?.ticketRows ?? 0}. Ignoradas (ja existentes): Cons ${r?.skippedConsRows ?? 0}, Atend ${r?.skippedAtendRows ?? 0}, Tickets ${r?.skippedTicketRows ?? 0}.`
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
    [authToken, loadFromDatabase],
  );

  const handleFile = useCallback(
    (file) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const XLSX = await loadXlsxModule();
          const workbook = XLSX.read(e.target.result, {
            type: "array",
            cellDates: true,
          });

          const parsed = parseWorkbookData(XLSX, workbook);
          setCons(parsed.cons);
          setAtend(parsed.atend);
          setTickets(parsed.tickets);
          setLoaded(true);
        } catch {
          setSaveStatus({
            state: "error",
            message: "Falha ao processar o arquivo no navegador.",
          });
        }
      };
      reader.readAsArrayBuffer(file);

      // Save to SQLite via local API in parallel with front-end parsing.
      uploadToDatabase(file);
    },
    [uploadToDatabase],
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
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
    () => filterByDateRange(cons, dateFrom, dateTo),
    [cons, dateFrom, dateTo],
  );
  const fAtend = useMemo(
    () => filterByDateRange(atend, dateFrom, dateTo),
    [atend, dateFrom, dateTo],
  );
  const fTickets = useMemo(
    () => filterByDateRange(tickets, dateFrom, dateTo),
    [tickets, dateFrom, dateTo],
  );

  const kpis = useMemo(() => buildKpis(fCons, fTickets), [fCons, fTickets]);

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
  }, [restoreFromDatabaseWithRetry]);

  return {
    cons,
    tickets,
    loaded,
    tab,
    dateFrom,
    dateTo,
    seriesVis,
    metricSel,
    saveStatus,
    isRestoring,
    incrementalStatus,
    reprocessStatus,
    teamTotals,
    fileRef,
    incrementalFileRef,
    reprocessFileRef,
    fCons,
    fAtend,
    fTickets,
    kpis,
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
    setSeriesVis,
    setMetricSel,
    setSaveStatus,
    handleFile,
    handleIncrementalFile,
    handleReprocessFile,
    handleDrop,
    retryLoadFromDatabase,
  };
}
