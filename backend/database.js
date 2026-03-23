import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'medications.db');

const SQL = await initSqlJs();
let db;

if (existsSync(dbPath)) {
  const buffer = readFileSync(dbPath);
  db = new SQL.Database(buffer);
} else {
  db = new SQL.Database();
}

function saveDatabase() {
  const data = db.export();
  writeFileSync(dbPath, data);
}

const dbWrapper = {
  prepare: (sql) => ({
    run: (...params) => {
      db.run(sql, params);
      saveDatabase();
      return { lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] };
    },
    get: (...params) => {
      const result = db.exec(sql, params);
      if (!result.length) return undefined;
      const cols = result[0].columns;
      const vals = result[0].values[0];
      if (!vals) return undefined;
      const obj = {};
      cols.forEach((c, i) => obj[c] = vals[i]);
      return obj;
    },
    all: (...params) => {
      const result = db.exec(sql, params);
      if (!result.length) return [];
      const cols = result[0].columns;
      return result[0].values.map(row => {
        const obj = {};
        cols.forEach((c, i) => obj[c] = row[i]);
        return obj;
      });
    }
  }),
  exec: (sql) => { db.run(sql); saveDatabase(); },
  transaction: (fn) => () => {
    db.run('BEGIN TRANSACTION');
    try { fn(); db.run('COMMIT'); saveDatabase(); }
    catch (e) { db.run('ROLLBACK'); throw e; }
  }
};

dbWrapper.exec(`
  CREATE TABLE IF NOT EXISTS medications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    inn TEXT NOT NULL,
    form TEXT NOT NULL,
    release_form TEXT NOT NULL,
    indications TEXT NOT NULL,
    contraindications TEXT NOT NULL,
    side_effects TEXT NOT NULL,
    dosage TEXT NOT NULL,
    age_min INTEGER DEFAULT 0,
    age_max INTEGER DEFAULT 120,
    keywords TEXT DEFAULT '',
    image_color TEXT DEFAULT '#1565C0'
  );

  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    gender TEXT NOT NULL,
    age INTEGER NOT NULL,
    weight REAL NOT NULL,
    chronic_diseases TEXT DEFAULT '',
    allergies TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id)
  );

  CREATE TABLE IF NOT EXISTS search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    symptoms TEXT NOT NULL,
    filters TEXT DEFAULT '',
    results TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id)
  );
`);
