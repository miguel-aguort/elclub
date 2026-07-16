import Database from 'better-sqlite3'
import * as fs from 'fs'
import * as nodePath from 'path'

let db: Database.Database | null = null

function initSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
}

export function createDb(path: string): Database.Database {
  // Ensure parent directory exists before opening the database
  fs.mkdirSync(nodePath.dirname(path), { recursive: true })
  const database = new Database(path)
  initSchema(database)
  return database
}

export function getDb(): Database.Database {
  if (!db) {
    db = createDb(process.env.DB_PATH || 'data/subscribers.db')
  }
  return db
}
