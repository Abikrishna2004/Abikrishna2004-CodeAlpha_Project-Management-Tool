const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to SQLite DB (will be created automatically)
const db = new sqlite3.Database(path.resolve(__dirname, '../database.sqlite'), (err) => {
  if (err) return console.error(err.message);
  console.log('🗂 Connected to SQLite database.');
});

// Create users table
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  )
`);

module.exports = db;
