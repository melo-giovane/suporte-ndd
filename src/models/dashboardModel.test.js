import { describe, expect, it } from "vitest";
import { filterByDateRange } from "./dashboardModel.js";

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
