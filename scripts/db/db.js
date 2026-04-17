import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export const DEFAULT_DB_PATH = path.resolve(
  process.cwd(),
  "data/sqlite/central_relacionamentos.db",
);

export function openDatabase(dbPath = DEFAULT_DB_PATH) {
  const resolved = path.resolve(dbPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  const db = new Database(resolved);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS import_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_file TEXT NOT NULL,
      source_file_mtime TEXT,
      reference_year INTEGER,
      imported_at TEXT NOT NULL DEFAULT (datetime('now')),
      cons_rows INTEGER NOT NULL DEFAULT 0,
      atend_rows INTEGER NOT NULL DEFAULT 0,
      ticket_rows INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS atplus_cons_daily (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data_key TEXT NOT NULL,
      data_label TEXT NOT NULL,
      date_real TEXT,
      fila TEXT,
      total_chamadas INTEGER NOT NULL DEFAULT 0,
      chamadas_atendidas INTEGER NOT NULL DEFAULT 0,
      chamadas_capturadas INTEGER NOT NULL DEFAULT 0,
      chamadas_nao_atendidas INTEGER NOT NULL DEFAULT 0,
      chamadas_abandonadas INTEGER NOT NULL DEFAULT 0,
      tx_abandono_na REAL,
      tma_seg INTEGER NOT NULL DEFAULT 0,
      tme_seg INTEGER NOT NULL DEFAULT 0,
      source_file TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (data_key, fila)
    );

    CREATE INDEX IF NOT EXISTS idx_atplus_cons_date_real
      ON atplus_cons_daily (date_real);

    CREATE TABLE IF NOT EXISTS atplus_attendant_daily (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data_key TEXT NOT NULL,
      data_label TEXT NOT NULL,
      date_real TEXT,
      fila TEXT,
      ramal TEXT NOT NULL,
      total_tentativas INTEGER NOT NULL DEFAULT 0,
      tentativas_atendidas INTEGER NOT NULL DEFAULT 0,
      tentativas_perdidas INTEGER NOT NULL DEFAULT 0,
      chamadas_capturadas INTEGER NOT NULL DEFAULT 0,
      tma_seg INTEGER NOT NULL DEFAULT 0,
      tme_seg INTEGER NOT NULL DEFAULT 0,
      source_file TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (data_key, fila, ramal)
    );

    CREATE INDEX IF NOT EXISTS idx_atplus_atend_date_real
      ON atplus_attendant_daily (date_real);

    CREATE TABLE IF NOT EXISTS ellevo_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chamado TEXT NOT NULL UNIQUE,
      data_abertura TEXT,
      data_fechamento TEXT,
      status TEXT,
      titulo TEXT,
      categoria_raw TEXT,
      categoria_normalizada TEXT,
      cliente TEXT,
      modulo TEXT,
      natureza TEXT,
      responsavel TEXT,
      qualificacao TEXT,
      severidade TEXT,
      tramites TEXT,
      descricao TEXT,
      tempo_chamado_raw TEXT,
      source_file TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_ellevo_data_abertura
      ON ellevo_tickets (data_abertura);

    CREATE INDEX IF NOT EXISTS idx_ellevo_status
      ON ellevo_tickets (status);

    CREATE INDEX IF NOT EXISTS idx_ellevo_responsavel
      ON ellevo_tickets (responsavel);
  `);

  // Lightweight migration for legacy databases where ticket detail columns
  // may be missing or named with accented identifiers.
  const ticketCols = db
    .prepare("PRAGMA table_info(ellevo_tickets)")
    .all()
    .map((c) => c.name);

  if (!ticketCols.includes("tramites")) {
    db.exec("ALTER TABLE ellevo_tickets ADD COLUMN tramites TEXT");
  }
  if (!ticketCols.includes("descricao")) {
    db.exec("ALTER TABLE ellevo_tickets ADD COLUMN descricao TEXT");
  }
  if (!ticketCols.includes("tempo_chamado_raw")) {
    db.exec("ALTER TABLE ellevo_tickets ADD COLUMN tempo_chamado_raw TEXT");
  }

  if (ticketCols.includes("trâmites")) {
    db.exec(`
      UPDATE ellevo_tickets
      SET tramites = COALESCE(NULLIF(tramites, ''), "trâmites")
      WHERE (tramites IS NULL OR tramites = '')
        AND "trâmites" IS NOT NULL
        AND "trâmites" <> ''
    `);
  }
}
