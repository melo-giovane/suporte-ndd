import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import { Clock, ClipboardList } from "lucide-react";
import { buildHourlyActivity } from "../models/dashboardModel.js";

export default function AtividadeHoraTab({
  P,
  ChartCard,
  Section,
  Table,
  TT,
  Ico,
  fCons,
  fTickets,
  dateFrom,
  dateTo,
  produtoFilter,
  fmtPct,
  isAttendant,
  resolveHourFromConsEntry,
  resolveDayGroupFromConsEntry,
}) {
  const [sourceMode, setSourceMode] = useState("ambos");
  const [volumeMode, setVolumeMode] = useState("volume");

  const hasProductFilter = Boolean(produtoFilter);

  // Força modo "tickets" quando há produto filtrado.
  useEffect(() => {
    if (hasProductFilter && sourceMode !== "tickets") {
      setSourceMode("tickets");
    }
  }, [hasProductFilter, sourceMode]);

  const effectiveMode = hasProductFilter ? "tickets" : sourceMode;
  const showCalls = effectiveMode === "ambos" || effectiveMode === "ligacoes";
  const showAbandonChart = !isAttendant && showCalls;

  const allBuckets = useMemo(
    () =>
      buildHourlyActivity(fCons, fTickets, {
        dateFrom,
        dateTo,
        resolveHourFromConsEntry,
        resolveDayGroupFromConsEntry,
      }),
    [
      fCons,
      fTickets,
      dateFrom,
      dateTo,
      resolveHourFromConsEntry,
      resolveDayGroupFromConsEntry,
    ],
  );

  const visibleBuckets = useMemo(() => {
    return allBuckets.filter((b) => {
      if (effectiveMode === "ligacoes") return b.total > 0;
      if (effectiveMode === "tickets") return b.tickets > 0;
      return b.total > 0 || b.tickets > 0;
    });
  }, [allBuckets, effectiveMode]);

  const isEmpty = visibleBuckets.length === 0;

  const chart1Title = isAttendant
    ? "Ligações Atendidas por Hora"
    : effectiveMode === "tickets"
      ? "Tickets por Hora"
      : effectiveMode === "ligacoes"
        ? "Ligações por Hora"
        : "Acionamentos por Hora";

  const pillBtn = (label, id) => {
    const isActive = sourceMode === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => setSourceMode(id)}
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
        {label}
      </button>
    );
  };

  const volumeBtn = (label, id) => {
    const isActive = volumeMode === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => setVolumeMode(id)}
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
        {label}
      </button>
    );
  };

  const tableHeaders = (() => {
    if (effectiveMode === "tickets") return ["Hora", "Tickets"];
    if (effectiveMode === "ligacoes") {
      return isAttendant
        ? ["Hora", "Total", "Atend.", "Não At.", "Aband."]
        : [
            "Hora",
            "Total",
            "Atend.",
            "Não At.",
            "Aband.",
            "Tx Atend.",
            "Tx Ab./NA",
          ];
    }
    // ambos
    return isAttendant
      ? ["Hora", "Total", "Atend.", "Não At.", "Aband.", "Tickets"]
      : [
          "Hora",
          "Total",
          "Atend.",
          "Não At.",
          "Aband.",
          "Tx Atend.",
          "Tx Ab./NA",
          "Tickets",
        ];
  })();

  const tableRows = visibleBuckets.map((h) => {
    if (effectiveMode === "tickets") return [h.horaLabel, h.tickets];
    if (effectiveMode === "ligacoes") {
      return isAttendant
        ? [h.horaLabel, h.total, h.atendidas, h.naoAtendidas, h.abandonadas]
        : [
            h.horaLabel,
            h.total,
            h.atendidas,
            h.naoAtendidas,
            h.abandonadas,
            fmtPct(h.txAtend),
            fmtPct(h.txAbandono),
          ];
    }
    // ambos
    return isAttendant
      ? [
          h.horaLabel,
          h.total,
          h.atendidas,
          h.naoAtendidas,
          h.abandonadas,
          h.tickets,
        ]
      : [
          h.horaLabel,
          h.total,
          h.atendidas,
          h.naoAtendidas,
          h.abandonadas,
          fmtPct(h.txAtend),
          fmtPct(h.txAbandono),
          h.tickets,
        ];
  });

  return (
    <>
      {!isAttendant && (
        <div
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: P.dim,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              marginRight: 4,
            }}
          >
            Fonte:
          </span>
          {hasProductFilter
            ? pillBtn("Tickets", "tickets")
            : [
                pillBtn("Ambos", "ambos"),
                pillBtn("Ligações", "ligacoes"),
                pillBtn("Tickets", "tickets"),
              ]}
          {hasProductFilter && (
            <span
              style={{
                fontSize: 11,
                color: P.dim,
                marginLeft: 8,
              }}
            >
              Produto selecionado: ligações não são filtradas por produto.
            </span>
          )}
        </div>
      )}

      {isEmpty ? (
        <Section title="Atividade por Hora" icon={<Ico Icon={Clock} />}>
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
          </div>
        </Section>
      ) : (
        <>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <ChartCard title={chart1Title} h={260}>
              {!isAttendant && (
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    marginBottom: 10,
                    flexWrap: "wrap",
                  }}
                >
                  {volumeBtn("Volume", "volume")}
                  {volumeBtn("Média/Hora", "media")}
                </div>
              )}
              <ResponsiveContainer>
                <BarChart data={visibleBuckets} barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" stroke={P.bdr} />
                  <XAxis
                    dataKey="horaLabel"
                    tick={{ fill: P.dim, fontSize: 10 }}
                  />
                  <YAxis tick={{ fill: P.dim, fontSize: 10 }} />
                  <Tooltip content={<TT />} />
                  {/* Atendente: vista simplificada (apenas atendidas, modo ligações). */}
                  {isAttendant ? (
                    <Bar
                      dataKey="atendidas"
                      name="Ligações Atendidas"
                      fill={P.green}
                      radius={[4, 4, 0, 0]}
                    />
                  ) : effectiveMode === "ligacoes" ? (
                    volumeMode === "volume" ? (
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
                    )
                  ) : effectiveMode === "tickets" ? (
                    <Bar
                      dataKey={
                        volumeMode === "volume" ? "tickets" : "mediaTicketsHora"
                      }
                      name={volumeMode === "volume" ? "Tickets" : "Média Tickets"}
                      fill={P.purple}
                      radius={[4, 4, 0, 0]}
                    />
                  ) : (
                    // ambos — empilhadas: Atendidas + Tickets (stackId comum)
                    <>
                      <Bar
                        dataKey={
                          volumeMode === "volume"
                            ? "atendidas"
                            : "mediaAtendidasHora"
                        }
                        name={
                          volumeMode === "volume" ? "Atendidas" : "Média Atendidas"
                        }
                        stackId="acionamentos"
                        fill={P.green}
                        radius={[0, 0, 0, 0]}
                      />
                      <Bar
                        dataKey={
                          volumeMode === "volume" ? "tickets" : "mediaTicketsHora"
                        }
                        name={volumeMode === "volume" ? "Tickets" : "Média Tickets"}
                        stackId="acionamentos"
                        fill={P.purple}
                        radius={[4, 4, 0, 0]}
                      />
                    </>
                  )}
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {showAbandonChart && (
              <ChartCard
                title="Taxa de abandono/Não atendidas por hora"
                h={260}
              >
                <ResponsiveContainer>
                  <LineChart data={visibleBuckets}>
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

          <Section
            title="Detalhamento por Hora"
            icon={<Ico Icon={ClipboardList} />}
          >
            <Table headers={tableHeaders} rows={tableRows} />
          </Section>
        </>
      )}
    </>
  );
}
