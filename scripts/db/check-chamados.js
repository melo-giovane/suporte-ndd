import { openDatabase, DEFAULT_DB_PATH } from "./db.js";

const db = openDatabase();
try {
  const row = db
    .prepare(
      `SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN source = 'call' THEN 1 ELSE 0 END) AS calls,
      SUM(CASE WHEN source = 'ticket' THEN 1 ELSE 0 END) AS tickets
    FROM chamados`,
    )
    .get();
  console.log("[check-chamados]", JSON.stringify(row));
} finally {
  db.close();
}
