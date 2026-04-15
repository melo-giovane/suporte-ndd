export const MONTHS_PT = {
  Janeiro: 1,
  Fevereiro: 2,
  Março: 3,
  Abril: 4,
  Maio: 5,
  Junho: 6,
  Julho: 7,
  Agosto: 8,
  Setembro: 9,
  Outubro: 10,
  Novembro: 11,
  Dezembro: 12,
};

export const AGENT_MAP = {
  "Marcos - Central": "Marcos Costa",
  "Gessica Freitas Becker": "GESSICA FREITAS BECKER",
  "Matheus - Central": "Matheus Lucas de Carvalho",
  "Isaque - Central": "Isaque de Oliveira dos Santos",
  "Diego - Central": "Diego Dias Fernandes",
};

export function parseDataPt(s) {
  if (!s) return null;
  for (const [m, n] of Object.entries(MONTHS_PT)) {
    if (s.includes(m)) {
      const d = parseInt(s);
      if (d) return new Date(2026, n - 1, d);
    }
  }
  return null;
}

export function parseSec(v) {
  if (!v) return 0;
  const s = String(v).replace(/\xa0/g, " ");
  const m = s.match(/^(\d+)\s*s?$/);
  return m ? parseInt(m[1]) : parseInt(s) || 0;
}

export function fmtSec(s) {
  return s >= 60 ? `${Math.floor(s / 60)}m${s % 60}s` : `${s}s`;
}

export function fmtPct(v) {
  return `${(v * 100).toFixed(1)}%`;
}

export function normalize(cat) {
  if (!cat) return "Outros";
  const u = cat.toUpperCase();
  if (/TRANSFER|TRASFER/.test(u)) return "Transferência";
  if (/CONSULTA|SALDO/.test(u)) return "Consulta Saldo";
  if (
    /APLICATIVO|ACESSO|BLOQUEIO|LIBERA|RESET|SENHA|USUARIO|DISPOSITIVO|CONGELAD|TRAVAD|AGUARDE|INATIVIDADE|STATUS|VAZAMENTO|VERIFICA/.test(
      u,
    )
  )
    return "Acesso/App";
  if (/PIX|PAGAMENTO/.test(u)) return "PIX/TED";
  if (/CADASTRO|CONTA|ABERTURA/.test(u)) return "Cadastro";
  if (/CANCELAMENTO|CARTÃO|CARTAO/.test(u)) return "Cancelamento";
  if (/EXTRATO|RELAT|INFORME|RENDIMENTO/.test(u)) return "Relatório/Extrato";
  if (/SUPORTE|CONTRATANTE/.test(u)) return "Suporte";
  if (/INFORMA|VALE|PEDÁGIO|PEDAGIO/.test(u)) return "Informação";
  if (/COMERCIAL/.test(u)) return "Comercial";
  if (/SOLICITA/.test(u)) return "Solicitação";
  if (/INCIDENTE|FALHA|DÉBITO|DEBITO/.test(u)) return "Incidente";
  return "Outros";
}

export function splitTitulo(t) {
  if (!t) return ["", ""];
  const s = t.replace(/\xa0/g, " ");
  if (s.includes(" - ")) {
    const p = s.split(" - ", 2);
    return [p[0].trim(), p[1]?.trim() || ""];
  }
  if (s.includes("/")) {
    const p = s.split("/", 2);
    return [p[0].trim(), p[1]?.trim() || ""];
  }
  return [s.trim(), ""];
}

// Predicados das métricas novas (espelham os filtros dos useMemo de kpis e equipe)
export function isTransferencia(ticket) {
  return ticket.categoria === "Transferência";
}

export function isErroApp(ticket) {
  return ticket.categoria === "Acesso/App" || ticket.natureza === "Problema Ndd";
}
