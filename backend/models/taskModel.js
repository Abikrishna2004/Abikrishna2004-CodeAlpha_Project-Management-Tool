const db = require('./userModel');

// Create `tasks` table
db.run(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'To Do',
    due_date TEXT, 
    priority TEXT,  
    project_id INTEGER,
    FOREIGN KEY(project_id) REFERENCES projects(id)
  )
`);

module.exports = db;
