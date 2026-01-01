const API = window.API_BASE || window.location.origin;

const qs = (s, el = document) => el.querySelector(s);
const boardEl = qs("#board");

async function api(url, options = {}) {
  const r = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`${r.status} ${t}`.trim());
  }

  return r.json();
}

async function loadBoard() {
  const { cols, tasks } = await api(`${API}/api/board`);
  renderBoard(cols, tasks);
}

function renderBoard(cols, tasks) {
  boardEl.classList.add("board");
  boardEl.innerHTML = "";

  for (const col of cols) {
    const colTasks = tasks
      .filter((t) => t.col_id === col.id)
      .sort((a, b) => (a.ord - b.ord) || (a.id - b.id));

    const section = document.createElement("section");
    section.className = "column";
    section.innerHTML = `
      <div class="col-head">
        <div>
          <div><b>${col.name}</b></div>
          <div class="muted">${colTasks.length} zadań</div>
        </div>
      </div>

      <div class="cards"></div>

      <form class="add-form">
        <input name="title" placeholder="Nowe zadanie" required />
        <button class="accent" type="submit">+</button>
      </form>
    `;

    const cards = section.querySelector(".cards");

    for (const t of colTasks) {
      const card = document.createElement("div");
      card.className = "card";

      const canMoveRight = Number(col.ord) < 3;

      card.innerHTML = `
        <div>${t.title}</div>
        <div class="controls" style="margin-top:8px; justify-content:flex-end;">
          ${
            canMoveRight
              ? `<button type="button" class="accent move" aria-label="Przenieś w prawo">→</button>`
              : ""
          }
        </div>
      `;

      const btn = card.querySelector(".move");
      if (btn) {
        btn.addEventListener("click", async () => {
          await moveTaskRight(t, cols);
          await loadBoard();
        });
      }

      cards.appendChild(card);
    }

    const form = section.querySelector("form");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const title = form.title.value.trim();
      if (!title) return;

      await api(`${API}/api/tasks`, {
        method: "POST",
        body: JSON.stringify({ title, col_id: col.id }),
      });

      form.reset();
      await loadBoard();
    });

    boardEl.appendChild(section);
  }
}

async function moveTaskRight(task, cols) {
  const currentIndex = cols.findIndex((c) => c.id === task.col_id);
  const nextCol = cols[currentIndex + 1];
  if (!nextCol) return;

  await api(`${API}/api/tasks/${task.id}/move`, {
    method: "POST",
    body: JSON.stringify({ col_id: nextCol.id, ord: 9999 }),
  });
}

loadBoard().catch((e) => {
  boardEl.textContent = "Błąd podczas ładowania tablicy.";
  console.error(e);
});