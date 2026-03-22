export type GameStatus = "idle" | "playing" | "won" | "lost";

export type Difficulty = {
  readonly id: string;
  readonly label: string;
  readonly rows: number;
  readonly cols: number;
  readonly mines: number;
};

export const DIFFICULTIES: readonly Difficulty[] = [
  { id: "beginner", label: "Beginner", rows: 9, cols: 9, mines: 10 },
  { id: "intermediate", label: "Intermediate", rows: 16, cols: 16, mines: 40 },
  { id: "expert", label: "Expert", rows: 16, cols: 30, mines: 99 },
] as const;

export type Cell = {
  isMine: boolean;
  adjacent: number;
  revealed: boolean;
  flagged: boolean;
};

export type GameState = {
  readonly rows: number;
  readonly cols: number;
  readonly mineTotal: number;
  readonly cells: Cell[];
  status: GameStatus;
  started: boolean;
  /** Seconds since first reveal (only while playing). */
  elapsedSeconds: number;
};

function index(cols: number, row: number, col: number): number {
  return row * cols + col;
}

function neighbors(
  rows: number,
  cols: number,
  row: number,
  col: number,
): readonly [number, number][] {
  const out: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < rows && c >= 0 && c < cols) out.push([r, c]);
    }
  }
  return out;
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

/** Deep clone for undo snapshots (cells are mutable during play). */
export function cloneGameState(state: GameState): GameState {
  return {
    ...state,
    cells: state.cells.map((c) => ({ ...c })),
  };
}

/** Whether a left-click reveal would change state (not a no-op). */
export function isRevealable(state: GameState, row: number, col: number): boolean {
  if (state.status === "won" || state.status === "lost") return false;
  if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) return false;
  const cell = state.cells[index(state.cols, row, col)]!;
  if (cell.flagged || cell.revealed) return false;
  return true;
}

export function createGame(difficulty: Difficulty): GameState {
  const { rows, cols, mines } = difficulty;
  const cells: Cell[] = Array.from({ length: rows * cols }, () => ({
    isMine: false,
    adjacent: 0,
    revealed: false,
    flagged: false,
  }));
  return {
    rows,
    cols,
    mineTotal: mines,
    cells,
    status: "idle",
    started: false,
    elapsedSeconds: 0,
  };
}

function placeMines(state: GameState, safeRow: number, safeCol: number): void {
  const { rows, cols, mineTotal, cells } = state;
  const safe = new Set<number>();
  safe.add(index(cols, safeRow, safeCol));
  for (const [r, c] of neighbors(rows, cols, safeRow, safeCol)) {
    safe.add(index(cols, r, c));
  }

  const candidates: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (!safe.has(i)) candidates.push(i);
  }

  if (mineTotal > candidates.length) {
    throw new Error("Not enough cells to place mines without overlapping the safe zone");
  }

  shuffleInPlace(candidates);
  const mineIndices = new Set(candidates.slice(0, mineTotal));

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;
    cell.isMine = mineIndices.has(i);
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = index(cols, r, c);
      const cell = cells[i]!;
      if (cell.isMine) {
        cell.adjacent = 0;
        continue;
      }
      let count = 0;
      for (const [nr, nc] of neighbors(rows, cols, r, c)) {
        const ni = index(cols, nr, nc);
        if (cells[ni]!.isMine) count++;
      }
      cell.adjacent = count;
    }
  }
}

function revealCell(state: GameState, row: number, col: number): void {
  const { rows, cols, cells } = state;
  const i = index(cols, row, col);
  const cell = cells[i]!;
  if (cell.revealed || cell.flagged) return;

  cell.revealed = true;

  if (cell.isMine) {
    state.status = "lost";
    for (const c of cells) {
      if (c.isMine) c.revealed = true;
    }
    return;
  }

  if (cell.adjacent === 0) {
    for (const [nr, nc] of neighbors(rows, cols, row, col)) {
      revealCell(state, nr, nc);
    }
  }
}

function checkWin(state: GameState): boolean {
  const { cells } = state;
  for (const c of cells) {
    if (!c.isMine && !c.revealed) return false;
  }
  return true;
}

export function flagCount(state: GameState): number {
  return state.cells.reduce((n, c) => n + (c.flagged ? 1 : 0), 0);
}

/**
 * If the player's flags contradict any revealed clue (too many flags, or not enough hidden
 * neighbors left for the mines still required), returns a short message pointing at one problem.
 * Does not validate flags against the hidden mine layout—only local clue arithmetic.
 */
export function describeLocalFlagContradictions(state: GameState): string | null {
  if (state.status !== "playing") return null;
  const { rows, cols, cells } = state;
  const at = (r: number, c: number) => cells[r * cols + c]!;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = at(r, c);
      if (!cell.revealed || cell.isMine || cell.adjacent === 0) continue;

      let flagged = 0;
      let hiddenUnflagged = 0;
      for (const [nr, nc] of neighbors(rows, cols, r, c)) {
        const n = at(nr, nc);
        if (n.flagged) flagged++;
        else if (!n.revealed) hiddenUnflagged++;
      }

      const remaining = cell.adjacent - flagged;
      const rc = `${r + 1}, ${c + 1}`;

      if (remaining < 0) {
        return (
          `Too many flags next to a clue showing ${cell.adjacent} (at row ${rc}). ` +
          `Remove a flag touching that number.`
        );
      }
      if (remaining > hiddenUnflagged) {
        return `A clue showing ${cell.adjacent} (at row ${rc}) still needs ${remaining} more mine${
          remaining === 1 ? "" : "s"
        } among hidden neighbors, but only ${hiddenUnflagged} hidden square${
          hiddenUnflagged === 1 ? "" : "s"
        } remain—check flags around that clue.`;
      }
    }
  }
  return null;
}

/** Shown when the hint engine finds no forced move but clues and flags agree locally. */
export const NO_FORCED_MOVE_HINT =
  "When no clue forces the next step, guessing is normal—try another edge or a low-risk square.";

export function tickTimer(state: GameState, deltaSeconds: number): void {
  if (state.status !== "playing") return;
  state.elapsedSeconds += deltaSeconds;
}

export function reveal(state: GameState, row: number, col: number): GameState {
  if (state.status === "won" || state.status === "lost") return state;

  const { rows, cols, cells } = state;
  if (row < 0 || row >= rows || col < 0 || col >= cols) return state;

  const cell = cells[index(cols, row, col)]!;
  if (cell.flagged || cell.revealed) return state;

  if (!state.started) {
    placeMines(state, row, col);
    state.started = true;
    state.status = "playing";
  }

  revealCell(state, row, col);

  if (state.status === "playing" && checkWin(state)) {
    state.status = "won";
    for (const c of cells) {
      if (c.isMine && !c.flagged) c.flagged = true;
    }
  }

  return state;
}

export function toggleFlag(state: GameState, row: number, col: number): GameState {
  if (state.status === "won" || state.status === "lost") return state;

  const { rows, cols, cells } = state;
  if (row < 0 || row >= rows || col < 0 || col >= cols) return state;

  const cell = cells[index(cols, row, col)]!;
  if (cell.revealed) return state;

  const flags = flagCount(state);
  if (!cell.flagged && flags >= state.mineTotal) return state;

  cell.flagged = !cell.flagged;

  if (state.status === "playing" && checkWin(state)) {
    state.status = "won";
    for (const c of cells) {
      if (c.isMine && !c.flagged) c.flagged = true;
    }
  }

  return state;
}
