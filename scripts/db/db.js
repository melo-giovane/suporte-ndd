import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { hashPassword } from "./auth.js";

const DB_MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(DB_MODULE_DIR, "../..");

export const DEFAULT_DB_PATH = path.resolve(
  PROJECT_ROOT,
  "data/sqlite/central_relacionamentos.db",
);

const DEFAULT_ATTENDANTS = [
  {
    name: "Gessica Freitas Becker",
    atplus_alias: "Gessica Freitas Becker",
    tickets_alias: "GESSICA FREITAS BECKER",
  },
  {
    name: "Matheus Lucas de Carvalho",
    atplus_alias: "Matheus - Central",
    tickets_alias: "Matheus Lucas de Carvalho",
  },
  {
    name: "Isaque de Oliveira dos Santos",
    atplus_alias: "Isaque - Central",
    tickets_alias: "Isaque de Oliveira dos Santos",
  },
  {
    name: "Marcos Costa",
    atplus_alias: "Marcos - Central",
    tickets_alias: "Marcos Costa",
  },
  {
    name: "Diego Dias Fernandes",
    atplus_alias: "Diego - Central",
    tickets_alias: "Diego Dias Fernandes",
  },
];

const DEFAULT_TICKET_GOAL_PCT = 20;
const DEFAULT_ALERT_TKT_ABERTOS_LIMIT = 3;
const DEFAULT_ALERT_TMA_LIMIT_SEC = 300;

export function listAttendants(db) {
  return db
    .prepare(
      `
      SELECT
        id,
        name,
        atplus_alias AS atplusAlias,
        tickets_alias AS ticketsAlias,
        created_at AS createdAt
      FROM attendants
      ORDER BY name COLLATE NOCASE
    `,
    )
    .all();
}

export function saveAttendant(db, attendant) {
  const idRaw = attendant?.id;
  const id =
    idRaw === null || idRaw === undefined || idRaw === ""
      ? null
      : Number.parseInt(String(idRaw), 10);
  const name = String(attendant?.name || "").trim();
  const atplusAlias = String(
    attendant?.atplusAlias ?? attendant?.atplus_alias ?? "",
  ).trim();
  const ticketsAlias = String(
    attendant?.ticketsAlias ?? attendant?.tickets_alias ?? "",
  ).trim();

  if (!name || !atplusAlias || !ticketsAlias) {
    throw new Error("Informe nome, apelido AtPlus e apelido Ellevo.");
  }

  if (Number.isInteger(id)) {
    db.prepare(
      `
      UPDATE attendants
      SET name = ?, atplus_alias = ?, tickets_alias = ?
      WHERE id = ?
    `,
    ).run(name, atplusAlias, ticketsAlias, id);

    return db
      .prepare(
        `
        SELECT
          id,
          name,
          atplus_alias AS atplusAlias,
          tickets_alias AS ticketsAlias,
          created_at AS createdAt
        FROM attendants
        WHERE id = ?
      `,
      )
      .get(id);
  }

  db.prepare(
    `
    INSERT INTO attendants (name, atplus_alias, tickets_alias)
    VALUES (?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      atplus_alias = excluded.atplus_alias,
      tickets_alias = excluded.tickets_alias
  `,
  ).run(name, atplusAlias, ticketsAlias);

  return db
    .prepare(
      `
      SELECT
        id,
        name,
        atplus_alias AS atplusAlias,
        tickets_alias AS ticketsAlias,
        created_at AS createdAt
      FROM attendants
      WHERE name = ? COLLATE NOCASE
    `,
    )
    .get(name);
}

export function clearAttendants(db) {
  const transaction = db.transaction(() => {
    db.prepare(
      `
      UPDATE users
      SET attendant_id = NULL,
          attendant_ramal = NULL,
          attendant_responsavel = NULL
      WHERE attendant_id IS NOT NULL
         OR attendant_ramal IS NOT NULL
         OR attendant_responsavel IS NOT NULL
    `,
    ).run();

    db.prepare("DELETE FROM attendants").run();
  });
  transaction();
}

export function seedDefaultAttendants(db) {
  DEFAULT_ATTENDANTS.forEach((attendant) => {
    saveAttendant(db, attendant);
  });
}

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
      hora INTEGER,
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
      hora INTEGER,
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
      produto TEXT,
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

    CREATE TABLE IF NOT EXISTS chamados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL, -- 'call' or 'ticket'
      orig_id TEXT, -- optional id from source table
      chamado TEXT, -- ticket id when available
      data_key TEXT,
      date_real TEXT,
      hora INTEGER,
      fila TEXT,
      ramal TEXT,
      responsavel TEXT,
      status TEXT,
      categoria TEXT,
      titulo TEXT,
      descricao TEXT,
      raw_json TEXT,
      source_file TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_chamados_date_real
      ON chamados (date_real);

    CREATE INDEX IF NOT EXISTS idx_chamados_responsavel
      ON chamados (responsavel);

    CREATE TABLE IF NOT EXISTS attendants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      atplus_alias TEXT UNIQUE COLLATE NOCASE,
      tickets_alias TEXT UNIQUE COLLATE NOCASE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_attendants_name
      ON attendants (name);

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('master', 'atendente')),
      attendant_id INTEGER,
      attendant_ramal TEXT,
      attendant_responsavel TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (attendant_id) REFERENCES attendants (id)
    );

    CREATE INDEX IF NOT EXISTS idx_users_role
      ON users (role);

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Lightweight migration for legacy databases where ticket detail columns
  // may be missing or named with accented identifiers.
  const ticketCols = db
    .prepare("PRAGMA table_info(ellevo_tickets)")
    .all()
    .map((c) => c.name);

  const consCols = db
    .prepare("PRAGMA table_info(atplus_cons_daily)")
    .all()
    .map((c) => c.name);

  if (!consCols.includes("hora")) {
    db.exec("ALTER TABLE atplus_cons_daily ADD COLUMN hora INTEGER");
  }

  const atendCols = db
    .prepare("PRAGMA table_info(atplus_attendant_daily)")
    .all()
    .map((c) => c.name);

  if (!atendCols.includes("hora")) {
    db.exec("ALTER TABLE atplus_attendant_daily ADD COLUMN hora INTEGER");
  }

  if (!ticketCols.includes("tramites")) {
    db.exec("ALTER TABLE ellevo_tickets ADD COLUMN tramites TEXT");
  }
  if (!ticketCols.includes("produto")) {
    db.exec("ALTER TABLE ellevo_tickets ADD COLUMN produto TEXT");
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

  const userCols = db
    .prepare("PRAGMA table_info(users)")
    .all()
    .map((c) => c.name);

  if (!userCols.includes("attendant_ramal")) {
    db.exec("ALTER TABLE users ADD COLUMN attendant_ramal TEXT");
  }
  if (!userCols.includes("attendant_responsavel")) {
    db.exec("ALTER TABLE users ADD COLUMN attendant_responsavel TEXT");
  }
  if (!userCols.includes("attendant_id")) {
    db.exec("ALTER TABLE users ADD COLUMN attendant_id INTEGER");
  }
  if (!userCols.includes("is_active")) {
    db.exec(
      "ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1",
    );
  }

  db.prepare(
    `
      INSERT INTO app_settings (key, value)
      VALUES ('ticket_goal_pct', ?)
      ON CONFLICT(key) DO NOTHING
    `,
  ).run(String(DEFAULT_TICKET_GOAL_PCT));

  db.prepare(
    `
      INSERT INTO app_settings (key, value)
      VALUES ('alert_tkt_abertos_limit', ?)
      ON CONFLICT(key) DO NOTHING
    `,
  ).run(String(DEFAULT_ALERT_TKT_ABERTOS_LIMIT));

  db.prepare(
    `
      INSERT INTO app_settings (key, value)
      VALUES ('alert_tma_limit_sec', ?)
      ON CONFLICT(key) DO NOTHING
    `,
  ).run(String(DEFAULT_ALERT_TMA_LIMIT_SEC));

  db.exec(`
    UPDATE users
    SET attendant_id = (
      SELECT a.id
      FROM attendants a
      WHERE (
        users.attendant_ramal IS NOT NULL
        AND TRIM(users.attendant_ramal) <> ''
        AND a.atplus_alias = users.attendant_ramal COLLATE NOCASE
      )
      OR (
        users.attendant_responsavel IS NOT NULL
        AND TRIM(users.attendant_responsavel) <> ''
        AND a.tickets_alias = users.attendant_responsavel COLLATE NOCASE
      )
      LIMIT 1
    )
    WHERE users.role = 'atendente'
      AND users.attendant_id IS NULL
  `);

  const masterCount = db
    .prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'master'")
    .get()?.total;

  if (!masterCount) {
    const defaultMasterUser = process.env.DEFAULT_MASTER_USER || "master";
    const defaultMasterPassword =
      process.env.DEFAULT_MASTER_PASSWORD || "master123";

    db.prepare(
      `
      INSERT INTO users (
        username,
        password_hash,
        role,
        attendant_id,
        attendant_ramal,
        attendant_responsavel,
        is_active
      )
      VALUES (?, ?, 'master', NULL, NULL, NULL, 1)
    `,
    ).run(defaultMasterUser, hashPassword(defaultMasterPassword));

    console.log(
      `[db] Usuário master inicial criado: ${defaultMasterUser} (altere a senha após o primeiro acesso).`,
    );
  }
}
