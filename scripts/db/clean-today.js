import Database from "better-sqlite3";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DB_MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(DB_MODULE_DIR, "../..");
const DEFAULT_DB_PATH = path.resolve(
  PROJECT_ROOT,
  "data/sqlite/central_relacionamentos.db",
);

const db = new Database(DEFAULT_DB_PATH);

const inputDate = process.argv[2];
const today = inputDate ?? new Date().toISOString().split("T")[0];
console.log(`\n📅 Data selecionada para limpeza: ${today}\n`);

// Conta registros que serão deletados
const consCount = db
  .prepare(
    "SELECT COUNT(*) as count FROM atplus_cons_daily WHERE date_real = ?",
  )
  .get(today);

const atendCount = db
  .prepare(
    "SELECT COUNT(*) as count FROM atplus_attendant_daily WHERE date_real = ?",
  )
  .get(today);

const ticketsCount = db
  .prepare(
    "SELECT COUNT(*) as count FROM ellevo_tickets WHERE data_abertura LIKE ?",
  )
  .get(`${today}%`);

const totalToDelete =
  (consCount?.count || 0) +
  (atendCount?.count || 0) +
  (ticketsCount?.count || 0);

console.log("📊 Registros a deletar:");
console.log(`  • Chamadas (Consolidado): ${consCount?.count || 0}`);
console.log(`  • Chamadas (Atendentes): ${atendCount?.count || 0}`);
console.log(`  • Tickets: ${ticketsCount?.count || 0}`);
console.log(`\n⚠️  TOTAL: ${totalToDelete} registros\n`);

if (totalToDelete === 0) {
  console.log(`✅ Nenhum registro encontrado para ${today}.`);
  db.close();
  process.exit(0);
}

// Confirma antes de deletar
console.log("⚠️  Esta ação não pode ser desfeita!");
console.log("Digite 'SIM' para confirmar a exclusão:");

process.stdin.once("data", (input) => {
  const response = input.toString().trim().toUpperCase();

  if (response === "SIM") {
    const transaction = db.transaction(() => {
      const res1 = db
        .prepare("DELETE FROM atplus_cons_daily WHERE date_real = ?")
        .run(today);

      const res2 = db
        .prepare("DELETE FROM atplus_attendant_daily WHERE date_real = ?")
        .run(today);

      const res3 = db
        .prepare("DELETE FROM ellevo_tickets WHERE data_abertura LIKE ?")
        .run(`${today}%`);

      return res1.changes + res2.changes + res3.changes;
    });

    const deletedCount = transaction();
    console.log(`\n✅ Sucesso! ${deletedCount} registros deletados.\n`);
  } else {
    console.log("\n❌ Operação cancelada.\n");
  }

  db.close();
  process.exit(0);
});
