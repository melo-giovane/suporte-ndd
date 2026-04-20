import { describe, expect, it } from "vitest";
import { buildKpis, filterByDateRange } from "./dashboardModel.js";

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
