import {
  DEFAULT_DB_PATH,
  ensureSchema,
  openDatabase,
  seedDefaultAttendants,
} from "./db.js";

const db = openDatabase(DEFAULT_DB_PATH);
ensureSchema(db);
seedDefaultAttendants(db);

console.log("SQLite inicializado com sucesso.");
console.log(`DB: ${DEFAULT_DB_PATH}`);
