import "./style.css";
import {
  type Difficulty,
  DIFFICULTIES,
  createGame,
  flagCount,
  reveal,
  tickTimer,
  toggleFlag,
  type GameState,
} from "./game.ts";

let state: GameState = createGame(DIFFICULTIES[1]!);
let timerId: ReturnType<typeof setInterval> | undefined;

const app = document.querySelector<HTMLDivElement>("#app")!;

function minesRemaining(s: GameState): number {
  return Math.max(0, s.mineTotal - flagCount(s));
}

function formatTime(seconds: number): string {
  const s = Math.min(999, Math.floor(seconds));
  return String(s).padStart(3, "0");
}

function stopTimer(): void {
  if (timerId !== undefined) {
    clearInterval(timerId);
    timerId = undefined;
  }
}

function startTimer(): void {
  stopTimer();
  timerId = setInterval(() => {
    tickTimer(state, 1);
    render();
  }, 1000);
}

function cellLabel(row: number, col: number): string {
  const i = row * state.cols + col;
  const cell = state.cells[i]!;
  if (cell.flagged && state.status !== "lost") return "🚩";
  if (!cell.revealed) return "";
  if (cell.isMine) return "●";
  if (cell.adjacent === 0) return "";
  return String(cell.adjacent);
}

function cellClass(row: number, col: number): string {
  const i = row * state.cols + col;
  const cell = state.cells[i]!;
  const classes = ["cell"];
  if (!cell.revealed) classes.push("hidden");
  else classes.push("revealed");
  if (cell.revealed && !cell.isMine && cell.adjacent > 0) {
    classes.push(`n${cell.adjacent}`);
  }
  if (state.status === "lost" && cell.flagged && !cell.isMine) classes.push("mine-wrong");
  return classes.join(" ");
}

function faceEmoji(): string {
  switch (state.status) {
    case "idle":
      return "🙂";
    case "playing":
      return "🙂";
    case "won":
      return "😎";
    case "lost":
      return "💥";
    default: {
      const _exhaustive: never = state.status;
      return _exhaustive;
    }
  }
}

function render(): void {
  const diff = DIFFICULTIES.find(
    (d) => d.rows === state.rows && d.cols === state.cols && d.mines === state.mineTotal,
  );

  app.innerHTML = `
    <header class="game-header">
      <h1 class="title">Minesweeper</h1>
      <div class="toolbar">
        <label class="difficulty">
          <span class="sr-only">Difficulty</span>
          <select id="difficulty" aria-label="Difficulty">
            ${DIFFICULTIES.map(
              (d) =>
                `<option value="${d.id}" ${d === diff ? "selected" : ""}>${d.label} (${d.cols}×${d.rows}, ${d.mines} mines)</option>`,
            ).join("")}
          </select>
        </label>
        <div class="stats" role="status" aria-live="polite">
          <span class="lcd" title="Mines remaining">${String(minesRemaining(state)).padStart(3, "0")}</span>
          <button type="button" class="face" id="reset" aria-label="New game">${faceEmoji()}</button>
          <span class="lcd" title="Time">${formatTime(state.elapsedSeconds)}</span>
        </div>
      </div>
      <p class="hint">Left-click to reveal · Right-click to flag · First click is always safe</p>
    </header>
    <div
      class="board-wrap"
      style="--cols: ${state.cols}; --rows: ${state.rows};"
    >
      <div class="board" id="board" role="grid" aria-label="Minefield" aria-rowcount="${state.rows}" aria-colcount="${state.cols}">
        ${Array.from({ length: state.rows }, (_, row) =>
          Array.from({ length: state.cols }, (_, col) => {
            const r = row + 1;
            const c = col + 1;
            return `<button
              type="button"
              class="${cellClass(row, col)}"
              data-row="${row}"
              data-col="${col}"
              aria-label="Cell row ${r} column ${c}"
              aria-pressed="${state.cells[row * state.cols + col]!.flagged ? "true" : "false"}"
            >${cellLabel(row, col)}</button>`;
          }).join(""),
        ).join("")}
      </div>
    </div>
  `;

  const board = document.getElementById("board");
  board?.addEventListener("contextmenu", (e) => e.preventDefault());

  board?.querySelectorAll<HTMLButtonElement>(".cell").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = Number(btn.dataset.row);
      const col = Number(btn.dataset.col);
      const wasPlaying = state.status === "playing";
      state = reveal(state, row, col);
      if (!wasPlaying && state.status === "playing") startTimer();
      if (state.status === "won" || state.status === "lost") stopTimer();
      render();
    });
    btn.addEventListener("pointerdown", (e) => {
      if (e.button !== 2) return;
      e.preventDefault();
      const row = Number(btn.dataset.row);
      const col = Number(btn.dataset.col);
      state = toggleFlag(state, row, col);
      if (state.status === "won" || state.status === "lost") stopTimer();
      render();
    });
  });

  document.getElementById("reset")?.addEventListener("click", () => {
    reset();
  });

  document.getElementById("difficulty")?.addEventListener("change", (e) => {
    const id = (e.target as HTMLSelectElement).value;
    const d = DIFFICULTIES.find((x) => x.id === id);
    if (d) resetWithDifficulty(d);
  });
}

function reset(): void {
  const d =
    DIFFICULTIES.find(
      (x) => x.rows === state.rows && x.cols === state.cols && x.mines === state.mineTotal,
    ) ?? DIFFICULTIES[1]!;
  resetWithDifficulty(d);
}

function resetWithDifficulty(d: Difficulty): void {
  stopTimer();
  state = createGame(d);
  render();
}

render();
