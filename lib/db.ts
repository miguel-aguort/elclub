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

  database.exec(`
    CREATE TABLE IF NOT EXISTS surveys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS survey_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      survey_id INTEGER NOT NULL REFERENCES surveys(id),
      prompt TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('single_choice', 'text')),
      required INTEGER NOT NULL DEFAULT 1,
      position INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS survey_question_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL REFERENCES survey_questions(id),
      label TEXT NOT NULL,
      position INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS survey_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      survey_id INTEGER NOT NULL REFERENCES surveys(id),
      email TEXT NOT NULL,
      answers_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (survey_id, email)
    )
  `)

  database.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      location TEXT NOT NULL,
      event_at TEXT NOT NULL,
      link TEXT,
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
