import sqlite3 from 'sqlite3';
import { promisify } from 'util';

const db = new sqlite3.Database('./data/organizer.db');

const run = promisify(db.run.bind(db));
const get = promisify(db.get.bind(db));
const all = promisify(db.all.bind(db));

export async function initDatabase() {
  // Users table
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      picture TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // File moves table with user_id
  await run(`
    CREATE TABLE IF NOT EXISTS file_moves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      file_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      original_parent_id TEXT,
      new_parent_id TEXT,
      original_parent_name TEXT,
      new_parent_name TEXT,
      moved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      undone BOOLEAN DEFAULT 0,
      batch_id TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Auth tokens table linked to users
  await run(`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      token_type TEXT,
      expiry_date INTEGER,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // File analysis cache with user_id for per-user caching
  await run(`
    CREATE TABLE IF NOT EXISTS file_analysis_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      file_id TEXT NOT NULL,
      original_name TEXT,
      suggested_name TEXT,
      analysis_data TEXT,
      analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, file_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  console.log('Database initialized');
}

// User management
export async function createOrUpdateUser(googleProfile) {
  const existing = await get('SELECT * FROM users WHERE google_id = ?', [googleProfile.id]);

  if (existing) {
    await run(
      `UPDATE users SET email = ?, name = ?, picture = ?, last_login = CURRENT_TIMESTAMP WHERE google_id = ?`,
      [googleProfile.email, googleProfile.name, googleProfile.picture, googleProfile.id]
    );
    return existing.id;
  } else {
    const result = await run(
      `INSERT INTO users (google_id, email, name, picture) VALUES (?, ?, ?, ?)`,
      [googleProfile.id, googleProfile.email, googleProfile.name, googleProfile.picture]
    );
    return result.lastID;
  }
}

export async function getUserById(userId) {
  return await get('SELECT * FROM users WHERE id = ?', [userId]);
}

export async function getUserByGoogleId(googleId) {
  return await get('SELECT * FROM users WHERE google_id = ?', [googleId]);
}

// File moves
export async function logFileMove(moveData) {
  return await run(
    `INSERT INTO file_moves
    (user_id, file_id, file_name, original_parent_id, new_parent_id, original_parent_name, new_parent_name, batch_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      moveData.userId,
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

export async function getMoveLogs(userId, filters = {}) {
  let query = 'SELECT * FROM file_moves WHERE user_id = ? AND undone = 0';
  const params = [userId];

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

export async function undoMoves(userId, batchId) {
  return await run(
    'UPDATE file_moves SET undone = 1 WHERE user_id = ? AND batch_id = ?',
    [userId, batchId]
  );
}

// Auth tokens
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

// File analysis cache
export async function saveCachedAnalysis(userId, fileId, originalName, suggestedName, analysisData) {
  return await run(
    `INSERT OR REPLACE INTO file_analysis_cache
    (user_id, file_id, original_name, suggested_name, analysis_data)
    VALUES (?, ?, ?, ?, ?)`,
    [userId, fileId, originalName, suggestedName, JSON.stringify(analysisData)]
  );
}

export async function getCachedAnalysis(userId, fileId) {
  const result = await get('SELECT * FROM file_analysis_cache WHERE user_id = ? AND file_id = ?', [userId, fileId]);
  if (result && result.analysis_data) {
    result.analysis_data = JSON.parse(result.analysis_data);
  }
  return result;
}

export { db, run, get, all };
