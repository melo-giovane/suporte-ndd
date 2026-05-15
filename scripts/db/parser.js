import { normalize, splitTitulo } from "../../src/utils.js";

const MONTHS_PT = {
  janeiro: 1,
  fevereiro: 2,
  março: 3,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

function parseIntSafe(value) {
  const n = Number.parseInt(String(value ?? "").replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function parseNumberSafe(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value).trim();
  const hasPercent = raw.includes("%");
  const normalized = raw
    .trim()
    .replace(/\s+/g, "")
    .replace("%", "")
    .replace(",", ".");
  const n = Number.parseFloat(normalized);
  if (!Number.isFinite(n)) return 0;
  return hasPercent ? n / 100 : n;
}

function parseSec(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Math.round(value);
  return parseIntSafe(String(value).replace(/\xa0/g, " "));
}

function parseDatePt(value, referenceYear) {
  if (!value) return null;
  const txt = String(value).trim().replace(/\xa0/g, " ");
  const match = txt.match(/^(\d{1,2})\s+de\s+([A-Za-zÀ-ÿ]+)$/i);
  if (!match) return null;

  const day = Number.parseInt(match[1], 10);
  const monthName = match[2].toLowerCase();
  const month = MONTHS_PT[monthName];
  if (!month || !day) return null;

  const d = new Date(referenceYear, month - 1, day);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseAtplusDateHour(value, referenceYear) {
  if (!value && value !== 0) {
    return { date: null, hour: null, isCsv: false };
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      date: new Date(value.getFullYear(), value.getMonth(), value.getDate()),
      hour: value.getHours(),
      isCsv: true,
    };
  }

  const txt = String(value).trim().replace(/\xa0/g, " ");
  const csv = txt.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2})(?::\d{1,2})?(?::\d{1,2})?)?$/,
  );

  if (csv) {
    const day = Number.parseInt(csv[1], 10);
    const month = Number.parseInt(csv[2], 10);
    const year = Number.parseInt(csv[3], 10);
    const hour = csv[4] == null ? null : Number.parseInt(csv[4], 10);

    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) {
      return { date: null, hour: null, isCsv: true };
    }

    return {
      date,
      hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null,
      isCsv: true,
    };
  }

  const legacyDate = parseDatePt(txt, referenceYear);
  return {
    date: legacyDate,
    hour: null,
    isCsv: false,
  };
}

function buildAtplusDataKey({ dataLabel, date, isCsv, referenceYear }) {
  if (isCsv) {
    // Keep compatibility with previous imports that used a fallback key.
    return `${referenceYear}:${dataLabel}`;
  }

  return toIsoDate(date) || `${referenceYear}:${dataLabel}`;
}

function toIsoDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function toIsoDateTime(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function parseDashboardWorkbook(XLSX, workbook, referenceYear) {
  const wsCons = workbook.Sheets["Cola_Atplus_Cons"];
  const wsAtend = workbook.Sheets["Cola_Atplus_Atend"];
  const wsTickets = workbook.Sheets["Cola_Ellevo"];

  const consRows = wsCons
    ? XLSX.utils
        .sheet_to_json(wsCons, { header: 1, range: 3, raw: true })
        .filter((r) => r[0])
        .map((r) => {
          const dataLabel = String(r[0]).trim();
          const parsedDate = parseAtplusDateHour(dataLabel, referenceYear);
          const dataKey = buildAtplusDataKey({
            dataLabel,
            date: parsedDate.date,
            isCsv: parsedDate.isCsv,
            referenceYear,
          });

          return {
            dataKey,
            dataLabel,
            dateReal: toIsoDate(parsedDate.date),
            hora: parsedDate.hour,
            fila: String(r[1] || "").trim(),
            totalChamadas: parseIntSafe(r[2]),
            chamadasAtendidas: parseIntSafe(r[3]),
            chamadasCapturadas: parseIntSafe(r[4]),
            chamadasNaoAtendidas: parseIntSafe(r[5]),
            chamadasAbandonadas: parseIntSafe(r[6]),
            txAbandonoNa: parseNumberSafe(r[7]),
            tmaSeg: parseSec(r[8]),
            tmeSeg: parseSec(r[9]),
          };
        })
    : [];

  const atendRows = wsAtend
    ? XLSX.utils
        .sheet_to_json(wsAtend, { header: 1, range: 3, raw: true })
        .filter((r) => r[0] && r[2])
        .map((r) => {
          const dataLabel = String(r[0]).trim();
          const parsedDate = parseAtplusDateHour(dataLabel, referenceYear);
          const dataKey = buildAtplusDataKey({
            dataLabel,
            date: parsedDate.date,
            isCsv: parsedDate.isCsv,
            referenceYear,
          });

          return {
            dataKey,
            dataLabel,
            dateReal: toIsoDate(parsedDate.date),
            hora: parsedDate.hour,
            fila: String(r[1] || "").trim(),
            ramal: String(r[2] || "").trim(),
            totalTentativas: parseIntSafe(r[3]),
            tentativasAtendidas: parseIntSafe(r[4]),
            tentativasPerdidas: parseIntSafe(r[5]),
            chamadasCapturadas: parseIntSafe(r[6]),
            tmaSeg: parseSec(r[7]),
            tmeSeg: parseSec(r[8]),
          };
        })
    : [];

  const ticketRows = wsTickets
    ? XLSX.utils
        .sheet_to_json(wsTickets, { header: 1, range: 3, raw: true })
        .filter((r) => r[0])
        .map((r) => {
          const titulo = String(r[3] || "");
          const [catRaw] = splitTitulo(titulo);
          const fechamento = r[1];
          const status =
            !fechamento || fechamento === "-" ? "Aberto" : "Fechado";

          return {
            chamado: String(r[0]).trim(),
            dataFechamento:
              fechamento && fechamento !== "-"
                ? toIsoDateTime(fechamento)
                : null,
            dataAbertura: toIsoDateTime(r[2]),
            status,
            titulo,
            categoriaRaw: catRaw,
            categoriaNormalizada: normalize(catRaw),
            cliente: String(r[4] || "").trim(),
            modulo: String(r[5] || "").trim(),
            natureza: String(r[6] || "").trim(),
            responsavel: String(r[7] || "").trim(),
            qualificacao: String(r[8] || "").trim(),
            severidade: String(r[9] || "").trim(),
            tramites: String(r[10] || ""),
            produto: String(r[11] || "").trim(),
            descricao: String(r[12] || ""),
            tempoChamadoRaw: String(r[13] || ""),
          };
        })
    : [];

  return { consRows, atendRows, ticketRows };
}
