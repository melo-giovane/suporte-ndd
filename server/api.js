import fs from "node:fs";
import path from "node:path";
import express from "express";
import multer from "multer";
import { importDashboardToSqlite } from "../scripts/db/import-service.js";
import { ensureSchema, openDatabase } from "../scripts/db/db.js";

const app = express();
const PORT = Number.parseInt(process.env.API_PORT || "8787", 10);
const uploadDir = path.resolve(process.cwd(), "data/input/uploads");
fs.mkdirSync(uploadDir, { recursive: true });

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

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

app.get("/api/dashboard-data", (_, res) => {
  let db;
  try {
    db = openDatabase();
    ensureSchema(db);

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
          date_real AS dateReal
        FROM atplus_cons_daily
        ORDER BY date_real, data_label
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
          date_real AS dateReal
        FROM atplus_attendant_daily
        ORDER BY date_real, ramal
      `,
      )
      .all();

    const tickets = db
      .prepare(
        `
        SELECT
          chamado,
          titulo,
          natureza,
          responsavel,
          qualificacao,
          severidade,
          categoria_normalizada AS categoria,
          data_abertura AS dataAbertura,
          status
        FROM ellevo_tickets
        ORDER BY data_abertura
      `,
      )
      .all();

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

    res.json({
      ok: true,
      data: {
        cons,
        atend,
        tickets,
        latestImport: latestImport?.importedAt || null,
      },
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  } finally {
    if (db) {
      db.close();
    }
  }
});

app.post("/api/import-dashboard", upload.single("file"), (req, res) => {
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
});

app.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`);
});
