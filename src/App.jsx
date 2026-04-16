import { useEffect, useState } from "react";
import { fmtSec, fmtPct } from "./utils.js";
import { useDashboardController } from "./controllers/useDashboardController.js";
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

function Table({ headers, rows }) {
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
              style={{ background: ri % 2 === 0 ? "transparent" : P.card }}
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

export default function App() {
  const [themeMode, setThemeMode] = useState(INITIAL_THEME_MODE);

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
    seriesVis,
    metricSel,
    saveStatus,
    isRestoring,
    incrementalStatus,
    fileRef,
    incrementalFileRef,
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
    handleFile,
    handleIncrementalFile,
    handleDrop,
    retryLoadFromDatabase,
  } = useDashboardController();

  if (!loaded) {
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
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
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
            Central de Relacionamentos NDD
          </h1>
          <p style={{ color: P.dim, fontSize: 14, margin: "0 0 28px" }}>
            {isRestoring
              ? "Tentando carregar os dados salvos no SQLite..."
              : "Arraste o Dashboard_Central.xlsx ou clique para selecionar"}
          </p>
          {isRestoring && (
            <div
              style={{
                fontSize: 12,
                color: P.dim,
                margin: "0 0 12px",
              }}
            >
              Se a API ainda estiver iniciando, aguarde alguns segundos.
            </div>
          )}
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${P.bdr}`,
              borderRadius: 16,
              padding: "48px 32px",
              cursor: "pointer",
              background: P.card,
              transition: "all .3s",
              opacity: isRestoring ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = P.accent;
              e.currentTarget.style.background = P.cardH;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = P.bdr;
              e.currentTarget.style.background = P.card;
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>📁</div>
            <div style={{ color: P.text, fontWeight: 600, fontSize: 14 }}>
              Soltar arquivo .xlsx aqui
            </div>
            <div style={{ color: P.dim, fontSize: 12, marginTop: 4 }}>
              ou clique para procurar
            </div>
          </div>
          {!isRestoring && (
            <button
              onClick={retryLoadFromDatabase}
              style={{
                marginTop: 10,
                background: P.card,
                border: `1px solid ${P.bdr}`,
                borderRadius: 8,
                color: P.text,
                padding: "7px 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Tentar carregar do SQLite
            </button>
          )}
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
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: "none" }}
            onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
          />
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
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
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
              Central de Relacionamentos NDD
            </h1>
            <p style={{ fontSize: 11, color: P.dim, margin: "2px 0 0" }}>
              {kpis.dias} dias filtrados · {cons.length} total ·{" "}
              {tickets.length} tickets
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
            }}
          >
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
            {(dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
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
          </div>
        </div>

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
            id="tickets"
            icon="🎫"
            label="Tickets"
            activeTab={tab}
            onSelect={setTab}
          />
          <TabBtn
            id="equipe"
            icon="👥"
            label="Equipe"
            activeTab={tab}
            onSelect={setTab}
          />
          <TabBtn
            id="atualizacao"
            icon="➕"
            label="Atualização"
            activeTab={tab}
            onSelect={setTab}
          />
        </div>

        {tab === "resumo" && (
          <>
            <Section title="Telefonia" icon="📞">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <KPI
                  icon="📞"
                  label="Chamadas"
                  value={kpis.tc}
                  sub={`${kpis.ta} atendidas`}
                  color={P.accent}
                />
                <KPI
                  icon="✅"
                  label="Tx Atendimento"
                  value={fmtPct(kpis.txAt)}
                  sub={kpis.txAt >= 0.9 ? "Meta atingida" : "Abaixo da meta"}
                  color={kpis.txAt >= 0.9 ? P.green : P.red}
                />
                <KPI
                  icon="⚠️"
                  label="Aband+Não At."
                  value={kpis.tab}
                  color={P.orange}
                />
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
                <KPI
                  icon="🎫"
                  label="Total"
                  value={kpis.tkt}
                  color={P.purple}
                />
                <KPI
                  icon="🟢"
                  label="Fechados"
                  value={kpis.tktF}
                  color={P.green}
                />
                <KPI
                  icon="🔴"
                  label="Abertos"
                  value={kpis.tktA}
                  color={kpis.tktA > 5 ? P.red : P.orange}
                />
                <KPI
                  icon="📅"
                  label="Dias"
                  value={kpis.dias}
                  color={P.accent}
                />
                <KPI
                  icon="📈"
                  label="Méd Chamadas/Dia"
                  value={kpis.dias ? (kpis.tc / kpis.dias).toFixed(1) : "0"}
                  color={P.cyan}
                />
                <KPI
                  icon="🔄"
                  label="Transferências"
                  value={kpis.tktTransf}
                  color={P.accent}
                />
                <KPI
                  icon="🐛"
                  label="Erros/App"
                  value={kpis.tktErros}
                  color={P.red}
                />
              </div>
            </Section>
            {(() => {
              const METRICS = [
                {
                  key: "Total",
                  label: "Total Chamadas",
                  color: P.accent,
                  pct: false,
                },
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
              return (
                <div style={{ marginTop: 18 }}>
                  <div
                    style={{
                      background: P.card,
                      borderRadius: 14,
                      border: `1px solid ${P.bdr}`,
                      padding: "14px 14px 10px",
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
                      <div
                        style={{ display: "flex", gap: 5, flexWrap: "wrap" }}
                      >
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
                                metricSel === key
                                  ? color + "22"
                                  : "transparent",
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
                        <LineChart data={dailyChart}>
                          <CartesianGrid strokeDasharray="3 3" stroke={P.bdr} />
                          <XAxis
                            dataKey="dia"
                            tick={{ fill: P.dim, fontSize: 9 }}
                            interval={Math.max(
                              0,
                              Math.floor(dailyChart.length / 12),
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
                </div>
              );
            })()}
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
                    <Bar
                      dataKey="value"
                      fill={P.purple}
                      radius={[0, 4, 4, 0]}
                    />
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
                    <BarChart
                      data={equipe.filter((e) => e.tma > 0)}
                      barSize={32}
                    >
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

        {tab === "telefonia" && (
          <>
            <Section title="Detalhamento Diário" icon="📅">
              <Table
                headers={[
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
                ]}
                rows={fCons.map((c) => [
                  c.data,
                  c.total,
                  c.atendidas,
                  c.naoAtendidas,
                  c.abandonadas,
                  fmtPct(c.txAbandono),
                  fmtSec(c.tma),
                  fmtSec(c.tme),
                  c.total ? fmtPct(c.atendidas / c.total) : "-",
                  c.total && c.atendidas / c.total >= 0.9 ? "✅" : "⚠️",
                ])}
              />
            </Section>
            <Section title="Ranking de Atendentes" icon="🏆">
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
              <ChartCard title="Taxa de Atendimento Diária" h={200}>
                <ResponsiveContainer>
                  <LineChart data={dailyChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke={P.bdr} />
                    <XAxis
                      dataKey="dia"
                      tick={{ fill: P.dim, fontSize: 9 }}
                      interval={Math.max(0, Math.floor(dailyChart.length / 12))}
                    />
                    <YAxis
                      tick={{ fill: P.dim, fontSize: 10 }}
                      domain={[0, 1]}
                      tickFormatter={(v) => fmtPct(v)}
                    />
                    <Tooltip content={<TT />} />
                    <Line
                      type="monotone"
                      dataKey="Tx Atend"
                      stroke={P.green}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
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
              <ChartCard title="Por Responsável" h={200}>
                <ResponsiveContainer>
                  <BarChart data={respData} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke={P.bdr} />
                    <XAxis dataKey="name" tick={{ fill: P.dim, fontSize: 9 }} />
                    <YAxis tick={{ fill: P.dim, fontSize: 10 }} />
                    <Tooltip content={<TT />} />
                    <Bar dataKey="value" fill={P.pink} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
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
            <Section title="Tickets em Aberto" icon="🔴">
              {fTickets.filter((t) => t.status === "Aberto").length === 0 ? (
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
                  Nenhum ticket em aberto!
                </div>
              ) : (
                <Table
                  headers={[
                    "Chamado",
                    "Título",
                    "Responsável",
                    "Severidade",
                    "Categoria",
                  ]}
                  rows={fTickets
                    .filter((t) => t.status === "Aberto")
                    .map((t) => [
                      t.chamado,
                      t.titulo.slice(0, 45),
                      t.responsavel.split(" ").slice(0, 2).join(" "),
                      t.severidade,
                      t.categoria,
                    ])}
                />
              )}
            </Section>
          </>
        )}

        {tab === "equipe" && (
          <>
            <Section title="Visão Unificada — Telefone + Tickets" icon="👥">
              <p style={{ fontSize: 12, color: P.dim, margin: "-8px 0 14px" }}>
                Tickets derivados das ligações. Total tickets ≤ chamadas
                atendidas.
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
                  aproveitadas e as ja existentes sao ignoradas.
                </p>

                <div
                  onClick={() => incrementalFileRef.current?.click()}
                  style={{
                    border: `2px dashed ${P.bdr}`,
                    borderRadius: 12,
                    padding: "26px 18px",
                    cursor: "pointer",
                    background: P.cardH,
                    textAlign: "center",
                    transition: "all .2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = P.accent;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = P.bdr;
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📥</div>
                  <div style={{ color: P.text, fontWeight: 600, fontSize: 13 }}>
                    Clique para adicionar novas linhas
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
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
