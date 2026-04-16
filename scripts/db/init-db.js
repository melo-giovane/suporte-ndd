import { DEFAULT_DB_PATH, ensureSchema, openDatabase } from "./db.js";

const db = openDatabase(DEFAULT_DB_PATH);
ensureSchema(db);

console.log("SQLite inicializado com sucesso.");
console.log(`DB: ${DEFAULT_DB_PATH}`);
