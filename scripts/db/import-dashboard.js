import fs from "node:fs";
import path from "node:path";
import { DEFAULT_DB_PATH } from "./db.js";
import { importDashboardToSqlite } from "./import-service.js";

function getArgValue(flag, fallback = null) {
  const arg = process.argv.find((a) => a.startsWith(`${flag}=`));
  return arg ? arg.slice(flag.length + 1) : fallback;
}

function getPositionalPath() {
  const positional = process.argv.slice(2).find((a) => !a.startsWith("--"));
  return positional || null;
}

function main() {
  const defaultInput = path.resolve(
    process.cwd(),
    "data/input/Dashboard_-_Central.xlsx",
  );

  const inputFile = path.resolve(
    getPositionalPath() || getArgValue("--input", defaultInput),
  );
  const dbPath = path.resolve(getArgValue("--db", DEFAULT_DB_PATH));
  const referenceYear = Number.parseInt(
    getArgValue("--year", String(new Date().getFullYear())),
    10,
  );

  if (!fs.existsSync(inputFile)) {
    throw new Error(
      `Arquivo de entrada não encontrado: ${inputFile}. Informe via --input=CAMINHO ou argumento posicional.`,
    );
  }

  const result = importDashboardToSqlite({
    inputFile,
    dbPath,
    referenceYear,
  });

  console.log("Importação SQLite concluída com sucesso.");
  console.log(`DB: ${result.dbPath}`);
  console.log(`Fonte: ${result.inputFile}`);
  console.log(
    `Linhas processadas => Cons: ${result.consRows}, Atend: ${result.atendRows}, Tickets: ${result.ticketRows}`,
  );
}

main();
