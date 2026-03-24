import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'medications.db');

// Сбрасываем БД при каждом запуске для обновления данных
if (existsSync(dbPath)) { try { unlinkSync(dbPath); } catch(e) {} }

const SQL = await initSqlJs();
const db = new SQL.Database();

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
  transaction: (fn) => () => { fn(); saveDatabase(); }
};

dbWrapper.exec(`
  CREATE TABLE IF NOT EXISTS medications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    inn TEXT NOT NULL,
    drug_form TEXT NOT NULL,
    release_form TEXT NOT NULL,
    indications TEXT NOT NULL,
    contraindications TEXT NOT NULL,
    side_effects TEXT NOT NULL,
    dosage TEXT NOT NULL,
    dosage_child TEXT,
    age_min INTEGER DEFAULT 0,
    age_max INTEGER DEFAULT 120,
    keywords TEXT,
    image_color TEXT DEFAULT '#1565C0'
  );

  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    password TEXT,
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

import { medications } from './medications_data.js';
import { medications2 } from './medications_data2.js';
import { medications3 } from './medications_data3.js';

const insertMed = dbWrapper.prepare(`
  INSERT INTO medications 
  (name, inn, drug_form, release_form, indications, contraindications, side_effects, dosage, dosage_child, age_min, age_max, keywords, image_color)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const allMeds = [...medications, ...medications2, ...medications3];

const insert = dbWrapper.transaction(() => {
  for (const med of allMeds) insertMed.run(...med);
});

insert();

export default dbWrapper;
