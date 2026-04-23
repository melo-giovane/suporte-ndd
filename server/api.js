import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import express from "express";
import multer from "multer";
import { importDashboardToSqlite } from "../scripts/db/import-service.js";
import { PROJECT_ROOT, ensureSchema, openDatabase } from "../scripts/db/db.js";
import {
  createSessionToken,
  hashPassword,
  verifyPassword,
} from "../scripts/db/auth.js";

const app = express();
const PORT = Number.parseInt(process.env.API_PORT || "8787", 10);
const HOST = process.env.API_HOST || "0.0.0.0";
const uploadDir = path.resolve(PROJECT_ROOT, "data/input/uploads");
fs.mkdirSync(uploadDir, { recursive: true });
const sessions = new Map();
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MASTER_AUTO_SYNC_FILE = process.env.MASTER_AUTO_SYNC_FILE
  ? path.resolve(process.env.MASTER_AUTO_SYNC_FILE)
  : null;
const MASTER_AUTO_SYNC_ENABLED =
  MASTER_AUTO_SYNC_FILE !== null &&
  String(process.env.MASTER_AUTO_SYNC_ENABLED || "true").toLowerCase() !==
    "false";
const DEFAULT_TICKET_GOAL_PCT = 20;
const TICKET_GOAL_SETTING_KEY = "ticket_goal_pct";

app.use(express.json());

function sanitizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    attendantId: row.attendant_id || null,
    attendantName: row.attendant_name || null,
    attendantRamal: row.attendant_atplus_alias || row.attendant_ramal || null,
    attendantResponsavel:
      row.attendant_tickets_alias || row.attendant_responsavel || null,
    isActive: row.is_active === 1,
    createdAt: row.created_at || null,
  };
}

function parseReferenceYear(rawYear) {
  const parsed = Number.parseInt(String(rawYear || ""), 10);
  return Number.isInteger(parsed) ? parsed : new Date().getFullYear();
}

function syncMasterWorkbookIfNeeded() {
  if (!MASTER_AUTO_SYNC_ENABLED) {
    return { status: "disabled" };
  }

  if (!fs.existsSync(MASTER_AUTO_SYNC_FILE)) {
    return {
      status: "missing-file",
      sourceFile: MASTER_AUTO_SYNC_FILE,
    };
  }

  const sourceStat = fs.statSync(MASTER_AUTO_SYNC_FILE);
  const sourceMtimeMs = sourceStat.mtime.getTime();

  let db;
  try {
    db = openDatabase();
    ensureSchema(db);

    const latestRun = db
      .prepare(
        `
        SELECT
          source_file_mtime AS sourceFileMtime,
          imported_at AS importedAt
        FROM import_runs
        WHERE source_file = ?
        ORDER BY id DESC
        LIMIT 1
      `,
      )
      .get(MASTER_AUTO_SYNC_FILE);

    const importedMtimeMs = latestRun?.sourceFileMtime
      ? Date.parse(latestRun.sourceFileMtime)
      : Number.NaN;

    const isUpToDate =
      Number.isFinite(importedMtimeMs) && importedMtimeMs >= sourceMtimeMs;

    if (isUpToDate) {
      return {
        status: "up-to-date",
        sourceFile: MASTER_AUTO_SYNC_FILE,
        importedAt: latestRun?.importedAt || null,
      };
    }
  } finally {
    if (db) db.close();
  }

  const referenceYear = parseReferenceYear(
    process.env.MASTER_AUTO_SYNC_YEAR || new Date().getFullYear(),
  );

  const result = importDashboardToSqlite({
    inputFile: MASTER_AUTO_SYNC_FILE,
    referenceYear,
    onlyNew: false,
  });

  return {
    status: "imported",
    sourceFile: MASTER_AUTO_SYNC_FILE,
    result,
  };
}

function getBearerToken(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

function computeTeamTotals(db) {
  const callTotals = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(total_chamadas), 0) AS tc,
        COALESCE(SUM(chamadas_atendidas), 0) AS ta,
        COALESCE(SUM(chamadas_abandonadas + chamadas_nao_atendidas), 0) AS tab,
        CAST(ROUND(COALESCE(AVG(tma_seg), 0)) AS INTEGER) AS tma,
        CAST(ROUND(COALESCE(AVG(tme_seg), 0)) AS INTEGER) AS tme,
        COUNT(DISTINCT date_real) AS dias
      FROM atplus_cons_daily
    `,
    )
    .get();

  const ticketTotals = db
    .prepare(
      `
      SELECT
        COUNT(*) AS tkt,
        SUM(CASE WHEN status = 'Fechado' THEN 1 ELSE 0 END) AS tktF,
        SUM(CASE WHEN status = 'Aberto' THEN 1 ELSE 0 END) AS tktA,
        SUM(CASE WHEN categoria_normalizada = 'Transferência' THEN 1 ELSE 0 END) AS tktTransf,
        SUM(CASE WHEN categoria_normalizada = 'Acesso/App' OR natureza = 'Problema Ndd' THEN 1 ELSE 0 END) AS tktErros
      FROM ellevo_tickets
    `,
    )
    .get();

  const tc = callTotals?.tc || 0;
  const ta = callTotals?.ta || 0;
  const tab = callTotals?.tab || 0;

  return {
    tc,
    ta,
    tab,
    tma: callTotals?.tma || 0,
    tme: callTotals?.tme || 0,
    txAt: tc ? ta / tc : 0,
    txAband: tc ? tab / tc : 0,
    tkt: ticketTotals?.tkt || 0,
    tktF: ticketTotals?.tktF || 0,
    tktA: ticketTotals?.tktA || 0,
    tktTransf: ticketTotals?.tktTransf || 0,
    tktErros: ticketTotals?.tktErros || 0,
    dias: callTotals?.dias || 0,
  };
}

function normalizeTicketGoalPct(rawValue) {
  const parsed = Number.parseFloat(String(rawValue ?? "").replace(",", "."));
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0 || parsed > 100) return null;
  return Math.round(parsed * 100) / 100;
}

function readTicketGoalPct(db) {
  const row = db
    .prepare(
      `
        SELECT value
        FROM app_settings
        WHERE key = ?
        LIMIT 1
      `,
    )
    .get(TICKET_GOAL_SETTING_KEY);

  const parsed = normalizeTicketGoalPct(row?.value);
  return parsed ?? DEFAULT_TICKET_GOAL_PCT;
}

function saveTicketGoalPct(db, value) {
  db.prepare(
    `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = datetime('now')
    `,
  ).run(TICKET_GOAL_SETTING_KEY, String(value));
}

function requireAuth(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ ok: false, error: "Não autenticado." });
  }

  const session = sessions.get(token);
  if (!session?.userId) {
    return res.status(401).json({ ok: false, error: "Sessão inválida." });
  }

  if (Date.now() - new Date(session.createdAt).getTime() > SESSION_TTL_MS) {
    sessions.delete(token);
    return res.status(401).json({ ok: false, error: "Sessão expirada. Faça login novamente." });
  }

  let db;
  try {
    db = openDatabase();
    ensureSchema(db);

    const userRow = db
      .prepare(
        `
        SELECT
          u.id,
          u.username,
          u.role,
          u.attendant_id,
          u.attendant_ramal,
          u.attendant_responsavel,
          u.is_active,
          u.created_at,
          a.name AS attendant_name,
          a.atplus_alias AS attendant_atplus_alias,
          a.tickets_alias AS attendant_tickets_alias
        FROM users
        u
        LEFT JOIN attendants a ON a.id = u.attendant_id
        WHERE u.id = ?
        LIMIT 1
      `,
      )
      .get(session.userId);

    const user = sanitizeUser(userRow);
    if (!user || !user.isActive) {
      sessions.delete(token);
      return res.status(401).json({ ok: false, error: "Usuário inválido." });
    }

    req.authUser = user;
    req.authToken = token;
    return next();
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  } finally {
    if (db) db.close();
  }
}

function requireMaster(req, res, next) {
  if (req.authUser?.role !== "master") {
    return res.status(403).json({
      ok: false,
      error: "Acesso restrito ao perfil master.",
    });
  }
  return next();
}

function readDashboardData(db) {
  const cons = db
    .prepare(
      `
      SELECT
        data_label AS data,
        total_chamadas AS total,
        chamadas_atendidas AS atendidas,
        chamadas_nao_atendidas AS naoAtendidas,
        chamadas_abandonadas AS abandonadas,
        tx_abandono_na AS txAbandono,
        tma_seg AS tma,
        tme_seg AS tme,
        hora,
        date_real AS dateReal
      FROM atplus_cons_daily
      ORDER BY date_real, hora, data_label
    `,
    )
    .all();

  const atend = db
    .prepare(
      `
      SELECT
        data_label AS data,
        ramal,
        total_tentativas AS tentativas,
        tentativas_atendidas AS atendidas,
        tentativas_perdidas AS perdidas,
        tma_seg AS tma,
        tme_seg AS tme,
        hora,
        date_real AS dateReal
      FROM atplus_attendant_daily
      ORDER BY date_real, hora, ramal
    `,
    )
    .all();

  const tickets = db
    .prepare(
      `
      SELECT
        chamado,
        data_abertura AS dataAbertura,
        data_fechamento AS dataFechamento,
        status,
        titulo,
        categoria_raw AS categoriaRaw,
        natureza,
        responsavel,
        qualificacao,
        severidade,
        categoria_normalizada AS categoria,
        cliente,
        modulo,
        tramites,
        descricao,
        tempo_chamado_raw AS tempoChamadoRaw
      FROM ellevo_tickets
      ORDER BY data_abertura
    `,
    )
    .all();

  return { cons, atend, tickets };
}

function readDashboardDataForAttendant(db, user, scope) {
  const ramal = user.attendantRamal || null;
  const responsavel = user.attendantResponsavel || null;

  const teamCons = db
    .prepare(
      `
      SELECT
        data_label AS data,
        total_chamadas AS total,
        chamadas_atendidas AS atendidas,
        chamadas_nao_atendidas AS naoAtendidas,
        chamadas_abandonadas AS abandonadas,
        tx_abandono_na AS txAbandono,
        tma_seg AS tma,
        tme_seg AS tme,
        hora,
        date_real AS dateReal
      FROM atplus_cons_daily
      ORDER BY date_real, hora, data_label
    `,
    )
    .all();

  const teamTickets = db
    .prepare(
      `
      SELECT
        chamado,
        data_abertura AS dataAbertura,
        data_fechamento AS dataFechamento,
        status,
        titulo,
        categoria_raw AS categoriaRaw,
        natureza,
        responsavel,
        qualificacao,
        severidade,
        categoria_normalizada AS categoria,
        cliente,
        modulo,
        tramites,
        descricao,
        tempo_chamado_raw AS tempoChamadoRaw
      FROM ellevo_tickets
      ORDER BY data_abertura
    `,
    )
    .all();

  const ownCons = ramal
    ? db
        .prepare(
          `
          SELECT
            data_label AS data,
            SUM(total_tentativas) AS total,
            SUM(tentativas_atendidas) AS atendidas,
            SUM(tentativas_perdidas) AS naoAtendidas,
            0 AS abandonadas,
            CASE
              WHEN SUM(total_tentativas) = 0 THEN 0
              ELSE CAST(SUM(tentativas_perdidas) AS REAL) / SUM(total_tentativas)
            END AS txAbandono,
            CAST(ROUND(AVG(tma_seg)) AS INTEGER) AS tma,
            CAST(ROUND(AVG(tme_seg)) AS INTEGER) AS tme,
            hora,
            date_real AS dateReal
          FROM atplus_attendant_daily
          WHERE ramal = ?
          GROUP BY data_label, date_real, hora
          ORDER BY date_real, hora, data_label
        `,
        )
        .all(ramal)
    : [];

  const ownAtend = ramal
    ? db
        .prepare(
          `
          SELECT
            data_label AS data,
            ramal,
            total_tentativas AS tentativas,
            tentativas_atendidas AS atendidas,
            tentativas_perdidas AS perdidas,
            tma_seg AS tma,
            tme_seg AS tme,
            hora,
            date_real AS dateReal
          FROM atplus_attendant_daily
          WHERE ramal = ?
          ORDER BY date_real, hora, ramal
        `,
        )
        .all(ramal)
    : [];

  const ownTickets = responsavel
    ? db
        .prepare(
          `
          SELECT
            chamado,
            data_abertura AS dataAbertura,
            data_fechamento AS dataFechamento,
            status,
            titulo,
            categoria_raw AS categoriaRaw,
            natureza,
            responsavel,
            qualificacao,
            severidade,
            categoria_normalizada AS categoria,
            cliente,
            modulo,
            tramites,
            descricao,
            tempo_chamado_raw AS tempoChamadoRaw
          FROM ellevo_tickets
          WHERE responsavel = ?
          ORDER BY data_abertura
        `,
        )
        .all(responsavel)
    : [];

  if (scope === "team") {
    return {
      cons: teamCons,
      atend: [],
      tickets: teamTickets,
      ownCons,
      ownAtend,
      ownTickets,
    };
  }

  return {
    cons: ownCons,
    atend: ownAtend,
    tickets: ownTickets,
    teamCons,
    teamTickets,
  };
}

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

app.get("/api/health", (_, res) => {
  res.json({ ok: true, service: "central-relacionamentos-api" });
});

app.post("/api/auth/login", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");

  if (!username || !password) {
    return res.status(400).json({
      ok: false,
      error: "Informe usuário e senha.",
    });
  }

  let db;
  try {
    db = openDatabase();
    ensureSchema(db);

    const userRow = db
      .prepare(
        `
        SELECT
          u.id,
          u.username,
          u.password_hash,
          u.role,
          u.attendant_id,
          u.attendant_ramal,
          u.attendant_responsavel,
          u.is_active,
          u.created_at,
          a.name AS attendant_name,
          a.atplus_alias AS attendant_atplus_alias,
          a.tickets_alias AS attendant_tickets_alias
        FROM users u
        LEFT JOIN attendants a ON a.id = u.attendant_id
        WHERE u.username = ? COLLATE NOCASE
        LIMIT 1
      `,
      )
      .get(username);

    if (!userRow || userRow.is_active !== 1) {
      return res
        .status(401)
        .json({ ok: false, error: "Credenciais inválidas." });
    }

    if (!verifyPassword(password, userRow.password_hash)) {
      return res
        .status(401)
        .json({ ok: false, error: "Credenciais inválidas." });
    }

    if (userRow.role === "master") {
      try {
        const syncState = syncMasterWorkbookIfNeeded();

        if (syncState.status === "imported") {
          console.log(
            `[api] Auto-sync master executado: ${syncState.result.consRows} cons, ${syncState.result.atendRows} atend, ${syncState.result.ticketRows} tickets (${syncState.sourceFile})`,
          );
        } else if (syncState.status === "missing-file") {
          console.warn(
            `[api] Auto-sync master ignorado: arquivo não encontrado em ${syncState.sourceFile}`,
          );
        }
      } catch (syncError) {
        console.error(
          `[api] Falha no auto-sync master: ${syncError instanceof Error ? syncError.message : "Erro desconhecido"}`,
        );
      }
    }

    const token = createSessionToken();
    sessions.set(token, {
      userId: userRow.id,
      createdAt: new Date().toISOString(),
    });

    return res.json({
      ok: true,
      token,
      user: sanitizeUser(userRow),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  } finally {
    if (db) db.close();
  }
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  sessions.delete(req.authToken);
  res.json({ ok: true });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ ok: true, user: req.authUser });
});

app.get("/api/users", requireAuth, requireMaster, (_, res) => {
  let db;
  try {
    db = openDatabase();
    ensureSchema(db);

    const users = db
      .prepare(
        `
        SELECT
          u.id,
          u.username,
          u.role,
          u.attendant_id,
          u.attendant_ramal,
          u.attendant_responsavel,
          u.is_active,
          u.created_at,
          a.name AS attendant_name,
          a.atplus_alias AS attendant_atplus_alias,
          a.tickets_alias AS attendant_tickets_alias
        FROM users u
        LEFT JOIN attendants a ON a.id = u.attendant_id
        ORDER BY u.role DESC, u.username COLLATE NOCASE
      `,
      )
      .all()
      .map(sanitizeUser);

    return res.json({ ok: true, users });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  } finally {
    if (db) db.close();
  }
});

app.get("/api/users/link-options", requireAuth, requireMaster, (_, res) => {
  let db;
  try {
    db = openDatabase();
    ensureSchema(db);

    const attendants = db
      .prepare(
        `
        SELECT
          id,
          name,
          atplus_alias AS atplusAlias,
          tickets_alias AS ticketsAlias
        FROM attendants
        ORDER BY name COLLATE NOCASE
      `,
      )
      .all();

    return res.json({
      ok: true,
      options: {
        attendants,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  } finally {
    if (db) db.close();
  }
});

app.post("/api/users", requireAuth, requireMaster, (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const role = req.body?.role === "master" ? "master" : "atendente";
  const attendantIdRaw = req.body?.attendantId;
  const attendantId =
    attendantIdRaw === null ||
    attendantIdRaw === undefined ||
    attendantIdRaw === ""
      ? null
      : Number.parseInt(String(attendantIdRaw), 10);

  if (!username || password.length < 4) {
    return res.status(400).json({
      ok: false,
      error: "Informe usuário e senha com pelo menos 4 caracteres.",
    });
  }

  if (role === "atendente" && !Number.isInteger(attendantId)) {
    return res.status(400).json({
      ok: false,
      error: "Para perfil atendente, selecione um atendente cadastrado.",
    });
  }

  let db;
  try {
    db = openDatabase();
    ensureSchema(db);

    let attendant = null;
    if (role === "atendente") {
      attendant = db
        .prepare(
          `
          SELECT id, atplus_alias, tickets_alias
          FROM attendants
          WHERE id = ?
        `,
        )
        .get(attendantId);

      if (!attendant) {
        return res.status(400).json({
          ok: false,
          error: "Atendente selecionado não existe.",
        });
      }
    }

    const result = db
      .prepare(
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
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `,
      )
      .run(
        username,
        hashPassword(password),
        role,
        role === "atendente" ? attendant.id : null,
        role === "atendente" ? attendant.atplus_alias : null,
        role === "atendente" ? attendant.tickets_alias : null,
      );

    const created = db
      .prepare(
        `
        SELECT
          u.id,
          u.username,
          u.role,
          u.attendant_id,
          u.attendant_ramal,
          u.attendant_responsavel,
          u.is_active,
          u.created_at,
          a.name AS attendant_name,
          a.atplus_alias AS attendant_atplus_alias,
          a.tickets_alias AS attendant_tickets_alias
        FROM users u
        LEFT JOIN attendants a ON a.id = u.attendant_id
        WHERE u.id = ?
      `,
      )
      .get(result.lastInsertRowid);

    return res.json({ ok: true, user: sanitizeUser(created) });
  } catch (error) {
    const message =
      error instanceof Error && /UNIQUE/.test(error.message)
        ? "Já existe um usuário com esse login."
        : error instanceof Error
          ? error.message
          : "Erro desconhecido";

    return res.status(400).json({ ok: false, error: message });
  } finally {
    if (db) db.close();
  }
});

app.put("/api/settings/ticket-goal", requireAuth, requireMaster, (req, res) => {
  const ticketGoalPct = normalizeTicketGoalPct(req.body?.ticketGoalPct);

  if (ticketGoalPct === null) {
    return res.status(400).json({
      ok: false,
      error: "Informe uma meta válida entre 0 e 100%.",
    });
  }

  let db;
  try {
    db = openDatabase();
    ensureSchema(db);
    saveTicketGoalPct(db, ticketGoalPct);

    return res.json({
      ok: true,
      settings: {
        ticketGoalPct,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  } finally {
    if (db) db.close();
  }
});

app.get("/api/dashboard-data", requireAuth, (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const scopeRaw = String(req.query?.scope || "own").toLowerCase();
  const requestedScope = scopeRaw === "team" ? "team" : "own";

  const effectiveScope =
    req.authUser.role === "master" ? "team" : requestedScope;

  let db;
  try {
    db = openDatabase();
    ensureSchema(db);

    const payload =
      req.authUser.role === "master"
        ? readDashboardData(db)
        : readDashboardDataForAttendant(db, req.authUser, effectiveScope);

    const latestImport = db
      .prepare(
        `
        SELECT imported_at AS importedAt
        FROM import_runs
        ORDER BY id DESC
        LIMIT 1
      `,
      )
      .get();

    const teamTotals = computeTeamTotals(db);
    const ticketGoalPct = readTicketGoalPct(db);

    return res.json({
      ok: true,
      data: {
        ...payload,
        latestImport: latestImport?.importedAt || null,
        teamTotals,
        ticketGoalPct,
        viewScope: effectiveScope,
        role: req.authUser.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  } finally {
    if (db) {
      db.close();
    }
  }
});

app.post(
  "/api/import-dashboard",
  requireAuth,
  requireMaster,
  upload.single("file"),
  (req, res) => {
    let targetPath = null;

    try {
      if (!req.file) {
        return res.status(400).json({
          ok: false,
          error: "Arquivo não enviado. Use o campo multipart 'file'.",
        });
      }

      const year = Number.parseInt(
        String(req.body?.year || new Date().getFullYear()),
        10,
      );
      const onlyNew =
        String(req.body?.onlyNew || "false").toLowerCase() === "true";

      const ext = path.extname(req.file.originalname || "").toLowerCase();
      if (ext !== ".xlsx" && ext !== ".xls") {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          ok: false,
          error: "Formato inválido. Envie um arquivo .xlsx ou .xls",
        });
      }

      targetPath = path.resolve(
        uploadDir,
        `${Date.now()}_${req.file.originalname}`,
      );
      fs.renameSync(req.file.path, targetPath);

      const result = importDashboardToSqlite({
        inputFile: targetPath,
        referenceYear: year,
        onlyNew,
      });

      return res.json({ ok: true, result });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      const pathsToCleanup = [targetPath, req.file?.path].filter(Boolean);
      const uniquePaths = [...new Set(pathsToCleanup)];

      uniquePaths.forEach((filePath) => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch {
          // Falha na limpeza não deve quebrar a resposta da API.
        }
      });
    }
  },
);

app.listen(PORT, HOST, () => {
  const displayHost = HOST === "0.0.0.0" ? "localhost" : HOST;
  console.log(`[api] listening on http://${displayHost}:${PORT}`);
});
