const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
app.disable("x-powered-by");

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (req.path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
  next();
});

function jsonError(res, status, message) {
  return res.status(status).json({ error: message });
}

const db = new Database(path.join(__dirname, "kanban.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS columns(
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  ord  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks(
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  title   TEXT NOT NULL,
  col_id  INTEGER NOT NULL REFERENCES columns(id),
  ord     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_col_ord ON tasks(col_id, ord);
`);

const colCount = db.prepare("SELECT COUNT(*) AS c FROM columns").get().c;
if (colCount === 0) {
  const ins = db.prepare("INSERT INTO columns(name, ord) VALUES(?, ?)");
  ins.run("Todo", 1);
  ins.run("Doing", 2);
  ins.run("Done", 3);
  console.log("➡️  Seeded columns: Todo, Doing, Done");
}

function normalizeColumnOrd(colId) {
  const rows = db
    .prepare("SELECT id FROM tasks WHERE col_id=? ORDER BY ord ASC, id ASC")
    .all(colId);

  const upd = db.prepare("UPDATE tasks SET ord=? WHERE id=?");
  let i = 1;
  for (const r of rows) {
    upd.run(i, r.id);
    i++;
  }
}

app.get("/api/board", (req, res) => {
  const cols = db.prepare("SELECT id, name, ord FROM columns ORDER BY ord ASC").all();
  const tasks = db
    .prepare("SELECT id, title, col_id, ord FROM tasks ORDER BY col_id ASC, ord ASC, id ASC")
    .all();
  res.json({ cols, tasks });
});

app.post("/api/tasks", (req, res) => {
  const { title, col_id } = req.body || {};
  const titleOk = typeof title === "string" ? title.trim() : "";
  const colId = Number(col_id);

  if (!titleOk || !Number.isFinite(colId) || colId <= 0) {
    return jsonError(res, 400, "Invalid title/col_id");
  }

  const col = db.prepare("SELECT id FROM columns WHERE id=?").get(colId);
  if (!col) return jsonError(res, 404, "Column not found");

  const nextOrd = db
    .prepare("SELECT COALESCE(MAX(ord), 0) + 1 AS ord FROM tasks WHERE col_id=?")
    .get(colId).ord;

  const info = db
    .prepare("INSERT INTO tasks(title, col_id, ord) VALUES(?, ?, ?)")
    .run(titleOk, colId, nextOrd);

  const created = db.prepare("SELECT id, title, col_id, ord FROM tasks WHERE id=?").get(info.lastInsertRowid);
  res.location(`/api/tasks/${created.id}`).status(201).json(created);
});

const moveTx = db.transaction((taskId, toColId, toOrd) => {
  const task = db.prepare("SELECT id, col_id FROM tasks WHERE id=?").get(taskId);
  if (!task) return { status: 404, body: { error: "Task not found" } };

  const col = db.prepare("SELECT id FROM columns WHERE id=?").get(toColId);
  if (!col) return { status: 404, body: { error: "Column not found" } };

  normalizeColumnOrd(task.col_id);

  const countTo = db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE col_id=?").get(toColId).c;

  let ord = Number(toOrd);
  if (!Number.isFinite(ord)) ord = countTo + 1;
  ord = Math.max(1, Math.min(Math.floor(ord), countTo + 1));

  db.prepare("UPDATE tasks SET ord = ord + 1 WHERE col_id=? AND ord >= ?").run(toColId, ord);

  db.prepare("UPDATE tasks SET col_id=?, ord=? WHERE id=?").run(toColId, ord, taskId);

  normalizeColumnOrd(task.col_id);
  normalizeColumnOrd(toColId);

  const moved = db.prepare("SELECT id, title, col_id, ord FROM tasks WHERE id=?").get(taskId);
  return { status: 200, body: moved };
});

app.post("/api/tasks/:id/move", (req, res) => {
  const taskId = Number(req.params.id);
  const { col_id, ord } = req.body || {};
  const toColId = Number(col_id);

  if (!Number.isFinite(taskId) || taskId <= 0 || !Number.isFinite(toColId) || toColId <= 0) {
    return jsonError(res, 400, "Invalid id/col_id");
  }

  try {
    const result = moveTx(taskId, toColId, ord);
    res.status(result.status).json(result.body);
  } catch (e) {
    console.error(e);
    jsonError(res, 500, "Internal server error");
  }
});

app.use("/api", (req, res) => jsonError(res, 404, "Not found"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const port = Number(process.env.PORT) || 5052;
app.listen(port, () => console.log(`Kanban API on http://localhost:${port}`));