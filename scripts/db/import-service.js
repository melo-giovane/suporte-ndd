import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { DEFAULT_DB_PATH, ensureSchema, openDatabase } from "./db.js";
import { parseDashboardWorkbook } from "./parser.js";

const XLSX_RUNTIME = XLSX.readFile ? XLSX : XLSX.default;

export function importDashboardToSqlite({
  inputFile,
  dbPath = DEFAULT_DB_PATH,
  referenceYear = new Date().getFullYear(),
  onlyNew = false,
}) {
  const resolvedInput = path.resolve(inputFile);
  if (!fs.existsSync(resolvedInput)) {
    throw new Error(`Arquivo de entrada não encontrado: ${resolvedInput}`);
  }

  const resolvedDb = path.resolve(dbPath);
  const wb = XLSX_RUNTIME.readFile(resolvedInput, {
    cellDates: true,
    raw: true,
  });
  const parsed = parseDashboardWorkbook(XLSX_RUNTIME, wb, referenceYear);

  const db = openDatabase(resolvedDb);
  ensureSchema(db);

  const upsertCons = db.prepare(`
    INSERT INTO atplus_cons_daily (
      data_key, data_label, date_real, fila,
      total_chamadas, chamadas_atendidas, chamadas_capturadas,
      chamadas_nao_atendidas, chamadas_abandonadas, tx_abandono_na,
      tma_seg, tme_seg, source_file
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(data_key, fila) DO UPDATE SET
      data_label = excluded.data_label,
      date_real = excluded.date_real,
      total_chamadas = excluded.total_chamadas,
      chamadas_atendidas = excluded.chamadas_atendidas,
      chamadas_capturadas = excluded.chamadas_capturadas,
      chamadas_nao_atendidas = excluded.chamadas_nao_atendidas,
      chamadas_abandonadas = excluded.chamadas_abandonadas,
      tx_abandono_na = excluded.tx_abandono_na,
      tma_seg = excluded.tma_seg,
      tme_seg = excluded.tme_seg,
      source_file = excluded.source_file,
      updated_at = datetime('now')
  `);

  const upsertAtend = db.prepare(`
    INSERT INTO atplus_attendant_daily (
      data_key, data_label, date_real, fila, ramal,
      total_tentativas, tentativas_atendidas, tentativas_perdidas,
      chamadas_capturadas, tma_seg, tme_seg, source_file
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(data_key, fila, ramal) DO UPDATE SET
      data_label = excluded.data_label,
      date_real = excluded.date_real,
      total_tentativas = excluded.total_tentativas,
      tentativas_atendidas = excluded.tentativas_atendidas,
      tentativas_perdidas = excluded.tentativas_perdidas,
      chamadas_capturadas = excluded.chamadas_capturadas,
      tma_seg = excluded.tma_seg,
      tme_seg = excluded.tme_seg,
      source_file = excluded.source_file,
      updated_at = datetime('now')
  `);

  const upsertTicket = db.prepare(`
    INSERT INTO ellevo_tickets (
      chamado, data_abertura, data_fechamento, status, titulo,
      categoria_raw, categoria_normalizada, cliente, modulo, natureza,
      responsavel, qualificacao, severidade, trâmites, descricao,
      tempo_chamado_raw, source_file
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(chamado) DO UPDATE SET
      data_abertura = excluded.data_abertura,
      data_fechamento = excluded.data_fechamento,
      status = excluded.status,
      titulo = excluded.titulo,
      categoria_raw = excluded.categoria_raw,
      categoria_normalizada = excluded.categoria_normalizada,
      cliente = excluded.cliente,
      modulo = excluded.modulo,
      natureza = excluded.natureza,
      responsavel = excluded.responsavel,
      qualificacao = excluded.qualificacao,
      severidade = excluded.severidade,
      trâmites = excluded.trâmites,
      descricao = excluded.descricao,
      tempo_chamado_raw = excluded.tempo_chamado_raw,
      source_file = excluded.source_file,
      updated_at = datetime('now')
  `);

  const insertRun = db.prepare(`
    INSERT INTO import_runs (
      source_file, source_file_mtime, reference_year,
      cons_rows, atend_rows, ticket_rows
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  const existsCons = db.prepare(`
    SELECT 1
    FROM atplus_cons_daily
    WHERE data_key = ? AND fila = ?
    LIMIT 1
  `);

  const existsAtend = db.prepare(`
    SELECT 1
    FROM atplus_attendant_daily
    WHERE data_key = ? AND fila = ? AND ramal = ?
    LIMIT 1
  `);

  const existsTicket = db.prepare(`
    SELECT 1
    FROM ellevo_tickets
    WHERE chamado = ?
    LIMIT 1
  `);

  let counters = null;

  const trx = db.transaction((payload) => {
    const source = {
      cons: payload.consRows.length,
      atend: payload.atendRows.length,
      tickets: payload.ticketRows.length,
    };

    const consRows = onlyNew
      ? payload.consRows.filter((row) => !existsCons.get(row.dataKey, row.fila))
      : payload.consRows;

    const atendRows = onlyNew
      ? payload.atendRows.filter(
          (row) => !existsAtend.get(row.dataKey, row.fila, row.ramal),
        )
      : payload.atendRows;

    const ticketRows = onlyNew
      ? payload.ticketRows.filter((row) => !existsTicket.get(row.chamado))
      : payload.ticketRows;

    consRows.forEach((row) => {
      upsertCons.run(
        row.dataKey,
        row.dataLabel,
        row.dateReal,
        row.fila,
        row.totalChamadas,
        row.chamadasAtendidas,
        row.chamadasCapturadas,
        row.chamadasNaoAtendidas,
        row.chamadasAbandonadas,
        row.txAbandonoNa,
        row.tmaSeg,
        row.tmeSeg,
        resolvedInput,
      );
    });

    atendRows.forEach((row) => {
      upsertAtend.run(
        row.dataKey,
        row.dataLabel,
        row.dateReal,
        row.fila,
        row.ramal,
        row.totalTentativas,
        row.tentativasAtendidas,
        row.tentativasPerdidas,
        row.chamadasCapturadas,
        row.tmaSeg,
        row.tmeSeg,
        resolvedInput,
      );
    });

    ticketRows.forEach((row) => {
      upsertTicket.run(
        row.chamado,
        row.dataAbertura,
        row.dataFechamento,
        row.status,
        row.titulo,
        row.categoriaRaw,
        row.categoriaNormalizada,
        row.cliente,
        row.modulo,
        row.natureza,
        row.responsavel,
        row.qualificacao,
        row.severidade,
        row.tramites,
        row.descricao,
        row.tempoChamadoRaw,
        resolvedInput,
      );
    });

    const stat = fs.statSync(resolvedInput);
    insertRun.run(
      resolvedInput,
      stat.mtime.toISOString(),
      referenceYear,
      consRows.length,
      atendRows.length,
      ticketRows.length,
    );

    counters = {
      source,
      imported: {
        cons: consRows.length,
        atend: atendRows.length,
        tickets: ticketRows.length,
      },
      skipped: {
        cons: source.cons - consRows.length,
        atend: source.atend - atendRows.length,
        tickets: source.tickets - ticketRows.length,
      },
    };
  });

  trx(parsed);

  return {
    dbPath: resolvedDb,
    inputFile: resolvedInput,
    referenceYear,
    mode: onlyNew ? "only-new" : "upsert-all",
    consRows: counters?.imported.cons ?? 0,
    atendRows: counters?.imported.atend ?? 0,
    ticketRows: counters?.imported.tickets ?? 0,
    sourceConsRows: counters?.source.cons ?? 0,
    sourceAtendRows: counters?.source.atend ?? 0,
    sourceTicketRows: counters?.source.tickets ?? 0,
    skippedConsRows: counters?.skipped.cons ?? 0,
    skippedAtendRows: counters?.skipped.atend ?? 0,
    skippedTicketRows: counters?.skipped.tickets ?? 0,
  };
}
