import { useMemo, useState } from "react";
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
} from "recharts";
import { isTransferencia, isErroApp } from "../utils.js";

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
  isMasterView = false,
  ticketGoalPct = 20,
}) {
  const [dailyCallsAgentSel, setDailyCallsAgentSel] = useState("__ALL__");
  const [dailyTicketMetricSel, setDailyTicketMetricSel] =
    useState("transferencias");
  const [dailyTicketAgentSel, setDailyTicketAgentSel] = useState("__ALL__");

  const callsAtendenteOptions = useMemo(
    () =>
      Array.from(new Set(fAtend.map((a) => a.ramal).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, "pt-BR"),
      ),
    [fAtend],
  );

  const dailyCallsEvolution = useMemo(() => {
    if (dailyCallsAgentSel === "__ALL__") {
      const byDay = new Map();

      fCons.forEach((c) => {
        const d = c.dateReal;
        if (!d || Number.isNaN(d.getTime())) return;

        const y = d.getFullYear();
        const m = `${d.getMonth() + 1}`.padStart(2, "0");
        const day = `${d.getDate()}`.padStart(2, "0");
        const key = `${y}-${m}-${day}`;

        if (!byDay.has(key)) {
          byDay.set(key, {
            dia: `${day}/${m}`,
            Total: 0,
            Atendidas: 0,
            TMA: 0,
            TME: 0,
            _rows: 0,
          });
        }

        const acc = byDay.get(key);
        acc.Total += c.total || 0;
        acc.Atendidas += c.atendidas || 0;
        acc.TMA += c.tma || 0;
        acc.TME += c.tme || 0;
        acc._rows += 1;
      });

      const consolidated = Array.from(byDay.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, value]) => ({
          dia: value.dia,
          Total: value.Total,
          Atendidas: value.Atendidas,
          TMA: value._rows ? Math.round(value.TMA / value._rows) : 0,
          TME: value._rows ? Math.round(value.TME / value._rows) : 0,
          "Tx Atend": value.Total ? value.Atendidas / value.Total : 0,
        }));

      return consolidated.length > 0 ? consolidated : dailyChart;
    }

    const byDay = new Map();
    fAtend.forEach((a) => {
      if (a.ramal !== dailyCallsAgentSel) return;
      const d = a.dateReal;
      if (!d || Number.isNaN(d.getTime())) return;

      const y = d.getFullYear();
      const m = `${d.getMonth() + 1}`.padStart(2, "0");
      const day = `${d.getDate()}`.padStart(2, "0");
      const key = `${y}-${m}-${day}`;

      if (!byDay.has(key)) {
        byDay.set(key, {
          dia: `${day}/${m}`,
          Total: 0,
          Atendidas: 0,
          TMA: 0,
          TME: 0,
          _rows: 0,
        });
      }

      const acc = byDay.get(key);
      acc.Total += a.tentativas || 0;
      acc.Atendidas += a.atendidas || 0;
      acc.TMA += a.tma || 0;
      acc.TME += a.tme || 0;
      acc._rows += 1;
    });

    return Array.from(byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, value]) => ({
        dia: value.dia,
        Total: value.Total,
        Atendidas: value.Atendidas,
        TMA: value._rows ? Math.round(value.TMA / value._rows) : 0,
        TME: value._rows ? Math.round(value.TME / value._rows) : 0,
        "Tx Atend": value.Total ? value.Atendidas / value.Total : 0,
      }));
  }, [dailyCallsAgentSel, dailyChart, fAtend, fCons]);

  const atendenteOptions = useMemo(
    () =>
      Array.from(
        new Set(
          fTickets.map((t) =>
            t.responsavel && t.responsavel !== "-"
              ? t.responsavel
              : "(Sem responsável)",
          ),
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [fTickets],
  );

  const dailyTicketEvolution = useMemo(() => {
    const byDay = new Map();

    fTickets.forEach((ticket) => {
      const responsavel =
        ticket.responsavel && ticket.responsavel !== "-"
          ? ticket.responsavel
          : "(Sem responsável)";
      if (
        dailyTicketAgentSel !== "__ALL__" &&
        responsavel !== dailyTicketAgentSel
      )
        return;

      const d = ticket.dateReal;
      if (!d || Number.isNaN(d.getTime())) return;

      const y = d.getFullYear();
      const m = `${d.getMonth() + 1}`.padStart(2, "0");
      const day = `${d.getDate()}`.padStart(2, "0");
      const key = `${y}-${m}-${day}`;

      if (!byDay.has(key)) {
        byDay.set(key, {
          dia: `${day}/${m}`,
          transferencias: 0,
          errosApp: 0,
          outros: 0,
        });
      }

      const acc = byDay.get(key);
      if (isTransferencia(ticket)) acc.transferencias += 1;
      else if (isErroApp(ticket)) acc.errosApp += 1;
      else acc.outros += 1;
    });

    return Array.from(byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, value]) => value);
  }, [fTickets, dailyTicketAgentSel]);

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

  const TICKET_METRICS = [
    {
      key: "transferencias",
      label: "Transferências",
      color: P.green,
    },
    { key: "errosApp", label: "Erros no App", color: P.red },
    { key: "outros", label: "Outros", color: P.cyan },
  ];
  const tm =
    TICKET_METRICS.find((x) => x.key === dailyTicketMetricSel) ||
    TICKET_METRICS[0];

  const ticketGoalRatio = Number(ticketGoalPct) / 100;
  const ticketRegistrationRatio = Number(kpis.txRegistros) || 0;
  const isTicketGoalReached =
    Number.isFinite(ticketGoalRatio) &&
    ticketRegistrationRatio >= ticketGoalRatio;
  const showRegistrationCards = isAttendantOwnScope;
  const showAbandonmentCards = !isAttendantOwnScope;

  return (
    <>
      <Section title="Telefonia" icon="📞">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <KPI
            icon="📞"
            label="Chamadas"
            value={kpis.ta}
            sub={`${kpis.tc} total`}
            color={P.green}
          />
          {showRegistrationCards && (
            <>
              <KPI
                icon="🧾"
                label="Registros / Ligações Atendidas"
                value={fmtPct(ticketRegistrationRatio)}
                sub={`${kpis.tkt} tickets de ${kpis.ta} ligações atendidas`}
                color={P.purple}
              />
              <KPI
                icon="🎯"
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
                icon="⚠️"
                label="Tx Aband+Não At."
                value={fmtPct(kpis.txAband)}
                color={P.orange}
              />
              <KPI
                icon="⚠️"
                label="Aband+Não At."
                value={kpis.tab}
                color={P.orange}
              />
            </>
          )}
          <KPI
            icon="⏱"
            label="TMA Médio"
            value={fmtSec(kpis.tma)}
            color={P.orange}
          />
          <KPI
            icon="⏳"
            label="TME Médio"
            value={fmtSec(kpis.tme)}
            color={P.cyan}
          />
        </div>
      </Section>

      <Section title="Tickets (derivados das ligações)" icon="🎫">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div
            onClick={() => onTicketDrilldown?.("todos")}
            style={{ cursor: "pointer", flex: "1 1 150px", minWidth: 140 }}
          >
            <KPI icon="🎫" label="Total" value={kpis.tkt} color={P.purple} />
          </div>
          <div
            onClick={() => onTicketDrilldown?.("fechados")}
            style={{ cursor: "pointer", flex: "1 1 150px", minWidth: 140 }}
          >
            <KPI icon="🟢" label="Fechados" value={kpis.tktF} color={P.green} />
          </div>
          <div
            onClick={() => onTicketDrilldown?.("abertos")}
            style={{ cursor: "pointer", flex: "1 1 150px", minWidth: 140 }}
          >
            <KPI
              icon="🔴"
              label="Abertos"
              value={kpis.tktA}
              color={kpis.tktA > 5 ? P.red : P.orange}
            />
          </div>
          <KPI icon="📅" label="Dias" value={kpis.dias} color={P.accent} />
          <KPI
            icon="📈"
            label="Méd Chamadas/Dia"
            value={kpis.dias ? (kpis.tc / kpis.dias).toFixed(1) : "0"}
            color={P.cyan}
          />
          <div
            onClick={() => onTicketDrilldown?.("transferencias")}
            style={{ cursor: "pointer", flex: "1 1 150px", minWidth: 140 }}
          >
            <KPI
              icon="🔄"
              label="Transferências"
              value={kpis.tktTransf}
              color={P.accent}
            />
          </div>
          <div
            onClick={() => onTicketDrilldown?.("erros")}
            style={{ cursor: "pointer", flex: "1 1 150px", minWidth: 140 }}
          >
            <KPI
              icon="🐛"
              label="Erros/App"
              value={kpis.tktErros}
              color={P.red}
            />
          </div>
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
              Evolução Diária
            </span>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              <select
                value={dailyCallsAgentSel}
                onChange={(e) => setDailyCallsAgentSel(e.target.value)}
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
                {callsAtendenteOptions.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome.replace(" - Central", "")}
                  </option>
                ))}
              </select>
              {METRICS.map(({ key, label, color }) => (
                <button
                  key={key}
                  onClick={() => setMetricSel(key)}
                  style={{
                    padding: "4px 12px",
                    border: `1px solid ${metricSel === key ? color : P.bdr}`,
                    borderRadius: 20,
                    cursor: "pointer",
                    background:
                      metricSel === key ? color + "22" : "transparent",
                    color: metricSel === key ? color : P.dim,
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
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={dailyCallsEvolution}>
                <CartesianGrid strokeDasharray="3 3" stroke={P.bdr} />
                <XAxis
                  dataKey="dia"
                  tick={{ fill: P.dim, fontSize: 9 }}
                  interval={Math.max(
                    0,
                    Math.floor(dailyCallsEvolution.length / 12),
                  )}
                />
                <YAxis
                  tick={{ fill: P.dim, fontSize: 10 }}
                  domain={m.pct ? [0, 1] : ["auto", "auto"]}
                  tickFormatter={m.pct ? (v) => fmtPct(v) : undefined}
                />
                <Tooltip content={<TT />} />
                <Line
                  type="monotone"
                  dataKey={m.key}
                  stroke={m.color}
                  strokeWidth={2}
                  dot={{ r: 2, fill: m.color }}
                  activeDot={{ r: 4 }}
                />
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
                {atendenteOptions.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </select>
              {TICKET_METRICS.map(({ key, label, color }) => (
                <button
                  key={key}
                  onClick={() => setDailyTicketMetricSel(key)}
                  style={{
                    padding: "4px 12px",
                    border: `1px solid ${dailyTicketMetricSel === key ? color : P.bdr}`,
                    borderRadius: 20,
                    cursor: "pointer",
                    background:
                      dailyTicketMetricSel === key
                        ? color + "22"
                        : "transparent",
                    color: dailyTicketMetricSel === key ? color : P.dim,
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
                  dataKey={tm.key}
                  name={tm.label}
                  stroke={tm.color}
                  strokeWidth={2}
                  dot={{ r: 2, fill: tm.color }}
                  activeDot={{ r: 4 }}
                />
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
        <ChartCard title="Tickets por Categoria">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={catData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={35}
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

        <ChartCard title="Tickets por Severidade">
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

      <Section title="Visão por Atendente" icon="👥">
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
