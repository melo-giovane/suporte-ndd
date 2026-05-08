import { useCallback, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";
import {
  AlertCircle,
  ClipboardList,
  Receipt,
  Trophy,
  Users,
} from "lucide-react";
import { aggregateBy } from "../models/dashboardModel.js";
import { isErroApp, isTransferencia } from "../utils.js";

const Ico = ({ Icon, size = 14, stroke = 2.25 }) => (
  <Icon
    size={size}
    strokeWidth={stroke}
    style={{ display: "inline-block", verticalAlign: "-2px" }}
  />
);

export default function TicketsTab({
  P,
  PIE_C,
  KPI,
  ChartCard,
  Section,
  Table,
  TT,
  fmtPct,
  fTickets,
  isAttendant,
  isAttendantTeamTicketsScope,
  attendantNotLinked,
  authUser,
  ticketListFilterSel,
  setTicketListFilterSel,
  selectedTicket,
  setSelectedTicket,
  ticketListSectionRef,
}) {
  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketClientFilter, setTicketClientFilter] = useState("");
  const [ticketQualFilter, setTicketQualFilter] = useState("");
  const [ticketSeverityFilter, setTicketSeverityFilter] = useState("");

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

  const baseTicketsForTab = useMemo(() => {
    if (!isAttendant || isAttendantTeamTicketsScope) return filteredTicketsList;

    const responsibleName = (authUser?.attendantResponsavel || "")
      .trim()
      .toLowerCase();

    if (!responsibleName) return [];

    return filteredTicketsList.filter(
      (t) => (t.responsavel || "").trim().toLowerCase() === responsibleName,
    );
  }, [
    authUser?.attendantResponsavel,
    filteredTicketsList,
    isAttendant,
    isAttendantTeamTicketsScope,
  ]);

  const visibleTicketsList = useMemo(() => {
    let out = baseTicketsForTab;

    if (ticketClientFilter) {
      const target = ticketClientFilter.trim().toLowerCase();
      out = out.filter(
        (t) => String(t.cliente || "").trim().toLowerCase() === target,
      );
    }
    if (ticketQualFilter) {
      const target = ticketQualFilter.trim().toLowerCase();
      out = out.filter(
        (t) => String(t.qualificacao || "").trim().toLowerCase() === target,
      );
    }
    if (ticketSeverityFilter) {
      const target = ticketSeverityFilter.trim().toLowerCase();
      out = out.filter(
        (t) => String(t.severidade || "").trim().toLowerCase() === target,
      );
    }
    if (ticketSearch) {
      const target = ticketSearch.trim().toLowerCase();
      if (target) {
        out = out.filter((t) =>
          [t.chamado, t.titulo, t.cliente, t.descricao, t.responsavel].some(
            (v) => String(v || "").toLowerCase().includes(target),
          ),
        );
      }
    }
    return out;
  }, [
    baseTicketsForTab,
    ticketClientFilter,
    ticketQualFilter,
    ticketSeverityFilter,
    ticketSearch,
  ]);

  const clienteData = useMemo(
    () =>
      aggregateBy(visibleTicketsList, (t) => {
        const c = String(t.cliente || "").trim();
        return c || null;
      }),
    [visibleTicketsList],
  );
  const qualData = useMemo(
    () =>
      aggregateBy(visibleTicketsList, (t) => {
        const q = t.qualificacao;
        return q && q !== "-" ? q : "(sem qualificação)";
      }),
    [visibleTicketsList],
  );
  const sevData = useMemo(
    () =>
      aggregateBy(visibleTicketsList, (t) =>
        t.severidade && t.severidade !== "-" ? t.severidade : null,
      ),
    [visibleTicketsList],
  );
  const natData = useMemo(
    () => aggregateBy(visibleTicketsList, "natureza"),
    [visibleTicketsList],
  );
  const respData = useMemo(
    () =>
      aggregateBy(
        visibleTicketsList,
        (t) => t.responsavel?.split(" ").slice(0, 2).join(" ") || "N/I",
      ),
    [visibleTicketsList],
  );

  const top10Clientes = useMemo(() => clienteData.slice(0, 10), [clienteData]);
  const top10Quals = useMemo(() => qualData.slice(0, 10), [qualData]);
  const top12Quals = useMemo(() => qualData.slice(0, 12), [qualData]);

  const tabKpis = useMemo(() => {
    const total = visibleTicketsList.length;
    const abertos = visibleTicketsList.filter(
      (t) => t.status === "Aberto",
    ).length;
    const uniqueClients = new Set(
      visibleTicketsList
        .map((t) => String(t.cliente || "").trim())
        .filter(Boolean),
    );
    const top = clienteData[0] || null;
    return {
      total,
      abertos,
      uniqueClients: uniqueClients.size,
      topCliente: top,
    };
  }, [visibleTicketsList, clienteData]);

  const hasLocalTicketFilters =
    Boolean(ticketClientFilter) ||
    Boolean(ticketQualFilter) ||
    Boolean(ticketSeverityFilter) ||
    Boolean(ticketSearch.trim());

  const clearAllTicketFilters = useCallback(() => {
    setTicketClientFilter("");
    setTicketQualFilter("");
    setTicketSeverityFilter("");
    setTicketSearch("");
    setTicketListFilterSel("todos");
    setSelectedTicket(null);
  }, [setTicketListFilterSel, setSelectedTicket]);

  const handleClienteBarClick = useCallback(
    (data) => {
      if (!data?.name) return;
      setTicketClientFilter((prev) => (prev === data.name ? "" : data.name));
      setSelectedTicket(null);
    },
    [setSelectedTicket],
  );

  const handleQualBarClick = useCallback(
    (data) => {
      if (!data?.name) return;
      setTicketQualFilter((prev) => (prev === data.name ? "" : data.name));
      setSelectedTicket(null);
    },
    [setSelectedTicket],
  );

  const handleSeverityBarClick = useCallback(
    (data) => {
      if (!data?.name) return;
      setTicketSeverityFilter((prev) =>
        prev === data.name ? "" : data.name,
      );
      setSelectedTicket(null);
    },
    [setSelectedTicket],
  );

  const handleTopClienteCardClick = useCallback(() => {
    if (tabKpis.topCliente?.name) {
      setTicketClientFilter(tabKpis.topCliente.name);
      setSelectedTicket(null);
    }
  }, [tabKpis.topCliente, setSelectedTicket]);

  const ticketRows = useMemo(
    () =>
      visibleTicketsList.map((t) => [
        t.chamado || "-",
        (t.cliente || "-").slice(0, 32),
        (t.qualificacao && t.qualificacao !== "-"
          ? t.qualificacao
          : "—"
        ).slice(0, 28),
        t.status || "-",
        (t.responsavel || "-").split(" ").slice(0, 2).join(" "),
        t.severidade || "-",
        t.categoria || "-",
        t.dateReal instanceof Date
          ? t.dateReal.toLocaleDateString("pt-BR")
          : "-",
      ]),
    [visibleTicketsList],
  );

  const handleRowClick = useCallback(
    (idx) => setSelectedTicket(visibleTicketsList[idx]),
    [visibleTicketsList, setSelectedTicket],
  );

  const selectedRowIndex = selectedTicket
    ? visibleTicketsList.findIndex(
        (t) => t.chamado === selectedTicket.chamado,
      )
    : -1;

  return (
    <>
      <div
        style={{
          background: P.card,
          border: `1px solid ${P.bdr}`,
          borderRadius: 14,
          padding: 14,
          marginBottom: 16,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <input
            value={ticketSearch}
            onChange={(e) => setTicketSearch(e.target.value)}
            placeholder="Buscar por chamado, título, cliente, descrição ou responsável..."
            style={{
              flex: "1 1 320px",
              background: P.cardH,
              border: `1px solid ${P.bdr}`,
              borderRadius: 8,
              color: P.text,
              fontSize: 12.5,
              padding: "9px 12px",
              outline: "none",
              transition: "border-color .15s",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = P.accent;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = P.bdr;
            }}
          />
          {(hasLocalTicketFilters || ticketListFilterSel !== "todos") && (
            <button
              onClick={clearAllTicketFilters}
              style={{
                padding: "8px 14px",
                background: "transparent",
                border: `1px solid ${P.bdr}`,
                borderRadius: 8,
                color: P.dim,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                letterSpacing: 0.4,
                textTransform: "uppercase",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = P.text;
                e.currentTarget.style.borderColor = P.accent;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = P.dim;
                e.currentTarget.style.borderColor = P.bdr;
              }}
            >
              Limpar tudo
            </button>
          )}
        </div>
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
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
                padding: "5px 12px",
                border: `1px solid ${ticketListFilterSel === opt.key ? P.accent : P.bdr}`,
                borderRadius: 18,
                background:
                  ticketListFilterSel === opt.key
                    ? `${P.accent}22`
                    : "transparent",
                color: ticketListFilterSel === opt.key ? P.accent : P.dim,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {hasLocalTicketFilters && (
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: P.dim,
                letterSpacing: 1,
                textTransform: "uppercase",
                fontFamily:
                  "'JetBrains Mono','Fira Code',ui-monospace,monospace",
              }}
            >
              Filtros ativos:
            </span>
            {[
              {
                label: "Cliente",
                value: ticketClientFilter,
                clear: () => setTicketClientFilter(""),
              },
              {
                label: "Qualificação",
                value: ticketQualFilter,
                clear: () => setTicketQualFilter(""),
              },
              {
                label: "Severidade",
                value: ticketSeverityFilter,
                clear: () => setTicketSeverityFilter(""),
              },
              ticketSearch.trim()
                ? {
                    label: "Busca",
                    value: ticketSearch.trim(),
                    clear: () => setTicketSearch(""),
                  }
                : null,
            ]
              .filter((chip) => chip && chip.value)
              .map((chip) => (
                <button
                  key={chip.label}
                  onClick={chip.clear}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    border: `1px solid ${P.accent}`,
                    background: `${P.accent}1A`,
                    color: P.accent,
                    borderRadius: 14,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ opacity: 0.7 }}>{chip.label}:</span>
                  <span>{chip.value}</span>
                  <span style={{ marginLeft: 2, opacity: 0.7 }}>×</span>
                </button>
              ))}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <KPI
          icon={<Ico Icon={Receipt} />}
          label="Total filtrado"
          value={tabKpis.total}
          color={P.accent}
        />
        <KPI
          icon={<Ico Icon={AlertCircle} />}
          label="Abertos"
          value={tabKpis.abertos}
          color={tabKpis.abertos > 5 ? P.red : P.orange}
        />
        <KPI
          icon={<Ico Icon={Users} />}
          label="Clientes únicos"
          value={tabKpis.uniqueClients}
          color={P.purple}
        />
        <div
          onClick={handleTopClienteCardClick}
          style={{
            cursor: tabKpis.topCliente ? "pointer" : "default",
            flex: "1 1 200px",
            minWidth: 180,
            display: "flex",
          }}
        >
          <KPI
            icon={<Ico Icon={Trophy} />}
            label="Top cliente"
            value={tabKpis.topCliente ? tabKpis.topCliente.name : "—"}
            sub={
              tabKpis.topCliente
                ? `${tabKpis.topCliente.value} ticket${tabKpis.topCliente.value === 1 ? "" : "s"}`
                : "Sem dados"
            }
            color={P.pink}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <ChartCard
          title="Top Clientes (clique para filtrar)"
          h={300}
          allowExpand
        >
          <ResponsiveContainer>
            <BarChart
              data={top10Clientes}
              layout="vertical"
              barSize={18}
              margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={P.bdr}
                horizontal={false}
              />
              <XAxis type="number" tick={{ fill: P.dim, fontSize: 10 }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: P.dim, fontSize: 10 }}
                width={160}
              />
              <Tooltip content={<TT />} />
              <Bar
                dataKey="value"
                fill={P.accent}
                radius={[0, 4, 4, 0]}
                style={{ cursor: "pointer" }}
                isAnimationActive={false}
                onClick={handleClienteBarClick}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard
          title="Por Qualificação (clique para filtrar)"
          h={300}
          allowExpand
        >
          <ResponsiveContainer>
            <BarChart
              data={top10Quals}
              layout="vertical"
              barSize={18}
              margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={P.bdr}
                horizontal={false}
              />
              <XAxis type="number" tick={{ fill: P.dim, fontSize: 10 }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: P.dim, fontSize: 10 }}
                width={180}
              />
              <Tooltip content={<TT />} />
              <Bar
                dataKey="value"
                fill={P.purple}
                radius={[0, 4, 4, 0]}
                style={{ cursor: "pointer" }}
                isAnimationActive={false}
                onClick={handleQualBarClick}
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
        <ChartCard title="Por Categoria" h={220}>
          <ResponsiveContainer>
            <BarChart data={top12Quals} barSize={18}>
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
              <Bar
                dataKey="value"
                fill={P.accent}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              >
                {top12Quals.map((_, i) => (
                  <Cell key={i} fill={PIE_C[i % PIE_C.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Por Severidade (clique para filtrar)" h={220}>
          <ResponsiveContainer>
            <BarChart data={sevData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke={P.bdr} />
              <XAxis dataKey="name" tick={{ fill: P.dim, fontSize: 10 }} />
              <YAxis tick={{ fill: P.dim, fontSize: 10 }} />
              <Tooltip content={<TT />} />
              <Bar
                dataKey="value"
                fill={P.orange}
                radius={[4, 4, 0, 0]}
                style={{ cursor: "pointer" }}
                isAnimationActive={false}
                onClick={handleSeverityBarClick}
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
        <ChartCard title="Por Natureza" h={220}>
          <ResponsiveContainer>
            <BarChart data={natData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke={P.bdr} />
              <XAxis dataKey="name" tick={{ fill: P.dim, fontSize: 9 }} />
              <YAxis tick={{ fill: P.dim, fontSize: 10 }} />
              <Tooltip content={<TT />} />
              <Bar
                dataKey="value"
                fill={P.cyan}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        {!isAttendantTeamTicketsScope && (
          <ChartCard title="Por Responsável" h={220}>
            <ResponsiveContainer>
              <BarChart data={respData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke={P.bdr} />
                <XAxis dataKey="name" tick={{ fill: P.dim, fontSize: 9 }} />
                <YAxis tick={{ fill: P.dim, fontSize: 10 }} />
                <Tooltip content={<TT />} />
                <Bar
                  dataKey="value"
                  fill={P.pink}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      <Section
        title="Tabelas Detalhadas"
        icon={<Ico Icon={ClipboardList} />}
      >
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <Table
            headers={["Severidade", "Qtd", "%"]}
            rows={sevData.map((s) => [
              s.name,
              s.value,
              fmtPct(tabKpis.total ? s.value / tabKpis.total : 0),
            ])}
          />
          <Table
            headers={["Natureza", "Qtd", "%"]}
            rows={natData.map((n) => [
              n.name,
              n.value,
              fmtPct(tabKpis.total ? n.value / tabKpis.total : 0),
            ])}
          />
          <Table
            headers={["Qualificação", "Qtd", "%"]}
            rows={qualData.map((q) => [
              q.name,
              q.value,
              fmtPct(tabKpis.total ? q.value / tabKpis.total : 0),
            ])}
          />
        </div>
      </Section>

      <div ref={ticketListSectionRef}>
        <Section
          title={`Lista de Tickets · ${tabKpis.total} resultado${tabKpis.total === 1 ? "" : "s"}`}
          icon={<Ico Icon={Receipt} />}
        >
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
              Perfil sem atendente vinculado. Contate o administrador.
            </div>
          ) : visibleTicketsList.length === 0 ? (
            <div
              style={{
                padding: 18,
                textAlign: "center",
                color: P.dim,
                background: P.card,
                borderRadius: 12,
                border: `1px solid ${P.bdr}`,
              }}
            >
              Nenhum ticket para os filtros selecionados.
            </div>
          ) : (
            <Table
              headers={[
                "Chamado",
                "Cliente",
                "Qualificação",
                "Status",
                "Responsável",
                "Severidade",
                "Categoria",
                "Aberto em",
              ]}
              sortable
              getSortValue={(cell, ci) => {
                if (ci === 7 && typeof cell === "string") {
                  const m = cell.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                  if (m) {
                    return new Date(
                      Number(m[3]),
                      Number(m[2]) - 1,
                      Number(m[1]),
                    ).getTime();
                  }
                }
                return undefined;
              }}
              rows={ticketRows}
              onRowClick={handleRowClick}
              selectedRowIndex={selectedRowIndex}
            />
          )}
        </Section>
      </div>
    </>
  );
}
