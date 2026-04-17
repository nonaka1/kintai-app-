const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'kintai.db');
const isPostgres = !!process.env.DATABASE_URL;

let db; // sql.js instance
let pgPool; // pg Pool instance

// --- PostgreSQL ---
async function initPostgres() {
  if (pgPool) return;
  const { Pool } = require('pg');
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS staff (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      login_id TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'staff',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id SERIAL PRIMARY KEY,
      staff_id INTEGER NOT NULL REFERENCES staff(id),
      date TEXT NOT NULL,
      clock_in TEXT,
      clock_out TEXT,
      clock_in_lat DOUBLE PRECISION,
      clock_in_lng DOUBLE PRECISION,
      clock_out_lat DOUBLE PRECISION,
      clock_out_lng DOUBLE PRECISION,
      break_start TEXT,
      break_end TEXT,
      UNIQUE(staff_id, date)
    )
  `);

  // マイグレーション: 既存テーブルにカラム追加
  try { await pgPool.query('ALTER TABLE attendance ADD COLUMN break_start TEXT'); } catch {}
  try { await pgPool.query('ALTER TABLE attendance ADD COLUMN break_end TEXT'); } catch {}

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS store_location (
      id INTEGER PRIMARY KEY DEFAULT 1,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      radius INTEGER NOT NULL DEFAULT 200,
      name TEXT DEFAULT '店舗'
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS stores (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      radius INTEGER NOT NULL DEFAULT 200
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS staff_stores (
      staff_id INTEGER NOT NULL,
      store_id INTEGER NOT NULL,
      PRIMARY KEY (staff_id, store_id)
    )
  `);

  // マイグレーション: 既存の store_location → stores へ
  const sCount = await pgPool.query('SELECT COUNT(*) as c FROM stores');
  if (Number(sCount.rows[0].c) === 0) {
    const oldStore = await pgPool.query('SELECT * FROM store_location WHERE id = 1');
    if (oldStore.rows[0]) {
      const o = oldStore.rows[0];
      const inserted = await pgPool.query(
        'INSERT INTO stores (name, latitude, longitude, radius) VALUES ($1, $2, $3, $4) RETURNING id',
        [o.name || '店舗', o.latitude, o.longitude, o.radius || 200]
      );
      const newStoreId = inserted.rows[0].id;
      // 全スタッフを新店舗に割り当て
      await pgPool.query(
        'INSERT INTO staff_stores (staff_id, store_id) SELECT id, $1 FROM staff ON CONFLICT DO NOTHING',
        [newStoreId]
      );
    }
  }
}

// --- SQLite ---
async function initSqlite() {
  if (db) return;
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      login_id TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'staff',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      clock_in TEXT,
      clock_out TEXT,
      clock_in_lat REAL,
      clock_in_lng REAL,
      clock_out_lat REAL,
      clock_out_lng REAL,
      break_start TEXT,
      break_end TEXT,
      FOREIGN KEY (staff_id) REFERENCES staff(id),
      UNIQUE(staff_id, date)
    )
  `);

  try { db.run('ALTER TABLE attendance ADD COLUMN clock_in_lat REAL'); } catch {}
  try { db.run('ALTER TABLE attendance ADD COLUMN clock_in_lng REAL'); } catch {}
  try { db.run('ALTER TABLE attendance ADD COLUMN clock_out_lat REAL'); } catch {}
  try { db.run('ALTER TABLE attendance ADD COLUMN clock_out_lng REAL'); } catch {}
  try { db.run('ALTER TABLE attendance ADD COLUMN break_start TEXT'); } catch {}
  try { db.run('ALTER TABLE attendance ADD COLUMN break_end TEXT'); } catch {}

  db.run(`
    CREATE TABLE IF NOT EXISTS store_location (
      id INTEGER PRIMARY KEY DEFAULT 1,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      radius INTEGER NOT NULL DEFAULT 200,
      name TEXT DEFAULT '店舗'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      radius INTEGER NOT NULL DEFAULT 200
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS staff_stores (
      staff_id INTEGER NOT NULL,
      store_id INTEGER NOT NULL,
      PRIMARY KEY (staff_id, store_id)
    )
  `);

  // マイグレーション: 既存の store_location → stores へ
  try {
    const stmt = db.prepare('SELECT COUNT(*) as c FROM stores');
    stmt.step();
    const { c } = stmt.getAsObject();
    stmt.free();
    if (c === 0) {
      const oldStmt = db.prepare('SELECT * FROM store_location WHERE id = 1');
      if (oldStmt.step()) {
        const o = oldStmt.getAsObject();
        oldStmt.free();
        db.run('INSERT INTO stores (name, latitude, longitude, radius) VALUES (?, ?, ?, ?)',
          [o.name || '店舗', o.latitude, o.longitude, o.radius || 200]);
        db.run('INSERT OR IGNORE INTO staff_stores (staff_id, store_id) SELECT id, last_insert_rowid() FROM staff');
      } else {
        oldStmt.free();
      }
    }
  } catch (e) { console.error('migration error:', e); }

  saveSqlite();
}

function saveSqlite() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// --- 共通インターフェース ---

// SQLiteの ? を PostgreSQLの $1, $2, ... に変換
function convertPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// SQLiteの INSERT OR IGNORE を PostgreSQLの ON CONFLICT DO NOTHING に変換
function convertSql(sql) {
  if (isPostgres) {
    let s = convertPlaceholders(sql);
    s = s.replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO');
    if (/INSERT INTO/i.test(s) && !/ON CONFLICT/i.test(s) && /OR IGNORE/i.test(sql)) {
      s = s.replace(/\)$/m, ') ON CONFLICT DO NOTHING');
    }
    return s;
  }
  return sql;
}

async function initDb() {
  if (isPostgres) {
    await initPostgres();
  } else {
    await initSqlite();
  }
}

async function query(sql, params = []) {
  if (isPostgres) {
    const result = await pgPool.query(convertPlaceholders(sql), params);
    return result.rows;
  } else {
    await initSqlite();
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }
}

async function run(sql, params = []) {
  if (isPostgres) {
    const converted = convertSql(sql);
    await pgPool.query(converted.includes('$') ? converted : convertPlaceholders(sql), params);
  } else {
    await initSqlite();
    db.run(sql, params);
    saveSqlite();
  }
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

module.exports = { initDb, query, queryOne, run };
