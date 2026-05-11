import { useEffect, useMemo, useState } from "react";
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
  ReferenceLine,
} from "recharts";
import { pickConsRowsForKpisByDay } from "../models/dashboardModel.js";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Hourglass,
  Package,
  Phone,
  Receipt,
  Target,
  Ticket,
  Timer,
  TrendingUp,
  Users,
} from "lucide-react";

const Ico = ({ Icon, size = 14, stroke = 2.25 }) => (
  <Icon
    size={size}
    strokeWidth={stroke}
    style={{ display: "inline-block", verticalAlign: "-2px" }}
  />
);

export default function ResumoTab({
  P,
  PIE_C,
  KPI,
  Section,
  ChartCard,
  TT,
  fmtSec,
  fmtPct,
  kpis,
  kpiSeries,
  metricSel,
  setMetricSel,
  dailyChart,
  fCons,
  fAtend,
  fTickets,
  catData,
  sevData,
  equipe,
  seriesVis,
  setSeriesVis,
  onTicketDrilldown,
  isAttendantOwnScope = false,
  isAttendant = false,
  attendantDisplayName = "Eu",
  fOwnCons = [],
  fTeamCons = [],
  fOwnAtend = [],
  fOwnTickets = [],
  fTeamTickets = [],
  attendantsCatalog = [],
  isMasterView = false,
  ticketGoalPct = 20,
}) {
  const series = kpiSeries || {};
  const defaultAgentSel = isAttendant
    ? isAttendantOwnScope
      ? "__SELF__"
      : "__ALL__"
    : "__ALL__";
  const [dailyAcionamentosAgentSel, setDailyAcionamentosAgentSel] =
    useState(defaultAgentSel);
  const [dailyTicketMetricSel, setDailyTicketMetricSel] = useState("__ALL__");
  const [dailyTicketAgentSel, setDailyTicketAgentSel] =
    useState(defaultAgentSel);

  useEffect(() => {
    const next = isAttendant
      ? isAttendantOwnScope
        ? "__SELF__"
        : "__ALL__"
      : "__ALL__";
    setDailyAcionamentosAgentSel(next);
    setDailyTicketAgentSel(next);
  }, [isAttendant, isAttendantOwnScope]);

  const acionamentosAtendenteOptions = useMemo(
    () =>
      attendantsCatalog
        .map((attendant) => {
          const label =
            attendant.name || attendant.ticketsAlias || attendant.atplusAlias;
          const value = attendant.name || attendant.ticketsAlias || attendant.atplusAlias;
          return {
            value,
            label,
            atplusAlias: attendant.atplusAlias || null,
            ticketsAlias: attendant.ticketsAlias || null,
          };
        })
        .filter((attendant) => Boolean(attendant.value))
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
    [attendantsCatalog],
  );

  const acionamentosAtendenteValues = useMemo(
    () => acionamentosAtendenteOptions.map((a) => a.value),
    [acionamentosAtendenteOptions],
  );

  const atendenteOptions = useMemo(
    () =>
      attendantsCatalog
        .map((attendant) => ({
          value: attendant.ticketsAlias || attendant.name,
          label:
            attendant.name || attendant.ticketsAlias || attendant.atplusAlias,
        }))
        .filter((attendant) => Boolean(attendant.value))
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
    [attendantsCatalog],
  );

  const atendenteOptionValues = useMemo(
    () => atendenteOptions.map((attendant) => attendant.value),
    [atendenteOptions],
  );

  useEffect(() => {
    if (
      !isAttendant &&
      dailyAcionamentosAgentSel !== "__ALL__" &&
      !acionamentosAtendenteValues.includes(dailyAcionamentosAgentSel)
    ) {
      setDailyAcionamentosAgentSel("__ALL__");
    }
  }, [acionamentosAtendenteValues, dailyAcionamentosAgentSel, isAttendant]);

  useEffect(() => {
    if (
      !isAttendant &&
      dailyTicketAgentSel !== "__ALL__" &&
      !atendenteOptionValues.includes(dailyTicketAgentSel)
    ) {
      setDailyTicketAgentSel("__ALL__");
    }
  }, [atendenteOptionValues, dailyTicketAgentSel, isAttendant]);

  const ticketSourceForTypeCard = useMemo(() => {
    if (isAttendant) {
      return dailyTicketAgentSel === "__SELF__" ? fOwnTickets : fTeamTickets;
    }
    return dailyTicketAgentSel === "__ALL__"
      ? fTickets
      : fTickets.filter((t) => t.responsavel === dailyTicketAgentSel);
  }, [isAttendant, dailyTicketAgentSel, fOwnTickets, fTeamTickets, fTickets]);

  const qualificacaoOptions = useMemo(() => {
    const set = new Set();
    ticketSourceForTypeCard.forEach((t) => {
      const q = String(t.qualificacao || "").trim();
      if (q && q !== "-") set.add(q);
    });
    return [
      { value: "__ALL__", label: "Todos os tipos" },
      ...Array.from(set)
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
        .map((q) => ({ value: q, label: q })),
    ];
  }, [ticketSourceForTypeCard]);

  useEffect(() => {
    if (
      dailyTicketMetricSel !== "__ALL__" &&
      !qualificacaoOptions.some((o) => o.value === dailyTicketMetricSel)
    ) {
      setDailyTicketMetricSel("__ALL__");
    }
  }, [qualificacaoOptions, dailyTicketMetricSel]);

  const dailyTicketEvolution = useMemo(() => {
    const byDay = new Map();

    ticketSourceForTypeCard.forEach((ticket) => {
      const d = ticket.dateReal;
      if (!d || Number.isNaN(d.getTime())) return;

      const y = d.getFullYear();
      const mo = `${d.getMonth() + 1}`.padStart(2, "0");
      const day = `${d.getDate()}`.padStart(2, "0");
      const key = `${y}-${mo}-${day}`;

      if (!byDay.has(key)) {
        byDay.set(key, { dia: `${day}/${mo}`, total: 0 });
      }

      const acc = byDay.get(key);
      acc.total += 1;
      const q = String(ticket.qualificacao || "").trim();
      if (q && q !== "-") {
        acc[q] = (acc[q] || 0) + 1;
      }
    });

    return Array.from(byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, value]) => value);
  }, [ticketSourceForTypeCard]);

  const dailyChamadosEvolution = useMemo(() => {
    const selected =
      dailyAcionamentosAgentSel !== "__ALL__" &&
      dailyAcionamentosAgentSel !== "__SELF__"
        ? acionamentosAtendenteOptions.find(
            (o) => o.value === dailyAcionamentosAgentSel,
          )
        : null;
    const atplusAlias = selected?.atplusAlias || null;
    const ticketsAlias = selected?.ticketsAlias || null;

    let callsSource;
    if (isAttendant) {
      callsSource =
        dailyAcionamentosAgentSel === "__SELF__" ? fOwnCons : fTeamCons;
    } else if (dailyAcionamentosAgentSel === "__ALL__") {
      callsSource = fCons;
    } else if (atplusAlias) {
      callsSource = fAtend.filter((a) => a.ramal === atplusAlias);
    } else {
      callsSource = [];
    }

    let ticketSource;
    if (isAttendant) {
      ticketSource =
        dailyAcionamentosAgentSel === "__SELF__" ? fOwnTickets : fTeamTickets;
    } else if (dailyAcionamentosAgentSel === "__ALL__") {
      ticketSource = fTickets;
    } else if (ticketsAlias) {
      ticketSource = fTickets.filter((t) => t.responsavel === ticketsAlias);
    } else {
      ticketSource = [];
    }

    const byDia = new Map();
    const order = [];
    const ensureDay = (key, dia) => {
      if (!byDia.has(key)) {
        byDia.set(key, { dia, Acionamentos: 0, Atendidas: 0, Tickets: 0 });
        order.push(key);
      }
      return byDia.get(key);
    };

    pickConsRowsForKpisByDay(callsSource).forEach((c) => {
      const d = c.dateReal;
      if (!d || Number.isNaN(d.getTime())) return;
      const y = d.getFullYear();
      const mo = `${d.getMonth() + 1}`.padStart(2, "0");
      const day = `${d.getDate()}`.padStart(2, "0");
      const key = `${y}-${mo}-${day}`;
      const acc = ensureDay(key, `${day}/${mo}`);
      const atend = Number(c.atendidas || 0);
      acc.Atendidas += atend;
      acc.Acionamentos += atend;
    });

    ticketSource.forEach((ticket) => {
      const d = ticket.dateReal;
      if (!d || Number.isNaN(d.getTime())) return;
      const y = d.getFullYear();
      const mo = `${d.getMonth() + 1}`.padStart(2, "0");
      const day = `${d.getDate()}`.padStart(2, "0");
      const key = `${y}-${mo}-${day}`;
      const acc = ensureDay(key, `${day}/${mo}`);
      acc.Tickets += 1;
      acc.Acionamentos += 1;
    });

    if (order.length === 0) return dailyChart ?? [];

    return order
      .slice()
      .sort((a, b) => a.localeCompare(b))
      .map((k) => byDia.get(k));
  }, [
    isAttendant,
    dailyAcionamentosAgentSel,
    acionamentosAtendenteOptions,
    fOwnCons,
    fTeamCons,
    fAtend,
    fCons,
    fOwnTickets,
    fTeamTickets,
    fTickets,
    dailyChart,
  ]);

  const METRICS = [
    {
      key: "Atendidas",
      label: "Atendidas",
      color: P.green,
      pct: false,
    },
    {
      key: "Tx Atend",
      label: "Tx Atend.",
      color: P.cyan,
      pct: true,
    },
    { key: "TMA", label: "TMA (seg)", color: P.orange, pct: false },
    { key: "TME", label: "TME (seg)", color: P.purple, pct: false },
  ];
  const m = METRICS.find((x) => x.key === metricSel) || METRICS[0];

  const ticketLineDataKey =
    dailyTicketMetricSel === "__ALL__" ? "total" : dailyTicketMetricSel;
  const ticketLineLabel =
    dailyTicketMetricSel === "__ALL__"
      ? "Todos os tipos"
      : dailyTicketMetricSel;

  const computeStats = (values) => {
    const valid = values.filter((v) => Number.isFinite(v));
    if (valid.length === 0) return null;
    const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
    const variance =
      valid.reduce((a, b) => a + (b - mean) ** 2, 0) / valid.length;
    const sd = Math.sqrt(variance);
    return { mean, upper: mean + sd, lower: mean - sd };
  };

  const acionamentosStats = useMemo(
    () =>
      computeStats(
        dailyChamadosEvolution.map((d) => Number(d?.Acionamentos || 0)),
      ),
    [dailyChamadosEvolution],
  );

  const ticketStats = useMemo(
    () =>
      computeStats(
        dailyTicketEvolution.map((d) => Number(d?.[ticketLineDataKey] || 0)),
      ),
    [dailyTicketEvolution, ticketLineDataKey],
  );

  const ticketGoalRatio = Number(ticketGoalPct) / 100;
  const ticketRegistrationRatio = Number(kpis.txRegistros) || 0;
  const isTicketGoalReached =
    Number.isFinite(ticketGoalRatio) &&
    ticketRegistrationRatio >= ticketGoalRatio;
  const showRegistrationCards = isAttendantOwnScope;
  const showAbandonmentCards = !isAttendantOwnScope;

  return (
    <>
      <Section title="Telefonia" icon={<Ico Icon={Phone} />}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <KPI
            icon={<Ico Icon={Phone} />}
            label="Chamadas Atendidas"
            value={kpis.ta}
            sub={`${kpis.tc} total · ${fmtPct(kpis.tc ? kpis.ta / kpis.tc : 0)} de atendimento`}
            color={P.green}
            series={series.ta}
            hero
          />
          {showRegistrationCards && (
            <>
              <KPI
                icon={<Ico Icon={Receipt} />}
                label="Registros / Ligações Atendidas"
                value={fmtPct(ticketRegistrationRatio)}
                sub={`${kpis.tkt} tickets de ${kpis.ta} ligações atendidas`}
                color={P.purple}
                series={series.txRegistros}
              />
              <KPI
                icon={<Ico Icon={Target} />}
                label="Objetivo de Registros"
                value={fmtPct(
                  Number.isFinite(ticketGoalRatio) ? ticketGoalRatio : 0,
                )}
                sub={
                  isTicketGoalReached
                    ? "Objetivo atingido"
                    : `Atual ${fmtPct(ticketRegistrationRatio)}`
                }
                color={isTicketGoalReached ? P.green : P.orange}
              />
            </>
          )}
          {showAbandonmentCards && (
            <>
              <KPI
                icon={<Ico Icon={AlertTriangle} />}
                label="Tx Aband+Não At."
                value={fmtPct(kpis.txAband)}
                color={P.orange}
                series={series.txAband}
              />
              <KPI
                icon={<Ico Icon={AlertTriangle} />}
                label="Aband+Não At."
                value={kpis.tab}
                color={P.orange}
                series={series.tab}
              />
            </>
          )}
          <KPI
            icon={<Ico Icon={Timer} />}
            label="TMA Médio"
            value={fmtSec(kpis.tma)}
            color={P.orange}
            series={series.tma}
          />
          <KPI
            icon={<Ico Icon={Hourglass} />}
            label="TME Médio"
            value={fmtSec(kpis.tme)}
            color={P.cyan}
            series={series.tme}
          />
        </div>
      </Section>

      <Section title="Acionamentos (ligações + tickets)" icon={<Ico Icon={Ticket} />}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div
            onClick={() => onTicketDrilldown?.("chamados")}
            style={{
              cursor: "pointer",
              flex: "2 1 320px",
              minWidth: 280,
              display: "flex",
            }}
          >
            <KPI
              icon={<Ico Icon={Package} />}
              label="Acionamentos"
              value={kpis.chamados}
              sub={`${kpis.ta} ligações atendidas + ${kpis.tkt} tickets`}
              color={P.purple}
              series={series.chamados}
              hero
            />
          </div>
          <div
            onClick={() => onTicketDrilldown?.("todos")}
            style={{ cursor: "pointer", flex: "1 1 150px", minWidth: 140 }}
          >
            <KPI
              icon={<Ico Icon={Ticket} />}
              label="Total"
              value={kpis.tkt}
              color={P.purple}
              series={series.tkt}
            />
          </div>
          <div
            onClick={() => onTicketDrilldown?.("fechados")}
            style={{ cursor: "pointer", flex: "1 1 150px", minWidth: 140 }}
          >
            <KPI
              icon={<Ico Icon={CheckCircle2} />}
              label="Fechados"
              value={kpis.tktF}
              color={P.green}
              series={series.tktF}
            />
          </div>
          <div
            onClick={() => onTicketDrilldown?.("abertos")}
            style={{ cursor: "pointer", flex: "1 1 150px", minWidth: 140 }}
          >
            <KPI
              icon={<Ico Icon={AlertCircle} />}
              label="Abertos"
              value={kpis.tktA}
              color={kpis.tktA > 5 ? P.red : P.orange}
              series={series.tktA}
            />
          </div>
          <KPI
            icon={<Ico Icon={Calendar} />}
            label="Dias"
            value={kpis.dias}
            color={P.accent}
          />
          <KPI
            icon={<Ico Icon={TrendingUp} />}
            label="Méd Chamadas/Dia"
            value={kpis.dias ? (kpis.tc / kpis.dias).toFixed(1) : "0"}
            color={P.cyan}
          />
        </div>
      </Section>

      <div
        style={{
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
          marginTop: 18,
        }}
      >
        <div
          style={{
            background: P.card,
            borderRadius: 14,
            border: `1px solid ${P.bdr}`,
            padding: "14px 14px 10px",
            flex: "1 1 420px",
            minWidth: 320,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 12,
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
              Evolução Diária · Acionamentos (ligações + tickets)
            </span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <select
                value={dailyAcionamentosAgentSel}
                onChange={(e) => setDailyAcionamentosAgentSel(e.target.value)}
                style={{
                  background: P.cardH,
                  border: `1px solid ${P.bdr}`,
                  borderRadius: 8,
                  color: P.text,
                  padding: "4px 8px",
                  fontSize: 10,
                  minWidth: 150,
                }}
              >
                {isAttendant ? (
                  <>
                    <option value="__SELF__">{attendantDisplayName}</option>
                    <option value="__ALL__">Totais da equipe</option>
                  </>
                ) : (
                  <>
                    <option value="__ALL__">Equipe toda</option>
                    {acionamentosAtendenteOptions.map((attendant) => (
                      <option key={attendant.value} value={attendant.value}>
                        {attendant.label.replace(" - Central", "")}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>
          <p
            style={{
              fontSize: 11,
              color: P.muted,
              margin: "0 0 10px",
              lineHeight: 1.45,
            }}
          >
            Volume diário de acionamentos (ligações atendidas + tickets) no
            período filtrado. Use o seletor para isolar um atendente.
          </p>
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={dailyChamadosEvolution}>
                <CartesianGrid strokeDasharray="3 3" stroke={P.bdr} />
                <XAxis
                  dataKey="dia"
                  tick={{ fill: P.dim, fontSize: 9 }}
                  interval={Math.max(
                    0,
                    Math.floor(dailyChamadosEvolution.length / 12),
                  )}
                />
                <YAxis tick={{ fill: P.dim, fontSize: 10 }} />
                <Tooltip content={<TT />} />
                <Line
                  type="monotone"
                  dataKey="Acionamentos"
                  stroke={P.purple}
                  strokeWidth={2}
                  dot={{ r: 2, fill: P.purple }}
                  activeDot={{ r: 4 }}
                />
                {acionamentosStats && (
                  <>
                    <ReferenceLine
                      y={acionamentosStats.mean}
                      stroke={P.cyan}
                      strokeDasharray="4 4"
                      ifOverflow="extendDomain"
                      label={{
                        value: `Média ${acionamentosStats.mean.toFixed(1)}`,
                        fill: P.cyan,
                        fontSize: 9,
                        position: "insideTopRight",
                      }}
                    />
                    <ReferenceLine
                      y={acionamentosStats.upper}
                      stroke={P.dim}
                      strokeDasharray="2 4"
                      ifOverflow="extendDomain"
                      label={{
                        value: `+1σ ${acionamentosStats.upper.toFixed(1)}`,
                        fill: P.dim,
                        fontSize: 9,
                        position: "insideTopRight",
                      }}
                    />
                    <ReferenceLine
                      y={acionamentosStats.lower}
                      stroke={P.dim}
                      strokeDasharray="2 4"
                      ifOverflow="extendDomain"
                      label={{
                        value: `-1σ ${acionamentosStats.lower.toFixed(1)}`,
                        fill: P.dim,
                        fontSize: 9,
                        position: "insideBottomRight",
                      }}
                    />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div
          style={{
            background: P.card,
            borderRadius: 14,
            border: `1px solid ${P.bdr}`,
            padding: "14px 14px 10px",
            flex: "1 1 420px",
            minWidth: 320,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 12,
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
              Evolução Diária · Tickets por Tipo
            </span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {isAttendant ? (
                <select
                  value={dailyTicketAgentSel}
                  onChange={(e) => setDailyTicketAgentSel(e.target.value)}
                  style={{
                    background: P.cardH,
                    border: `1px solid ${P.bdr}`,
                    borderRadius: 8,
                    color: P.text,
                    padding: "4px 8px",
                    fontSize: 10,
                    minWidth: 150,
                  }}
                >
                  <option value="__SELF__">{attendantDisplayName}</option>
                  <option value="__ALL__">Totais da equipe</option>
                </select>
              ) : (
                <select
                  value={dailyTicketAgentSel}
                  onChange={(e) => setDailyTicketAgentSel(e.target.value)}
                  style={{
                    background: P.cardH,
                    border: `1px solid ${P.bdr}`,
                    borderRadius: 8,
                    color: P.text,
                    padding: "4px 8px",
                    fontSize: 10,
                    minWidth: 150,
                  }}
                >
                  <option value="__ALL__">Equipe toda</option>
                  {atendenteOptions.map((attendant) => (
                    <option key={attendant.value} value={attendant.value}>
                      {attendant.label}
                    </option>
                  ))}
                </select>
              )}
              <select
                value={dailyTicketMetricSel}
                onChange={(e) => setDailyTicketMetricSel(e.target.value)}
                style={{
                  background: P.cardH,
                  border: `1px solid ${P.bdr}`,
                  borderRadius: 8,
                  color: P.text,
                  padding: "4px 8px",
                  fontSize: 10,
                  minWidth: 180,
                }}
              >
                {qualificacaoOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p
            style={{
              fontSize: 11,
              color: P.muted,
              margin: "0 0 10px",
              lineHeight: 1.45,
            }}
          >
            Tickets abertos por dia. Use o combo de tipo para filtrar por uma
            qualificação específica ou ver o total geral.
          </p>
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={dailyTicketEvolution}>
                <CartesianGrid strokeDasharray="3 3" stroke={P.bdr} />
                <XAxis
                  dataKey="dia"
                  tick={{ fill: P.dim, fontSize: 9 }}
                  interval={Math.max(
                    0,
                    Math.floor(dailyTicketEvolution.length / 12),
                  )}
                />
                <YAxis tick={{ fill: P.dim, fontSize: 10 }} />
                <Tooltip content={<TT />} />
                <Line
                  type="monotone"
                  dataKey={ticketLineDataKey}
                  name={ticketLineLabel}
                  stroke={P.purple}
                  strokeWidth={2}
                  dot={{ r: 2, fill: P.purple }}
                  activeDot={{ r: 4 }}
                />
                {ticketStats && (
                  <>
                    <ReferenceLine
                      y={ticketStats.mean}
                      stroke={P.cyan}
                      strokeDasharray="4 4"
                      ifOverflow="extendDomain"
                      label={{
                        value: `Média ${ticketStats.mean.toFixed(1)}`,
                        fill: P.cyan,
                        fontSize: 9,
                        position: "insideTopRight",
                      }}
                    />
                    <ReferenceLine
                      y={ticketStats.upper}
                      stroke={P.dim}
                      strokeDasharray="2 4"
                      ifOverflow="extendDomain"
                      label={{
                        value: `+1σ ${ticketStats.upper.toFixed(1)}`,
                        fill: P.dim,
                        fontSize: 9,
                        position: "insideTopRight",
                      }}
                    />
                    <ReferenceLine
                      y={ticketStats.lower}
                      stroke={P.dim}
                      strokeDasharray="2 4"
                      ifOverflow="extendDomain"
                      label={{
                        value: `-1σ ${ticketStats.lower.toFixed(1)}`,
                        fill: P.dim,
                        fontSize: 9,
                        position: "insideBottomRight",
                      }}
                    />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
          marginTop: 14,
        }}
      >
        <ChartCard title="Tickets por Categoria" allowExpand>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={catData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius="80%"
                innerRadius="40%"
                paddingAngle={1}
                label={({ name, value }) => `${name}: ${value}`}
                style={{ fontSize: 9 }}
              >
                {catData.map((_, i) => (
                  <Cell key={i} fill={PIE_C[i % PIE_C.length]} />
                ))}
              </Pie>
              <Tooltip content={<TT />} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Tickets por Nível">
          <ResponsiveContainer>
            <BarChart data={sevData} layout="vertical" barSize={22}>
              <CartesianGrid strokeDasharray="3 3" stroke={P.bdr} />
              <XAxis type="number" tick={{ fill: P.dim, fontSize: 10 }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: P.dim, fontSize: 10 }}
                width={65}
              />
              <Tooltip content={<TT />} />
              <Bar dataKey="value" fill={P.purple} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Section title="Visão por Atendente" icon={<Ico Icon={Users} />}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <ChartCard title="Produtividade: Chamadas + Tickets" h={260}>
            <ResponsiveContainer>
              <BarChart data={equipe} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke={P.bdr} />
                <XAxis dataKey="nome" tick={{ fill: P.dim, fontSize: 10 }} />
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
                <XAxis dataKey="nome" tick={{ fill: P.dim, fontSize: 10 }} />
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
                      background: seriesVis[key] ? color + "22" : "transparent",
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
                  <XAxis dataKey="nome" tick={{ fill: P.dim, fontSize: 10 }} />
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
      </Section>

      <Section title="Alertas" icon={<Ico Icon={AlertTriangle} />}>
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
                🔴 <b>{e.nome}</b> — <b>{e.tktAbertos}</b> tickets em aberto
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
                ⏱ <b>{e.nome}</b> — TMA de <b>{fmtSec(e.tma)}</b> (acima de
                5min)
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
  );
}
