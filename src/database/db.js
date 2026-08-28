import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

export function createDatabaseConnection(dbPath = null) {
  const defaultPath = path.join(process.cwd(), "data", "csms.db");
  const finalPath = dbPath || defaultPath;

  // Ensure directory exists if using file database
  if (finalPath !== ":memory:") {
    const dir = path.dirname(finalPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(finalPath);

  // Initialize Schema safely (Repeatable initialization)
  db.exec(`
    CREATE TABLE IF NOT EXISTS residents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      address TEXT NOT NULL,
      contact_number TEXT NOT NULL,
      email TEXT NOT NULL,
      status TEXT NOT NULL
    );
  `);

  return db;
}
