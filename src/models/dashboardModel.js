import {
  AGENT_MAP,
  parseDataPt,
  parseSec,
  normalize,
  splitTitulo,
  isTransferencia,
  isErroApp,
} from "../utils.js";

const MONTH_LABELS = [
  ["Janeiro", "Jan"],
  ["Fevereiro", "Fev"],
  ["Março", "Mar"],
  ["Abril", "Abr"],
  ["Maio", "Mai"],
  ["Junho", "Jun"],
  ["Julho", "Jul"],
  ["Agosto", "Ago"],
  ["Setembro", "Set"],
  ["Outubro", "Out"],
  ["Novembro", "Nov"],
  ["Dezembro", "Dez"],
];

const FIXED_HOLIDAYS_MMDD = new Set([
  "01-01", // Confraternizacao Universal
  "04-21", // Tiradentes
  "05-01", // Dia do Trabalhador
  "09-07", // Independencia do Brasil
  "10-12", // Nossa Senhora Aparecida
  "11-02", // Finados
  "11-15", // Proclamacao da Republica
  "11-20", // Dia da Consciencia Negra
  "12-25", // Natal
]);

const holidayCacheByYear = new Map();

function toIsoDateKey(date) {
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const dd = `${date.getDate()}`.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(baseDate, days) {
  const next = new Date(baseDate);
  next.setDate(next.getDate() + days);
  return next;
}

function computeEasterSunday(year) {
  // Gregorian algorithm (Meeus/Jones/Butcher)
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getHolidaySet(year) {
  if (holidayCacheByYear.has(year)) {
    return holidayCacheByYear.get(year);
  }

  const set = new Set();

  FIXED_HOLIDAYS_MMDD.forEach((mmdd) => {
    set.add(`${year}-${mmdd}`);
  });

  const easterSunday = computeEasterSunday(year);
  const carnivalMonday = addDays(easterSunday, -48);
  const carnivalTuesday = addDays(easterSunday, -47);
  const goodFriday = addDays(easterSunday, -2);
  const corpusChristi = addDays(easterSunday, 60);

  [carnivalMonday, carnivalTuesday, goodFriday, corpusChristi].forEach((d) => {
    set.add(toIsoDateKey(d));
  });

  holidayCacheByYear.set(year, set);
  return set;
}

function normalizeDayTypeFilter(dayType) {
  const normalized = String(dayType || "all")
    .trim()
    .toLowerCase();
  if (
    normalized !== "all" &&
    normalized !== "weekdays" &&
    normalized !== "weekends" &&
    normalized !== "holidays"
  ) {
    return "all";
  }
  return normalized;
}

function matchDayTypeFilter(date, dayType = "all") {
  const mode = normalizeDayTypeFilter(dayType);
  if (mode === "all") return true;

  const weekDay = date.getDay();
  const isWeekend = weekDay === 0 || weekDay === 6;

  if (mode === "weekends") {
    return isWeekend;
  }

  const holidaySet = getHolidaySet(date.getFullYear());
  const isHoliday = holidaySet.has(toIsoDateKey(date));

  if (mode === "holidays") {
    return isHoliday;
  }

  // weekdays mode
  return !isWeekend && !isHoliday;
}

export function parseWorkbookData(XLSX, workbook) {
  const nextCons = [];
  const nextAtend = [];
  const nextTickets = [];

  const wsCons = workbook.Sheets["Cola_Atplus_Cons"];
  if (wsCons) {
    const raw = XLSX.utils.sheet_to_json(wsCons, {
      header: 1,
      range: 3,
      raw: true,
    });
    nextCons.push(
      ...raw
        .filter((r) => r[0])
        .map((r) => ({
          data: String(r[0]),
          total: Number(r[2]) || 0,
          atendidas: Number(r[3]) || 0,
          naoAtendidas: Number(r[5]) || 0,
          abandonadas: Number(r[6]) || 0,
          txAbandono: Number(r[7]) || 0,
          tma: parseSec(r[8]),
          tme: parseSec(r[9]),
          dateReal: parseDataPt(String(r[0])),
        })),
    );
  }

  const wsAtend = workbook.Sheets["Cola_Atplus_Atend"];
  if (wsAtend) {
    const raw = XLSX.utils.sheet_to_json(wsAtend, {
      header: 1,
      range: 3,
      raw: true,
    });
    nextAtend.push(
      ...raw
        .filter((r) => r[0] && r[2])
        .map((r) => ({
          data: String(r[0]),
          ramal: String(r[2] || ""),
          tentativas: Number(r[3]) || 0,
          atendidas: Number(r[4]) || 0,
          perdidas: Number(r[5]) || 0,
          tma: parseSec(r[7]),
          tme: parseSec(r[8]),
          dateReal: parseDataPt(String(r[0])),
        })),
    );
  }

  const wsEll = workbook.Sheets["Cola_Ellevo"];
  if (wsEll) {
    const raw = XLSX.utils.sheet_to_json(wsEll, {
      header: 1,
      range: 3,
      raw: true,
    });
    nextTickets.push(
      ...raw
        .filter((r) => r[0])
        .map((r) => {
          const titulo = String(r[3] || "");
          const [catRaw] = splitTitulo(titulo);
          const fechamento = r[1];
          const ab = r[2];
          let dr = null;
          if (ab instanceof Date) dr = ab;
          else if (typeof ab === "string" && ab) dr = new Date(ab);

          let df = null;
          if (fechamento instanceof Date) df = fechamento;
          else if (
            typeof fechamento === "string" &&
            fechamento &&
            fechamento !== "-"
          ) {
            const parsed = new Date(fechamento);
            df = Number.isNaN(parsed.getTime()) ? null : parsed;
          }

          return {
            chamado: String(r[0]),
            dataAbertura: dr && !isNaN(dr) ? dr.toISOString() : null,
            dataFechamento: df ? df.toISOString() : null,
            titulo,
            categoriaRaw: catRaw,
            natureza: String(r[6] || ""),
            responsavel: String(r[7] || ""),
            qualificacao: String(r[8] || ""),
            severidade: String(r[9] || ""),
            cliente: String(r[4] || ""),
            modulo: String(r[5] || ""),
            tramites: String(r[10] || ""),
            descricao: String(r[11] || ""),
            tempoChamadoRaw: String(r[12] || ""),
            categoria: normalize(catRaw),
            dateReal: dr && !isNaN(dr) ? dr : null,
            status: !r[1] || r[1] === "-" ? "Aberto" : "Fechado",
          };
        }),
    );
  }

  return { cons: nextCons, atend: nextAtend, tickets: nextTickets };
}

function parseDateFilterInput(value) {
  if (!value) return null;

  const text = String(value).trim();
  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const year = Number.parseInt(dateOnly[1], 10);
    const month = Number.parseInt(dateOnly[2], 10);
    const day = Number.parseInt(dateOnly[3], 10);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function filterByDateRange(items, dateFrom, dateTo, dayType = "all") {
  const df = parseDateFilterInput(dateFrom);
  const dt = parseDateFilterInput(dateTo);
  const mode = normalizeDayTypeFilter(dayType);
  const hasDateRange = Boolean(df || dt);

  return items.filter((item) => {
    const d =
      item?.dateReal instanceof Date
        ? item.dateReal
        : item?.dateReal
          ? new Date(item.dateReal)
          : null;

    if (!d || Number.isNaN(d.getTime())) {
      return !hasDateRange && mode === "all";
    }

    if (df && d < df) return false;
    if (dt) {
      const end = new Date(dt);
      end.setHours(23, 59, 59, 999);
      if (d > end) return false;
    }
    return matchDayTypeFilter(d, mode);
  });
}

function buildDayKey(item) {
  const fromDateReal =
    item?.dateReal instanceof Date
      ? item.dateReal
      : item?.dateReal
        ? new Date(item.dateReal)
        : null;

  if (fromDateReal && !Number.isNaN(fromDateReal.getTime())) {
    const yyyy = fromDateReal.getFullYear();
    const mm = `${fromDateReal.getMonth() + 1}`.padStart(2, "0");
    const dd = `${fromDateReal.getDate()}`.padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const raw = String(item?.data || "").trim();
  if (!raw) return null;

  const csvMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (csvMatch) {
    const dd = csvMatch[1].padStart(2, "0");
    const mm = csvMatch[2].padStart(2, "0");
    const yyyy = csvMatch[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  const parsedPt = parseDataPt(raw);
  if (parsedPt && !Number.isNaN(parsedPt.getTime())) {
    const yyyy = parsedPt.getFullYear();
    const mm = `${parsedPt.getMonth() + 1}`.padStart(2, "0");
    const dd = `${parsedPt.getDate()}`.padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return raw;
}

export function buildKpis(fCons, fTickets) {
  const tc = fCons.reduce((a, c) => a + c.total, 0);
  const ta = fCons.reduce((a, c) => a + c.atendidas, 0);
  const tab = fCons.reduce((a, c) => a + c.abandonadas + c.naoAtendidas, 0);
  const uniqueDays = new Set();
  fCons.forEach((item) => {
    const key = buildDayKey(item);
    if (key) uniqueDays.add(key);
  });
  const dias = uniqueDays.size;
  const tma = fCons.length
    ? Math.round(fCons.reduce((a, c) => a + c.tma, 0) / fCons.length)
    : 0;
  const tme = fCons.length
    ? Math.round(fCons.reduce((a, c) => a + c.tme, 0) / fCons.length)
    : 0;

  return {
    tc,
    ta,
    tab,
    tma,
    tme,
    txAt: tc ? ta / tc : 0,
    txAband: tc ? tab / tc : 0,
    tkt: fTickets.length,
    tktF: fTickets.filter((t) => t.status === "Fechado").length,
    tktA: fTickets.filter((t) => t.status === "Aberto").length,
    tktTransf: fTickets.filter(isTransferencia).length,
    tktErros: fTickets.filter(isErroApp).length,
    dias,
  };
}

export function aggregateBy(arr, key) {
  const map = {};
  arr.forEach((item) => {
    const k = typeof key === "function" ? key(item) : item[key];
    if (k && k !== "-") map[k] = (map[k] || 0) + 1;
  });

  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));
}

export function buildEquipeData(fAtend, fTickets) {
  return Object.entries(AGENT_MAP)
    .map(([fn, en]) => {
      const fa = fAtend.filter((a) => a.ramal === fn);
      const ft = fTickets.filter((t) => t.responsavel === en);
      const ca = fa.reduce((a, c) => a + c.atendidas, 0);

      return {
        nome: fn.replace(" - Central", ""),
        chamAtend: ca,
        tickets: ft.length,
        tktAbertos: ft.filter((t) => t.status === "Aberto").length,
        total: ca + ft.length,
        tma: fa.length
          ? Math.round(fa.reduce((a, c) => a + c.tma, 0) / fa.length)
          : 0,
        tme: fa.length
          ? Math.round(fa.reduce((a, c) => a + c.tme, 0) / fa.length)
          : 0,
        transferencias: ft.filter(isTransferencia).length,
        errosApp: ft.filter(isErroApp).length,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export function buildDailyChart(fCons) {
  return fCons.map((c) => {
    let dia = c.data.replace(/ de /, "/ ");
    MONTH_LABELS.forEach(([from, to]) => {
      dia = dia.replace(from, to);
    });

    return {
      dia,
      Total: c.total,
      Atendidas: c.atendidas,
      TMA: c.tma,
      TME: c.tme,
      "Tx Atend": c.total ? c.atendidas / c.total : 0,
    };
  });
}
