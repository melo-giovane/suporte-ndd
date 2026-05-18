import { describe, expect, it } from "vitest";
import {
  buildKpis,
  buildHourlyActivity,
  filterByDateRange,
} from "./dashboardModel.js";

describe("filterByDateRange dayType", () => {
  const base = [
    { id: "weekday", dateReal: new Date("2026-04-22T10:00:00") }, // quarta
    { id: "holiday", dateReal: new Date("2026-04-21T10:00:00") }, // Tiradentes
    { id: "weekend", dateReal: new Date("2026-04-19T10:00:00") }, // domingo
    { id: "invalid", dateReal: null },
  ];

  it("mantem todos os registros quando dayType = all", () => {
    const out = filterByDateRange(base, "", "", "all");
    expect(out.map((item) => item.id)).toEqual([
      "weekday",
      "holiday",
      "weekend",
      "invalid",
    ]);
  });

  it("filtra apenas dias uteis quando dayType = weekdays", () => {
    const out = filterByDateRange(base, "", "", "weekdays");
    expect(out.map((item) => item.id)).toEqual(["weekday"]);
  });

  it("filtra apenas feriados quando dayType = holidays", () => {
    const out = filterByDateRange(base, "", "", "holidays");
    expect(out.map((item) => item.id)).toEqual(["holiday"]);
  });

  it("filtra apenas finais de semana quando dayType = weekends", () => {
    const out = filterByDateRange(base, "", "", "weekends");
    expect(out.map((item) => item.id)).toEqual(["weekend"]);
  });

  it("combina filtro de tipo de dia com intervalo de datas", () => {
    const out = filterByDateRange(base, "2026-04-20", "2026-04-22", "weekdays");
    expect(out.map((item) => item.id)).toEqual(["weekday"]);
  });

  it("remove registros sem data válida quando há filtro de período", () => {
    const out = filterByDateRange(base, "2026-04-20", "2026-04-30", "all");
    expect(out.map((item) => item.id)).toEqual(["weekday", "holiday"]);
  });
});

describe("buildKpis", () => {
  it("evita duplicidade quando o dia tem linha consolidada e linhas por hora", () => {
    const cons = [
      {
        data: "01/04/2026",
        dateReal: new Date("2026-04-01T00:00:00"),
        hora: null,
        total: 100,
        atendidas: 80,
        abandonadas: 10,
        naoAtendidas: 10,
        tma: 50,
        tme: 20,
      },
      {
        data: "01/04/2026 08:00",
        dateReal: new Date("2026-04-01T08:00:00"),
        hora: 8,
        total: 40,
        atendidas: 30,
        abandonadas: 5,
        naoAtendidas: 5,
        tma: 60,
        tme: 30,
      },
      {
        data: "01/04/2026 09:00",
        dateReal: new Date("2026-04-01T09:00:00"),
        hora: 9,
        total: 60,
        atendidas: 50,
        abandonadas: 5,
        naoAtendidas: 5,
        tma: 40,
        tme: 10,
      },
      {
        data: "02/04/2026",
        dateReal: new Date("2026-04-02T00:00:00"),
        hora: null,
        total: 80,
        atendidas: 70,
        abandonadas: 5,
        naoAtendidas: 5,
        tma: 30,
        tme: 15,
      },
    ];

    const kpis = buildKpis(cons, []);

    expect(kpis.tc).toBe(180);
    expect(kpis.ta).toBe(150);
    expect(kpis.tab).toBe(30);
    expect(kpis.dias).toBe(2);
    expect(kpis.tma).toBe(43);
    expect(kpis.tme).toBe(18);
    expect(kpis.txAt).toBeCloseTo(150 / 180);
    expect(kpis.txAband).toBeCloseTo(30 / 180);
  });

  it("mantém linha diária quando o dia não possui detalhamento por hora", () => {
    const cons = [
      {
        data: "03/04/2026",
        dateReal: new Date("2026-04-03T00:00:00"),
        hora: null,
        total: 50,
        atendidas: 40,
        abandonadas: 5,
        naoAtendidas: 5,
        tma: 20,
        tme: 10,
      },
      {
        data: "04/04/2026",
        dateReal: new Date("2026-04-04T00:00:00"),
        hora: null,
        total: 80,
        atendidas: 60,
        abandonadas: 10,
        naoAtendidas: 10,
        tma: 50,
        tme: 25,
      },
      {
        data: "04/04/2026 09:00",
        dateReal: new Date("2026-04-04T09:00:00"),
        hora: 9,
        total: 30,
        atendidas: 20,
        abandonadas: 5,
        naoAtendidas: 5,
        tma: 30,
        tme: 15,
      },
    ];

    const kpis = buildKpis(cons, []);

    expect(kpis.tc).toBe(80);
    expect(kpis.ta).toBe(60);
    expect(kpis.tab).toBe(20);
    expect(kpis.dias).toBe(2);
    expect(kpis.tma).toBe(25);
    expect(kpis.tme).toBe(13);
  });
});

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
