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

export function filterByDateRange(items, dateFrom, dateTo) {
  const df = dateFrom ? new Date(dateFrom) : null;
  const dt = dateTo ? new Date(dateTo) : null;

  return items.filter((item) => {
    const d = item.dateReal;
    if (!d) return true;
    if (df && d < df) return false;
    if (dt) {
      const end = new Date(dt);
      end.setHours(23, 59, 59);
      if (d > end) return false;
    }
    return true;
  });
}

export function buildKpis(fCons, fTickets) {
  const tc = fCons.reduce((a, c) => a + c.total, 0);
  const ta = fCons.reduce((a, c) => a + c.atendidas, 0);
  const tab = fCons.reduce((a, c) => a + c.abandonadas + c.naoAtendidas, 0);
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
    dias: fCons.length,
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
