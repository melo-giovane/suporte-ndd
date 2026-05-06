import { openDatabase, ensureSchema, DEFAULT_DB_PATH } from "./db.js";

const args = process.argv.slice(2);
const dbPath = args[0] || DEFAULT_DB_PATH;

console.log("[populate-chamados] Opening DB:", dbPath);
const db = openDatabase(dbPath);
ensureSchema(db);

const insertChamado = db.prepare(`
  INSERT INTO chamados (
    source, orig_id, chamado, data_key, date_real, hora, fila, ramal,
    responsavel, status, categoria, titulo, descricao, raw_json, source_file
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function run() {
  const cons = db.prepare("SELECT * FROM atplus_cons_daily").all();
  const tickets = db.prepare("SELECT * FROM ellevo_tickets").all();

  console.log(
    `[populate-chamados] Found ${cons.length} call rows, ${tickets.length} ticket rows`,
  );

  const trx = db.transaction(() => {
    cons.forEach((row) => {
      try {
        insertChamado.run(
          "call",
          row.id ?? null,
          null,
          row.data_key ?? null,
          row.date_real ?? null,
          row.hora ?? null,
          row.fila ?? null,
          null,
          null,
          null,
          null,
          null,
          null,
          JSON.stringify(row),
          "backfill",
        );
      } catch (err) {
        console.warn(
          "[populate-chamados] failed insert call row",
          err?.message,
        );
      }
    });

    tickets.forEach((row) => {
      try {
        insertChamado.run(
          "ticket",
          row.id ?? null,
          row.chamado ?? null,
          null,
          row.data_abertura ?? null,
          null,
          null,
          null,
          row.responsavel ?? null,
          row.status ?? null,
          row.categoria_normalizada ?? row.categoria_raw ?? null,
          row.titulo ?? null,
          row.descricao ?? null,
          JSON.stringify(row),
          "backfill",
        );
      } catch (err) {
        console.warn(
          "[populate-chamados] failed insert ticket row",
          err?.message,
        );
      }
    });
  });

  trx();

  console.log("[populate-chamados] Backfill completed.");
}

try {
  run();
} finally {
  db.close();
}
