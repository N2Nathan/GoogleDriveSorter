import sqlite3 from 'sqlite3';
import { promisify } from 'util';

const db = new sqlite3.Database('./data/organizer.db');

const run = promisify(db.run.bind(db));
const get = promisify(db.get.bind(db));
const all = promisify(db.all.bind(db));

export async function initDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS file_moves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      original_parent_id TEXT,
      new_parent_id TEXT,
      original_parent_name TEXT,
      new_parent_name TEXT,
      moved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      undone BOOLEAN DEFAULT 0,
      batch_id TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      token_type TEXT,
      expiry_date INTEGER,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS file_analysis_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id TEXT UNIQUE NOT NULL,
      original_name TEXT,
      suggested_name TEXT,
      analysis_data TEXT,
      analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Database initialized');
}

export async function logFileMove(moveData) {
  return await run(
    `INSERT INTO file_moves
    (file_id, file_name, original_parent_id, new_parent_id, original_parent_name, new_parent_name, batch_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      moveData.fileId,
      moveData.fileName,
      moveData.originalParentId,
      moveData.newParentId,
      moveData.originalParentName,
      moveData.newParentName,
      moveData.batchId
    ]
  );
}

export async function getMoveLogs(filters = {}) {
  let query = 'SELECT * FROM file_moves WHERE undone = 0';
  const params = [];

  if (filters.batchId) {
    query += ' AND batch_id = ?';
    params.push(filters.batchId);
  }

  query += ' ORDER BY moved_at DESC';

  if (filters.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  }

  return await all(query, params);
}

export async function undoMoves(batchId) {
  return await run(
    'UPDATE file_moves SET undone = 1 WHERE batch_id = ?',
    [batchId]
  );
}

export async function saveTokens(userId, tokens) {
  return await run(
    `INSERT OR REPLACE INTO auth_tokens
    (user_id, access_token, refresh_token, token_type, expiry_date)
    VALUES (?, ?, ?, ?, ?)`,
    [userId, tokens.access_token, tokens.refresh_token, tokens.token_type, tokens.expiry_date]
  );
}

export async function getTokens(userId) {
  return await get('SELECT * FROM auth_tokens WHERE user_id = ?', [userId]);
}

export async function saveCachedAnalysis(fileId, originalName, suggestedName, analysisData) {
  return await run(
    `INSERT OR REPLACE INTO file_analysis_cache
    (file_id, original_name, suggested_name, analysis_data)
    VALUES (?, ?, ?, ?)`,
    [fileId, originalName, suggestedName, JSON.stringify(analysisData)]
  );
}

export async function getCachedAnalysis(fileId) {
  const result = await get('SELECT * FROM file_analysis_cache WHERE file_id = ?', [fileId]);
  if (result && result.analysis_data) {
    result.analysis_data = JSON.parse(result.analysis_data);
  }
  return result;
}

export { db, run, get, all };
