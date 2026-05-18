# Atividade/Hora com Tickets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estender a aba Atividade/Hora para computar tickets (por hora de abertura) além de ligações, com seletor de fonte (Ambos/Ligações/Tickets) respeitando os filtros globais de data e produto.

**Architecture:**
1. Extrair `buildHourlyActivity(fCons, fTickets, opts)` para `src/models/dashboardModel.js` com cobertura de testes em vitest.
2. Criar `src/tabs/AtividadeHoraTab.jsx` como componente lazy (padrão `ResumoTab`/`TicketsTab`), encapsulando seletor de fonte, gráficos e tabela.
3. Remover memo `hourlyActivity`, estado `hourlyVolumeMode` e o bloco JSX inline em `src/App.jsx`; substituir por `<Suspense><AtividadeHoraTab /></Suspense>`.

**Tech Stack:** React 19, Vite 8, Recharts 3, Vitest 4, lucide-react. Estilos inline (padrão do projeto).

**Reference files (paths and line numbers as of plan creation):**
- `src/App.jsx:833` — estado `hourlyVolumeMode` (a remover).
- `src/App.jsx:1480-1543` — memo `hourlyActivity` (a remover).
- `src/App.jsx:3143-3327` — bloco JSX `tab === "atividade-hora"` (a substituir).
- `src/App.jsx:714-761` — helpers `resolveHourFromConsEntry` e `resolveDayGroupFromConsEntry` (NÃO mover; passar como props/parâmetros).
- `src/App.jsx:127-128` — onde `lazy(...)` é declarado.
- `src/App.jsx:58-96` — paleta `DARK_THEME`/`LIGHT_THEME` (já contém `purple`).
- `src/tabs/ResumoTab.jsx:43-76` — referência de assinatura de props para tabs lazy.
- `src/models/dashboardModel.js:1-481` — onde adicionar `buildHourlyActivity`.
- `src/models/dashboardModel.test.js` — onde adicionar testes vitest.

---

## Task 1: Adicionar `buildHourlyActivity` no model (TDD)

**Files:**
- Test: `src/models/dashboardModel.test.js`
- Modify: `src/models/dashboardModel.js`

### Step 1.1: Escrever testes que falham

- [ ] **Step 1.1.1: Anexar bloco de testes ao final de `src/models/dashboardModel.test.js`**

Append after the last `describe(...)` block:

```js
import {
  buildKpis,
  filterByDateRange,
  buildHourlyActivity,
} from "./dashboardModel.js";

// (substitua a linha de import existente no topo do arquivo pela combinada acima
//  apenas se ainda não estiver assim; veja step 1.1.2)
```

Na verdade, ajuste o import existente no topo (linha 2) para incluir `buildHourlyActivity`:

```js
import {
  buildKpis,
  buildHourlyActivity,
  filterByDateRange,
} from "./dashboardModel.js";
```

- [ ] **Step 1.1.2: Adicionar bloco `describe("buildHourlyActivity", ...)` ao final do arquivo**

```js
describe("buildHourlyActivity", () => {
  // Helpers fake — equivalentes simplificados aos do App.jsx, suficientes para teste.
  const resolveHourFromConsEntry = (entry) => {
    const v = Number.parseInt(String(entry?.hora ?? ""), 10);
    return Number.isInteger(v) && v >= 0 && v <= 23 ? v : null;
  };
  const resolveDayGroupFromConsEntry = (entry) => {
    const rawDate = entry?.dateReal;
    const parsed =
      rawDate instanceof Date ? rawDate : rawDate ? new Date(rawDate) : null;
    if (parsed && !Number.isNaN(parsed.getTime())) {
      const yyyy = parsed.getFullYear();
      const mm = `${parsed.getMonth() + 1}`.padStart(2, "0");
      const dd = `${parsed.getDate()}`.padStart(2, "0");
      return { key: `${yyyy}-${mm}-${dd}`, label: `${dd}/${mm}` };
    }
    return { key: "(sem-data)", label: "-" };
  };
  const opts = (extra = {}) => ({
    dateFrom: "",
    dateTo: "",
    resolveHourFromConsEntry,
    resolveDayGroupFromConsEntry,
    ...extra,
  });

  it("agrupa ligações em 3 horas distintas e mantém tickets em zero", () => {
    const cons = [
      {
        hora: 8,
        dateReal: new Date("2026-04-01T08:00:00"),
        total: 10,
        atendidas: 8,
        naoAtendidas: 1,
        abandonadas: 1,
      },
      {
        hora: 9,
        dateReal: new Date("2026-04-01T09:00:00"),
        total: 20,
        atendidas: 15,
        naoAtendidas: 3,
        abandonadas: 2,
      },
      {
        hora: 10,
        dateReal: new Date("2026-04-01T10:00:00"),
        total: 5,
        atendidas: 5,
        naoAtendidas: 0,
        abandonadas: 0,
      },
    ];
    const out = buildHourlyActivity(cons, [], opts());
    expect(out).toHaveLength(3);
    expect(out.map((b) => b.hora)).toEqual([8, 9, 10]);
    expect(out[0]).toMatchObject({
      hora: 8,
      horaLabel: "08:00",
      total: 10,
      atendidas: 8,
      naoAtendidas: 1,
      abandonadas: 1,
      tickets: 0,
    });
  });

  it("agrupa tickets pela hora de dataAbertura, sem ligações", () => {
    const tickets = [
      { dataAbertura: "2026-04-01T14:30:00" },
      { dataAbertura: "2026-04-01T14:45:00" },
    ];
    const out = buildHourlyActivity([], tickets, opts());
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      hora: 14,
      horaLabel: "14:00",
      tickets: 2,
      total: 0,
      atendidas: 0,
    });
  });

  it("mescla ligação e tickets na mesma hora em um único bucket", () => {
    const cons = [
      {
        hora: 9,
        dateReal: new Date("2026-04-01T09:00:00"),
        total: 4,
        atendidas: 3,
        naoAtendidas: 1,
        abandonadas: 0,
      },
    ];
    const tickets = [
      { dataAbertura: "2026-04-01T09:10:00" },
      { dataAbertura: "2026-04-01T09:55:00" },
    ];
    const out = buildHourlyActivity(cons, tickets, opts());
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      hora: 9,
      total: 4,
      atendidas: 3,
      tickets: 2,
    });
  });

  it("descarta tickets com dataAbertura inválida ou ausente", () => {
    const tickets = [
      { dataAbertura: "2026-04-01T11:00:00" },
      { dataAbertura: "" },
      { dataAbertura: null },
      { dataAbertura: "nao-eh-data" },
      {},
    ];
    const out = buildHourlyActivity([], tickets, opts());
    expect(out).toHaveLength(1);
    expect(out[0].hora).toBe(11);
    expect(out[0].tickets).toBe(1);
  });

  it("calcula mediaTicketsHora dividindo por daysCount derivado de dateFrom/dateTo", () => {
    // intervalo de 5 dias; 10 tickets na hora 14 → média 2.0
    const tickets = Array.from({ length: 10 }, () => ({
      dataAbertura: "2026-04-01T14:00:00",
    }));
    const out = buildHourlyActivity([], tickets, {
      ...opts(),
      dateFrom: "2026-04-01",
      dateTo: "2026-04-05",
    });
    expect(out).toHaveLength(1);
    expect(out[0].daysCount).toBe(5);
    expect(out[0].mediaTicketsHora).toBe(2);
  });

  it("usa min/max de fCons como fallback quando dateFrom/dateTo são vazios; tickets não expandem o range", () => {
    const cons = [
      {
        hora: 9,
        dateReal: new Date("2026-04-01T09:00:00"),
        total: 2,
        atendidas: 2,
        naoAtendidas: 0,
        abandonadas: 0,
      },
      {
        hora: 9,
        dateReal: new Date("2026-04-03T09:00:00"),
        total: 2,
        atendidas: 2,
        naoAtendidas: 0,
        abandonadas: 0,
      },
    ];
    // tickets em datas fora do range das ligações; não devem alterar daysCount
    const tickets = [
      { dataAbertura: "2026-01-01T09:00:00" },
      { dataAbertura: "2026-12-31T09:00:00" },
    ];
    const out = buildHourlyActivity(cons, tickets, opts());
    expect(out).toHaveLength(1);
    // 01/04 → 03/04 = 3 dias
    expect(out[0].daysCount).toBe(3);
  });
});
```

- [ ] **Step 1.1.3: Rodar testes para confirmar que falham**

Run: `npm test -- src/models/dashboardModel.test.js`
Expected: FAIL com erro de import (`buildHourlyActivity is not exported`) ou `ReferenceError`.

### Step 1.2: Implementar `buildHourlyActivity`

- [ ] **Step 1.2.1: Adicionar a função ao final de `src/models/dashboardModel.js`**

Append after `buildDailyChart` (line ~481):

```js
function resolveHourFromTicket(t) {
  if (!t?.dataAbertura) return null;
  const d = new Date(t.dataAbertura);
  return Number.isNaN(d.getTime()) ? null : d.getHours();
}

export function buildHourlyActivity(fCons, fTickets, opts) {
  const {
    dateFrom = "",
    dateTo = "",
    resolveHourFromConsEntry,
    resolveDayGroupFromConsEntry,
  } = opts || {};

  const buckets = new Map();
  let minDayKey = null;
  let maxDayKey = null;

  const ensure = (hour) => {
    if (!buckets.has(hour)) {
      buckets.set(hour, {
        hora: hour,
        total: 0,
        atendidas: 0,
        naoAtendidas: 0,
        abandonadas: 0,
        registros: 0,
        tickets: 0,
      });
    }
    return buckets.get(hour);
  };

  (fCons || []).forEach((row) => {
    const hour =
      typeof resolveHourFromConsEntry === "function"
        ? resolveHourFromConsEntry(row)
        : null;
    if (hour === null) return;

    if (typeof resolveDayGroupFromConsEntry === "function") {
      const dayKey = resolveDayGroupFromConsEntry(row)?.key;
      if (dayKey && /^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
        if (!minDayKey || dayKey < minDayKey) minDayKey = dayKey;
        if (!maxDayKey || dayKey > maxDayKey) maxDayKey = dayKey;
      }
    }

    const b = ensure(hour);
    b.total += Number(row.total) || 0;
    b.atendidas += Number(row.atendidas) || 0;
    b.naoAtendidas += Number(row.naoAtendidas) || 0;
    b.abandonadas += Number(row.abandonadas) || 0;
    b.registros += 1;
  });

  (fTickets || []).forEach((t) => {
    const hour = resolveHourFromTicket(t);
    if (hour === null) return;
    ensure(hour).tickets += 1;
  });

  const startKey = dateFrom || minDayKey;
  const endKey = dateTo || maxDayKey;
  let daysCount = 0;
  if (startKey && endKey) {
    const start = new Date(`${startKey}T00:00:00`);
    const end = new Date(`${endKey}T00:00:00`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      const diff = Math.round((end - start) / 86400000) + 1;
      daysCount = diff > 0 ? diff : 0;
    }
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.hora - b.hora)
    .map((row) => {
      const indisponiveis = row.naoAtendidas + row.abandonadas;
      return {
        ...row,
        horaLabel: `${String(row.hora).padStart(2, "0")}:00`,
        indisponiveis,
        daysCount,
        mediaTotalHora: daysCount
          ? Math.round((row.total / daysCount) * 10) / 10
          : 0,
        mediaAtendidasHora: daysCount
          ? Math.round((row.atendidas / daysCount) * 10) / 10
          : 0,
        mediaTicketsHora: daysCount
          ? Math.round((row.tickets / daysCount) * 10) / 10
          : 0,
        txAtend: row.total ? row.atendidas / row.total : 0,
        txAbandono: row.total ? indisponiveis / row.total : 0,
      };
    });
}
```

- [ ] **Step 1.2.2: Rodar testes para confirmar que passam**

Run: `npm test -- src/models/dashboardModel.test.js`
Expected: PASS (todos os 6 novos + os existentes).

- [ ] **Step 1.3: Commit**

```bash
git add src/models/dashboardModel.js src/models/dashboardModel.test.js
git commit -m "feat(model): adiciona buildHourlyActivity com tickets por hora"
```

---

## Task 2: Criar componente `AtividadeHoraTab.jsx`

**Files:**
- Create: `src/tabs/AtividadeHoraTab.jsx`

- [ ] **Step 2.1: Criar o arquivo com o componente completo**

```jsx
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
  const showTickets = effectiveMode === "ambos" || effectiveMode === "tickets";
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

  const chart1Title =
    effectiveMode === "tickets"
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
```

Notas:
- `showTickets`/`showCalls` declarados acima ficam disponíveis se a lógica do gráfico precisar refinar — atualmente o switch usa `effectiveMode` diretamente, mas a constante está documentada para clareza. Se o linter reclamar de "unused", remova as duas linhas (`const showCalls = ...; const showTickets = ...;`) e mantenha apenas `showAbandonChart`.
- `stackId="acionamentos"` no modo `ambos` empilha Atendidas + Tickets (decisão do spec 4.2).
- `P.purple` existe em ambas paletas (`DARK_THEME` e `LIGHT_THEME`) — não requer mudança na paleta.

- [ ] **Step 2.2: Validar lint do arquivo**

Run: `npx eslint src/tabs/AtividadeHoraTab.jsx`
Expected: sem erros. Se houver warning de unused-var em `showCalls`/`showTickets`, remover essas duas linhas.

- [ ] **Step 2.3: Commit**

```bash
git add src/tabs/AtividadeHoraTab.jsx
git commit -m "feat(tabs): cria AtividadeHoraTab com seletor de fonte e tickets"
```

---

## Task 3: Integrar `AtividadeHoraTab` no `App.jsx` e remover código antigo

**Files:**
- Modify: `src/App.jsx`

### Step 3.1: Adicionar import lazy

- [ ] **Step 3.1.1: Adicionar declaração `lazy` após linha 128**

Localize:
```js
const ResumoTab = lazy(() => import("./tabs/ResumoTab.jsx"));
const TicketsTab = lazy(() => import("./tabs/TicketsTab.jsx"));
```

Acrescente a linha:
```js
const AtividadeHoraTab = lazy(() => import("./tabs/AtividadeHoraTab.jsx"));
```

### Step 3.2: Remover estado `hourlyVolumeMode`

- [ ] **Step 3.2.1: Apagar a linha em `src/App.jsx:833`**

Antes:
```js
const [hourlyVolumeMode, setHourlyVolumeMode] = useState("volume");
```

Depois: linha removida (esse estado agora vive dentro de `AtividadeHoraTab`).

### Step 3.3: Remover memo `hourlyActivity`

- [ ] **Step 3.3.1: Apagar o bloco `src/App.jsx:1480-1543`**

Remover o bloco inteiro:
```js
const hourlyActivity = useMemo(() => {
  ...
}, [fCons, dateFrom, dateTo]);
```

### Step 3.4: Substituir o bloco JSX `tab === "atividade-hora"`

- [ ] **Step 3.4.1: Substituir as linhas ~3143-3327**

Antes (resumido):
```jsx
{tab === "atividade-hora" && (
  <>
    {hourlyActivity.length === 0 ? (...) : (
      <>...gráficos e tabela inline...</>
    )}
  </>
)}
```

Depois:
```jsx
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
```

### Step 3.5: Verificar imports e símbolos remanescentes

- [ ] **Step 3.5.1: Confirmar que `Suspense` já está importado em `src/App.jsx`**

Run: `grep -n "import.*Suspense" src/App.jsx`
Expected: linha com `Suspense` no import de React (já existe — `ResumoTab`/`TicketsTab` usam).

- [ ] **Step 3.5.2: Confirmar que `produtoFilter` está disponível no escopo do JSX**

Já desestruturado em `src/App.jsx:895` (verificado durante o planejamento). Apenas confirme via Grep:
Run (via Grep tool): pattern `produtoFilter`, file `src/App.jsx`.
Expected: ao menos a linha `produtoFilter,` no destructuring. Se faltar, acrescentar à lista.

- [ ] **Step 3.5.3: Rodar `npm run build` para validar**

Run: `npm run build`
Expected: build limpo, sem erros de referência. Se quebrar com "hourlyActivity is not defined" ou "hourlyVolumeMode is not defined", procure por usos remanescentes no arquivo:

Run (via Grep tool): pattern `hourlyActivity|hourlyVolumeMode|setHourlyVolumeMode`, file `src/App.jsx`.
Expected: zero matches. Se houver, remova as referências.

- [ ] **Step 3.6: Rodar testes para confirmar que nada regrediu**

Run: `npm test`
Expected: todos os testes passam.

- [ ] **Step 3.7: Commit**

```bash
git add src/App.jsx
git commit -m "refactor(App): substitui aba Atividade/Hora pelo componente lazy"
```

---

## Task 4: Validação manual (UI) e ajustes finais

**Files:**
- nenhum (validação)

- [ ] **Step 4.1: Subir o ambiente de dev**

Run: `npm run dev`
Aguardar: vite em `http://localhost:5173`, API em porta padrão.

- [ ] **Step 4.2: Testar cenários da seção 6.2 do spec**

Abra a aba Atividade/Hora e verifique manualmente:

1. **Master, sem produto filtrado**: o seletor mostra `[ Ambos ] [ Ligações ] [ Tickets ]`. Alternar entre os três. No modo Ambos, as barras devem aparecer empilhadas (verde + roxo). Tabela ganha coluna "Tickets" no modo Ambos.

2. **Master, modo Ambos + Média/Hora**: clique no pill "Média/Hora". As barras devem usar `mediaAtendidasHora` (verde) + `mediaTicketsHora` (roxo) na pilha.

3. **Master, produto filtrado**: selecione um produto no topo. O seletor de fonte deve mostrar **apenas** o pill "Tickets" e o hint "Produto selecionado: ligações não são filtradas por produto." aparece ao lado. Limpar o produto: o seletor volta com os 3 pills, mantendo "Tickets" ativo (não reseta automaticamente).

4. **Modo "Só Tickets"**: o card "Taxa de abandono/Não atendidas por hora" deve sumir.

5. **Atendente vinculado** (testar logando como usuário atendente): a aba renderiza sem o seletor de fonte (nem o toggle Volume/Média). Comportamento padrão = mostra ligações atendidas + tickets (modo "ambos" implícito). Sem gráfico de Tx Aband.

6. **Atendente sem vínculo**: empty state aparece.

7. **Filtro de data 1 dia**: confirmar `daysCount = 1`. No modo Média, `mediaTicketsHora == tickets` daquele dia.

8. **Trocar para outras abas (Resumo, Tickets, Equipe) e voltar**: nenhuma regressão.

- [ ] **Step 4.3: Verificar bundle inicial**

Run: `npm run build`
Inspecionar a saída do `vite build` — o chunk de `AtividadeHoraTab` deve aparecer separado dos chunks principais (assim como `ResumoTab`/`TicketsTab`).

- [ ] **Step 4.4: Commit final (se houver ajustes manuais)**

Se nenhum ajuste foi necessário, pular esta etapa. Caso contrário:

```bash
git add -A
git commit -m "fix(atividade-hora): ajustes da validação manual"
```

---

## Task 5: Atualizar `CLAUDE.md` com a nota da nova aba

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 5.1: Acrescentar entrada na seção 10 (Atualizações recentes)**

Localize a seção `## 10. Atualizacoes recentes (16/04/2026)` e adicione abaixo dela, mantendo o estilo conciso existente:

```markdown
- Atividade/Hora estendida (18/05/2026):
  - tickets agora computados por hora de abertura
  - seletor de fonte: Ambos / Ligações / Tickets
  - barras empilhadas (atendidas + tickets) no modo Ambos
  - produto filtrado força modo Tickets
  - aba extraída para `src/tabs/AtividadeHoraTab.jsx` (lazy)
  - nova função `buildHourlyActivity` em `dashboardModel.js`
```

Também atualize a linha 4 (`Ultima atualizacao: 16/04/2026`) para `18/05/2026`.

- [ ] **Step 5.2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude-md): registra extensão da aba Atividade/Hora com tickets"
```

---

## Checklist final

- [ ] `npm test` verde (incluindo os 6 novos testes de `buildHourlyActivity`).
- [ ] `npm run build` sem erros.
- [ ] `npx eslint .` sem novos warnings/erros.
- [ ] Grep confirma que `hourlyActivity` e `hourlyVolumeMode` não existem mais em `src/App.jsx`.
- [ ] Validação manual da Task 4 percorrida com sucesso.
- [ ] `CLAUDE.md` atualizado.
