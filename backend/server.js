const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./models/userModel');

require('./models/projectModel');
require('./models/taskModel');
require('./models/commentModel');

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, '../frontend')));
app.set('view engine', 'ejs');

app.use(session({
  secret: 'mysecretkey',
  resave: false,
  saveUninitialized: true
}));

// Home (Register)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/login-page', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashed], (err) => {
    if (err) return res.redirect('/?error=User already exists');
    res.redirect('/login-page?success=Registered successfully');
  });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err || !user) return res.redirect('/login-page?error=Invalid email');
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.redirect('/login-page?error=Incorrect password');
    req.session.user = user;
    res.redirect('/dashboard');
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login-page');
});

// Dashboard with project color badges
app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/login-page');
  db.all('SELECT * FROM projects WHERE user_id = ?', [req.session.user.id], (err, projects) => {
    if (err) return res.status(500).send("Error fetching projects.");
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Dashboard</title>
        <link rel="stylesheet" href="/css/style.css">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body>
        <div class="container">
          <nav>
            <h1>Welcome, ${req.session.user.username}</h1>
            <div>
              <a href="/projects/create" class="btn">+ New Project</a>
              <a href="/logout" class="btn">Logout</a>
            </div>
          </nav>
          <h2>Your Projects</h2>
          <ul class="project-list">
    `;
    projects.forEach(p => {
      const color = p.color || '#3498db';
      html += `
        <li style="display: flex; align-items: center;">
          <div style="width: 16px; height: 16px; background: ${color}; border-radius: 4px; margin-right: 10px;"></div>
          <a href="/projects/${p.id}">${p.name}</a>
        </li>
      `;
    });
    html += `</ul></div></body></html>`;
    res.send(html);
  });
});

// Create Project
app.get('/projects/create', (req, res) => {
  if (!req.session.user) return res.redirect('/login-page');
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Create Project</title>
      <link rel="stylesheet" href="/css/style.css">
    </head>
    <body>
      <div class="project-form-container">
        <h2>Create New Project</h2>
        <form method="POST" action="/projects/create">
          <input type="text" name="name" placeholder="Project Name" required />
          <textarea name="description" placeholder="Description" rows="4"></textarea>
          <button type="submit">Create Project</button>
        </form>
        <div class="back-link">
          <a href="/dashboard">← Back to Dashboard</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

// POST Create with random color
app.post('/projects/create', (req, res) => {
  const { name, description } = req.body;
  const userId = req.session.user.id;
  const color = '#' + Math.floor(Math.random() * 16777215).toString(16); // random hex
  db.run(
    'INSERT INTO projects (name, description, user_id, color) VALUES (?, ?, ?, ?)',
    [name, description, userId, color],
    (err) => {
      if (err) return res.status(500).send("Error creating project.");
      res.redirect('/dashboard');
    }
  );
});

// Project Details with Stats, Filters, Progress
app.get('/projects/:id', (req, res) => {
  const projectId = req.params.id;
  const filter = req.query.status;

  db.get('SELECT * FROM projects WHERE id = ?', [projectId], (err, project) => {
    if (err || !project) return res.status(404).send("Project not found.");

    db.all('SELECT * FROM tasks WHERE project_id = ?', [projectId], (err, allTasks) => {
      if (err) return res.status(500).send("Error loading tasks.");

      const filteredTasks = filter ? allTasks.filter(t => t.status === filter) : allTasks;
      const totalTasks = allTasks.length;
      const completedTasks = allTasks.filter(t => t.status === 'Done').length;
      const percentComplete = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
      const todoCount = allTasks.filter(t => t.status === 'To Do').length;
      const inProgressCount = allTasks.filter(t => t.status === 'In Progress').length;
      const doneCount = completedTasks;

      let html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${project.name}</title>
          <link rel="stylesheet" href="/css/style.css">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body>
        <div class="container">
          <a href="/dashboard" class="btn">⬅ Back</a>
          <h1>${project.name}</h1>
          <p>${project.description}</p>

          <div style="margin: 15px 0; font-weight: bold;">
            Task Stats: 🕒 To Do: ${todoCount} | 🔄 In Progress: ${inProgressCount} | ✅ Done: ${doneCount}
          </div>

          <div style="margin: 20px 0;">
            <strong>Progress:</strong> ${completedTasks} of ${totalTasks} tasks completed (${percentComplete}%)
            <div style="background: #ccc; width: 100%; height: 20px; border-radius: 10px; margin-top: 5px;">
              <div style="width: ${percentComplete}%; height: 100%; background: #2ecc71; border-radius: 10px;"></div>
            </div>
          </div>

          <div style="margin: 15px 0;">
            <a href="/projects/${project.id}" class="btn">All</a>
            <a href="/projects/${project.id}?status=To%20Do" class="btn">To Do</a>
            <a href="/projects/${project.id}?status=In%20Progress" class="btn">In Progress</a>
            <a href="/projects/${project.id}?status=Done" class="btn">Done</a>
          </div>

          <ul class="task-list">
      `;

      let count = 0;
      if (filteredTasks.length === 0) finishRender();

      filteredTasks.forEach(t => {
        db.all('SELECT * FROM comments WHERE task_id = ?', [t.id], (err, comments) => {
          html += `
            <li class="task-card">
              <h3>${t.title}</h3>
              <div class="task-meta">
                Status: ${t.status} |
                Priority: ${t.priority || 'None'} |
                Due: ${t.due_date || 'Not set'}
              </div>
              <form method="POST" action="/tasks/${t.id}/status" class="status-form">
                <select name="status" onchange="this.form.submit()">
                  <option value="To Do" ${t.status === 'To Do' ? 'selected' : ''}>To Do</option>
                  <option value="In Progress" ${t.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                  <option value="Done" ${t.status === 'Done' ? 'selected' : ''}>Done</option>
                </select>
              </form>

              <div class="comment-box">
                <strong>Comments:</strong>
                <ul>
                  ${comments.map(c => `<li>${c.content}</li>`).join('')}
                </ul>
                <form method="POST" action="/tasks/${t.id}/comments">
                  <input type="text" name="content" placeholder="Write a comment" required>
                  <button type="submit">Comment</button>
                </form>
              </div>
            </li>
          `;
          count++;
          if (count === filteredTasks.length) finishRender();
        });
      });

      function finishRender() {
        html += `
          </ul>
          <div class="add-task-form">
            <h3>Add Task</h3>
            <form method="POST" action="/projects/${project.id}/tasks">
              <input type="text" name="title" placeholder="Task Title" required><br><br>
              <textarea name="description" placeholder="Task Description"></textarea><br><br>
              <input type="date" name="due_date" required><br><br>
              <select name="priority">
                <option value="Low">Low</option>
                <option value="Medium" selected>Medium</option>
                <option value="High">High</option>
              </select><br><br>
              <button type="submit">Add Task</button>
            </form>
          </div>
        </div>
        </body>
        </html>
        `;
        res.send(html);
      }
    });
  });
});

// Add Task
app.post('/projects/:id/tasks', (req, res) => {
  const projectId = req.params.id;
  const { title, description, due_date, priority } = req.body;
  db.run(
    'INSERT INTO tasks (title, description, due_date, priority, project_id) VALUES (?, ?, ?, ?, ?)',
    [title, description, due_date, priority, projectId],
    (err) => {
      if (err) return res.status(500).send("Error adding task.");
      res.redirect(`/projects/${projectId}`);
    }
  );
});

// Update Task Status
app.post('/tasks/:id/status', (req, res) => {
  const taskId = req.params.id;
  const { status } = req.body;
  db.run('UPDATE tasks SET status = ? WHERE id = ?', [status, taskId], (err) => {
    if (err) return res.status(500).send("Error updating status.");
    db.get('SELECT project_id FROM tasks WHERE id = ?', [taskId], (err, task) => {
      if (task) res.redirect(`/projects/${task.project_id}`);
      else res.redirect('/dashboard');
    });
  });
});

// Add Comment
app.post('/tasks/:id/comments', (req, res) => {
  const taskId = req.params.id;
  const userId = req.session.user.id;
  const { content } = req.body;
  db.run('INSERT INTO comments (content, user_id, task_id) VALUES (?, ?, ?)', [content, userId, taskId], (err) => {
    if (err) return res.status(500).send("Error adding comment.");
    db.get('SELECT project_id FROM tasks WHERE id = ?', [taskId], (err, task) => {
      if (task) res.redirect(`/projects/${task.project_id}`);
      else res.redirect('/dashboard');
    });
  });
});

const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
