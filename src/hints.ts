import type { Cell, GameState } from "./game.ts";

export type HintRole = "clue" | "clue-a" | "clue-b" | "scope" | "focus";

export function isClueRole(role: HintRole): role is "clue" | "clue-a" | "clue-b" {
  return role === "clue" || role === "clue-a" || role === "clue-b";
}

export type HintCell = {
  readonly row: number;
  readonly col: number;
  readonly role: HintRole;
};

/** Mini schematic rows: ? unknown, · revealed empty, F flag, 1–8 clue digits */
export type ExampleSpec = {
  readonly rows: readonly string[];
};

export type Hint = {
  readonly patternId: string;
  readonly title: string;
  readonly body: string;
  readonly cells: readonly HintCell[];
  readonly example: ExampleSpec;
};

function cellIndex(cols: number, row: number, col: number): number {
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

function key(row: number, col: number): string {
  return `${row},${col}`;
}

function parseKey(k: string): readonly [number, number] {
  const [r, c] = k.split(",").map(Number) as [number, number];
  return [r!, c!];
}

function getCell(state: GameState, row: number, col: number): Cell {
  return state.cells[cellIndex(state.cols, row, col)]!;
}

function unknownUnflaggedNeighbors(state: GameState, row: number, col: number): Set<string> {
  const { rows, cols } = state;
  const unk = new Set<string>();
  for (const [nr, nc] of neighbors(rows, cols, row, col)) {
    const c = getCell(state, nr, nc);
    if (!c.revealed && !c.flagged) unk.add(key(nr, nc));
  }
  return unk;
}

/** Mines still to place among unknown neighbors (assumes flags mark real mines). */
function effectiveMineCount(state: GameState, row: number, col: number): number | null {
  const cell = getCell(state, row, col);
  if (!cell.revealed || cell.isMine) return null;
  let flagged = 0;
  for (const [nr, nc] of neighbors(state.rows, state.cols, row, col)) {
    if (getCell(state, nr, nc).flagged) flagged++;
  }
  return cell.adjacent - flagged;
}

/** Positions with a positive clue digit (subset pairing ignores bare 0s; those are handled by single-clue). */
function revealedCluePositionsForSubset(state: GameState): [number, number][] {
  const out: [number, number][] = [];
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = getCell(state, r, c);
      if (cell.revealed && !cell.isMine && cell.adjacent > 0) out.push([r, c]);
    }
  }
  return out;
}

function isSubset(a: Set<string>, b: Set<string>): boolean {
  for (const x of a) {
    if (!b.has(x)) return false;
  }
  return true;
}

function setDifference(b: Set<string>, a: Set<string>): string[] {
  const out: string[] = [];
  for (const x of b) {
    if (!a.has(x)) out.push(x);
  }
  return out;
}

function intersection(a: Set<string>, b: Set<string>): string[] {
  const out: string[] = [];
  for (const x of a) {
    if (b.has(x)) out.push(x);
  }
  return out;
}

function mergeHintCells(entries: Iterable<HintCell>): HintCell[] {
  const byKey = new Map<string, HintCell>();
  const priority: Record<HintRole, number> = {
    clue: 3,
    "clue-a": 3,
    "clue-b": 3,
    focus: 2,
    scope: 1,
  };
  for (const h of entries) {
    const k = key(h.row, h.col);
    const prev = byKey.get(k);
    if (!prev || priority[h.role] > priority[prev.role]) byKey.set(k, h);
  }
  return [...byKey.values()];
}

const EXAMPLES: Record<string, ExampleSpec> = {
  "subset-mines": {
    rows: ["? ? ·", "3 2 ·", "? ? ·"],
  },
  "subset-safe": {
    rows: ["? ? ·", "2 4 ·", "? ? ·"],
  },
  "one-two-one": {
    rows: ["· ? ? ? ·", "· 1 2 1 ·"],
  },
  "basic-mines": {
    rows: ["? ? ?", "· 3 ·"],
  },
  "basic-safe": {
    rows: ["? ? ?", "· 2 ·"],
  },
  "multi-clue": {
    rows: ["? ? ·", "? ? ·", "· 2 ·"],
  },
};

/** Max unknown cells per multi-clue CSP search (full component or one sliding window). */
export const CSP_HINT_WINDOW_SIZE = 50;

type ClueConstraint = {
  readonly clueRow: number;
  readonly clueCol: number;
  readonly indices: readonly number[];
  readonly k: number;
};

function indexToRC(cols: number, i: number): readonly [number, number] {
  return [Math.floor(i / cols), i % cols];
}

/** Unknown-unflagged frontier cells, grouped by shared clues (union-find). */
function buildFrontierComponents(state: GameState): number[][] {
  const { rows, cols } = state;
  const frontier = new Set<number>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = getCell(state, r, c);
      if (!cell.revealed || cell.isMine || cell.adjacent === 0) continue;
      const eff = effectiveMineCount(state, r, c);
      if (eff === null || eff < 0) continue;
      for (const k of unknownUnflaggedNeighbors(state, r, c)) {
        const [rr, cc] = parseKey(k);
        frontier.add(cellIndex(cols, rr, cc));
      }
    }
  }
  if (frontier.size === 0) return [];

  const parent = new Map<number, number>();
  const find = (x: number): number => {
    let p = parent.get(x);
    if (p === undefined) {
      parent.set(x, x);
      return x;
    }
    if (p !== x) {
      p = find(p);
      parent.set(x, p);
    }
    return p;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const f of frontier) parent.set(f, f);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = getCell(state, r, c);
      if (!cell.revealed || cell.isMine || cell.adjacent === 0) continue;
      const unk = unknownUnflaggedNeighbors(state, r, c);
      if (unk.size < 2) continue;
      const arr = [...unk].map((key) => {
        const [rr, cc] = parseKey(key);
        return cellIndex(cols, rr, cc);
      });
      const a0 = arr[0]!;
      for (let i = 1; i < arr.length; i++) union(a0, arr[i]!);
    }
  }

  const groups = new Map<number, number[]>();
  for (const f of frontier) {
    const root = find(f);
    const g = groups.get(root) ?? [];
    g.push(f);
    groups.set(root, g);
  }
  return [...groups.values()];
}

/** All unknown-unflagged frontier indices, sorted by row-major order. */
function getSortedFrontierIndices(state: GameState): number[] {
  const { rows, cols } = state;
  const frontier = new Set<number>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = getCell(state, r, c);
      if (!cell.revealed || cell.isMine || cell.adjacent === 0) continue;
      const eff = effectiveMineCount(state, r, c);
      if (eff === null || eff < 0) continue;
      for (const k of unknownUnflaggedNeighbors(state, r, c)) {
        const [rr, cc] = parseKey(k);
        frontier.add(cellIndex(cols, rr, cc));
      }
    }
  }
  return [...frontier].sort((a, b) => a - b);
}

/** How many sliding windows of size {@link CSP_HINT_WINDOW_SIZE} cover the frontier (0 if empty). */
export function getCspFrontierMeta(state: GameState): {
  frontierSize: number;
  windowCount: number;
} {
  if (state.status !== "playing") return { frontierSize: 0, windowCount: 0 };
  const sorted = getSortedFrontierIndices(state);
  const n = sorted.length;
  if (n === 0) return { frontierSize: 0, windowCount: 0 };
  return { frontierSize: n, windowCount: Math.ceil(n / CSP_HINT_WINDOW_SIZE) };
}

function collectClueConstraintsForComponent(state: GameState, comp: Set<number>): ClueConstraint[] {
  const { rows, cols } = state;
  const out: ClueConstraint[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = getCell(state, r, c);
      if (!cell.revealed || cell.isMine || cell.adjacent === 0) continue;
      const eff = effectiveMineCount(state, r, c);
      if (eff === null || eff < 0) continue;
      const unk = unknownUnflaggedNeighbors(state, r, c);
      if (unk.size === 0) continue;
      const idxs: number[] = [];
      for (const k of unk) {
        const [rr, cc] = parseKey(k);
        const i = cellIndex(cols, rr, cc);
        idxs.push(i);
      }
      if (!idxs.every((i) => comp.has(i))) continue;
      out.push({ clueRow: r, clueCol: c, indices: idxs, k: eff });
    }
  }
  return out;
}

function partialConsistent(
  constraints: readonly ClueConstraint[],
  assignment: Map<number, 0 | 1>,
): boolean {
  for (const { indices, k } of constraints) {
    let assigned = 0;
    let unassigned = 0;
    for (const i of indices) {
      const v = assignment.get(i);
      if (v === undefined) unassigned++;
      else assigned += v;
    }
    if (assigned > k) return false;
    if (assigned + unassigned < k) return false;
  }
  return true;
}

function hasAssignmentSolution(
  vars: readonly number[],
  constraints: readonly ClueConstraint[],
  assignment: Map<number, 0 | 1>,
): boolean {
  if (!partialConsistent(constraints, assignment)) return false;
  const unassigned = vars.filter((v) => !assignment.has(v));
  if (unassigned.length === 0) {
    for (const { indices, k } of constraints) {
      let sum = 0;
      for (const i of indices) sum += assignment.get(i)!;
      if (sum !== k) return false;
    }
    return true;
  }
  const v = unassigned[0]!;
  assignment.set(v, 0);
  if (hasAssignmentSolution(vars, constraints, assignment)) {
    assignment.delete(v);
    return true;
  }
  assignment.delete(v);
  assignment.set(v, 1);
  if (hasAssignmentSolution(vars, constraints, assignment)) {
    assignment.delete(v);
    return true;
  }
  assignment.delete(v);
  return false;
}

function tryForcedHintFromConstraints(
  state: GameState,
  constraints: ClueConstraint[],
): Hint | null {
  if (constraints.length === 0) return null;
  const { cols } = state;
  const varSet = new Set<number>();
  for (const c of constraints) {
    for (const i of c.indices) varSet.add(i);
  }
  const vars = [...varSet].sort((a, b) => a - b);
  const sortedVars = [...vars].sort((a, b) => {
    const da = constraints.reduce((n, c) => n + (c.indices.includes(a) ? 1 : 0), 0);
    const db = constraints.reduce((n, c) => n + (c.indices.includes(b) ? 1 : 0), 0);
    return db - da || a - b;
  });

  for (const idx of sortedVars) {
    const m0 = new Map<number, 0 | 1>();
    m0.set(idx, 0);
    const can0 = hasAssignmentSolution(sortedVars, constraints, m0);
    const m1 = new Map<number, 0 | 1>();
    m1.set(idx, 1);
    const can1 = hasAssignmentSolution(sortedVars, constraints, m1);

    if (can0 && can1) continue;
    if (!can0 && !can1) continue;

    const mustMine = !can0 && can1;
    const [fr, fc] = indexToRC(cols, idx);
    const cells: HintCell[] = [];
    for (const con of constraints) {
      cells.push({ row: con.clueRow, col: con.clueCol, role: "clue" });
    }
    cells.push({ row: fr, col: fc, role: "focus" });

    const patternId = mustMine ? "multi-clue-mines" : "multi-clue-safe";
    return {
      patternId,
      title: mustMine ? "Multiple clues (must be mines)" : "Multiple clues (must be safe)",
      body: "Several clues constrain the same overlapping region. Together they leave only one possibility for this cell—flag it or reveal it accordingly.",
      cells: mergeHintCells(cells),
      example: EXAMPLES["multi-clue"]!,
    };
  }
  return null;
}

function findMultiClueHint(state: GameState, cspWindowPass: number): Hint | null {
  const components = buildFrontierComponents(state);
  for (const compArr of components) {
    if (compArr.length === 0 || compArr.length > CSP_HINT_WINDOW_SIZE) continue;
    const comp = new Set(compArr);
    const constraints = collectClueConstraintsForComponent(state, comp);
    const h = tryForcedHintFromConstraints(state, constraints);
    if (h) return h;
  }

  const sortedFrontier = getSortedFrontierIndices(state);
  if (sortedFrontier.length <= CSP_HINT_WINDOW_SIZE) return null;

  const numWindows = Math.ceil(sortedFrontier.length / CSP_HINT_WINDOW_SIZE);
  const k = ((cspWindowPass % numWindows) + numWindows) % numWindows;
  const W = new Set(
    sortedFrontier.slice(k * CSP_HINT_WINDOW_SIZE, k * CSP_HINT_WINDOW_SIZE + CSP_HINT_WINDOW_SIZE),
  );
  const constraints = collectClueConstraintsForComponent(state, W);
  return tryForcedHintFromConstraints(state, constraints);
}

function subsetHintBody(allMines: boolean): string {
  if (allMines) {
    return (
      "One clue’s unknown neighbors are completely contained in another clue’s neighbors. " +
      "Subtract the smaller region from the larger: the remaining cells must all be mines."
    );
  }
  return (
    "One clue’s unknown neighbors are completely contained in another clue’s neighbors. " +
    "Subtract the smaller region from the larger: the remaining cells must all be safe."
  );
}

function isHorizontalOneTwoOne(
  state: GameState,
  r: number,
  c: number,
): { left: [number, number]; mid: [number, number]; right: [number, number] } | null {
  if (c + 2 >= state.cols) return null;
  const a = getCell(state, r, c);
  const b = getCell(state, r, c + 1);
  const right = getCell(state, r, c + 2);
  if (!a.revealed || a.isMine || !b.revealed || b.isMine || !right.revealed || right.isMine)
    return null;
  if (a.adjacent !== 1 || b.adjacent !== 2 || right.adjacent !== 1) return null;
  return { left: [r, c], mid: [r, c + 1], right: [r, c + 2] };
}

function isVerticalOneTwoOne(
  state: GameState,
  r: number,
  c: number,
): { left: [number, number]; mid: [number, number]; right: [number, number] } | null {
  if (r + 2 >= state.rows) return null;
  const a = getCell(state, r, c);
  const b = getCell(state, r + 1, c);
  const bottom = getCell(state, r + 2, c);
  if (!a.revealed || a.isMine || !b.revealed || b.isMine || !bottom.revealed || bottom.isMine)
    return null;
  if (a.adjacent !== 1 || b.adjacent !== 2 || bottom.adjacent !== 1) return null;
  return { left: [r, c], mid: [r + 1, c], right: [r + 2, c] };
}

function pairParticipatesInOneTwoOne(
  state: GameState,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
): boolean {
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const h = isHorizontalOneTwoOne(state, r, c);
      if (h) {
        const cells = [h.left, h.mid, h.right];
        if (
          cells.some((p) => p[0] === r1 && p[1] === c1) &&
          cells.some((p) => p[0] === r2 && p[1] === c2)
        ) {
          return true;
        }
      }
      const v = isVerticalOneTwoOne(state, r, c);
      if (v) {
        const cells = [v.left, v.mid, v.right];
        if (
          cells.some((p) => p[0] === r1 && p[1] === c1) &&
          cells.some((p) => p[0] === r2 && p[1] === c2)
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

function trySubsetPair(
  state: GameState,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
): Hint | null {
  const m1 = effectiveMineCount(state, r1, c1);
  const m2 = effectiveMineCount(state, r2, c2);
  if (m1 === null || m2 === null) return null;
  if (m1 < 0 || m2 < 0) return null;

  const U1 = unknownUnflaggedNeighbors(state, r1, c1);
  const U2 = unknownUnflaggedNeighbors(state, r2, c2);
  if (U1.size === 0 && U2.size === 0) return null;

  const tryDir = (
    small: Set<string>,
    large: Set<string>,
    minesSmall: number,
    minesLarge: number,
    clueSmall: [number, number],
    clueLarge: [number, number],
  ): Hint | null => {
    if (!isSubset(small, large)) return null;
    const diff = setDifference(large, small);
    if (diff.length === 0) return null;
    const need = minesLarge - minesSmall;
    if (need === diff.length) {
      return buildSubsetHint(state, clueSmall, clueLarge, small, large, diff, true);
    }
    if (need === 0) {
      return buildSubsetHint(state, clueSmall, clueLarge, small, large, diff, false);
    }
    return null;
  };

  let h = tryDir(U1, U2, m1, m2, [r1, c1], [r2, c2]);
  if (h) return h;
  h = tryDir(U2, U1, m2, m1, [r2, c2], [r1, c1]);
  return h;
}

function buildSubsetHint(
  state: GameState,
  clueSmall: [number, number],
  clueLarge: [number, number],
  small: Set<string>,
  large: Set<string>,
  diffKeys: string[],
  allMines: boolean,
): Hint {
  const overlap = intersection(small, large);
  const patternBase = allMines ? "subset-mines" : "subset-safe";
  const oneTwoOne =
    pairParticipatesInOneTwoOne(state, clueSmall[0], clueSmall[1], clueLarge[0], clueLarge[1]) ||
    pairParticipatesInOneTwoOne(state, clueLarge[0], clueLarge[1], clueSmall[0], clueSmall[1]);

  const patternId = oneTwoOne ? "one-two-one" : patternBase;
  const title = oneTwoOne
    ? "1–2–1 line"
    : allMines
      ? "Subtracting regions (all mines)"
      : "Subtracting regions (all safe)";

  const body = oneTwoOne
    ? "A 1–2–1 run often lets you compare the end 1s with the middle 2: the overlap leaves a remainder strip where every cell matches the same count. When the remainder must be all mines or all safe, flag or clear that strip."
    : subsetHintBody(allMines);

  const example = oneTwoOne ? EXAMPLES["one-two-one"]! : EXAMPLES[patternBase]!;

  const cells: HintCell[] = [];
  cells.push({ row: clueSmall[0], col: clueSmall[1], role: "clue-a" });
  cells.push({ row: clueLarge[0], col: clueLarge[1], role: "clue-b" });
  for (const k of overlap) {
    const [r, c] = parseKey(k);
    cells.push({ row: r, col: c, role: "scope" });
  }
  for (const k of diffKeys) {
    const [r, c] = parseKey(k);
    cells.push({ row: r, col: c, role: "focus" });
  }

  return {
    patternId,
    title,
    body,
    cells: mergeHintCells(cells),
    example,
  };
}

function findPairwiseSubsetHint(state: GameState): Hint | null {
  const clues = revealedCluePositionsForSubset(state);
  for (let i = 0; i < clues.length; i++) {
    for (let j = i + 1; j < clues.length; j++) {
      const [r1, c1] = clues[i]!;
      const [r2, c2] = clues[j]!;
      const h = trySubsetPair(state, r1, c1, r2, c2);
      if (h) return h;
    }
  }
  return null;
}

function findSingleClueHint(state: GameState): Hint | null {
  for (const mode of ["mines", "safe"] as const) {
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const cell = getCell(state, r, c);
        if (!cell.revealed || cell.isMine) continue;
        if (cell.adjacent === 0) continue;
        const eff = effectiveMineCount(state, r, c);
        if (eff === null || eff < 0) continue;
        const unk = unknownUnflaggedNeighbors(state, r, c);
        if (unk.size === 0) continue;
        const matches = mode === "mines" ? eff === unk.size : eff === 0;
        if (!matches) continue;
        const cells: HintCell[] = [{ row: r, col: c, role: "clue" }];
        for (const k of unk) {
          const [rr, cc] = parseKey(k);
          cells.push({ row: rr, col: cc, role: "focus" });
        }
        if (mode === "mines") {
          return {
            patternId: "basic-mines",
            title: "Basic counting (all mines)",
            body: "The clue’s remaining mine count equals the number of hidden neighbors, so every hidden neighbor must be a mine. Flag each of those cells.",
            cells: mergeHintCells(cells),
            example: EXAMPLES["basic-mines"]!,
          };
        }
        return {
          patternId: "basic-safe",
          title: "Basic counting (all safe)",
          body: "Every adjacent mine is already flagged, so the remaining hidden neighbors cannot be mines. Reveal them safely.",
          cells: mergeHintCells(cells),
          example: EXAMPLES["basic-safe"]!,
        };
      }
    }
  }
  return null;
}

export type FindHintOptions = {
  /**
   * Which sliding window of the frontier to search for multi-clue CSP (0-based).
   * Only matters when the frontier has more than {@link CSP_HINT_WINDOW_SIZE} cells.
   */
  readonly cspWindowPass?: number;
};

export function findHint(state: GameState, options?: FindHintOptions): Hint | null {
  if (state.status !== "playing") return null;

  const single = findSingleClueHint(state);
  if (single) return single;

  const pair = findPairwiseSubsetHint(state);
  if (pair) return pair;

  const pass = options?.cspWindowPass ?? 0;
  return findMultiClueHint(state, pass);
}

export type HintNarrative =
  | { kind: "basic-mines"; title: string; adjacent: number; eff: number; n: number }
  | { kind: "basic-safe"; title: string; n: number }
  | {
      kind: "subset-mines" | "subset-safe";
      title: string;
      dSmall: number;
      mSmall: number;
      dLarge: number;
      mLarge: number;
      need: number;
      nFocus: number;
      oneTwoOne: boolean;
    }
  | { kind: "multi-clue"; title: string; mustMine: boolean }
  | { kind: "fallback"; title: string; body: string };

export function getHintNarrative(state: GameState, hint: Hint): HintNarrative {
  const clues = hint.cells.filter((x) => isClueRole(x.role));
  const focus = hint.cells.filter((x) => x.role === "focus");

  if (hint.patternId === "basic-mines" || hint.patternId === "basic-safe") {
    const c = clues[0]!;
    const cell = getCell(state, c.row, c.col);
    const eff = effectiveMineCount(state, c.row, c.col);
    const n = focus.length;
    if (hint.patternId === "basic-mines" && eff !== null) {
      return {
        kind: "basic-mines",
        title: "Basic counting — all neighbors are mines",
        adjacent: cell.adjacent,
        eff,
        n,
      };
    }
    if (hint.patternId === "basic-safe") {
      return { kind: "basic-safe", title: "Basic counting — neighbors are safe", n };
    }
  }

  if (
    hint.patternId === "subset-mines" ||
    hint.patternId === "subset-safe" ||
    hint.patternId === "one-two-one"
  ) {
    const clueA = clues[0]!;
    const clueB = clues[1]!;
    const Ua = unknownUnflaggedNeighbors(state, clueA.row, clueA.col);
    const Ub = unknownUnflaggedNeighbors(state, clueB.row, clueB.col);
    let smallClue: HintCell;
    let largeClue: HintCell;
    if (isSubset(Ua, Ub)) {
      smallClue = clueA;
      largeClue = clueB;
    } else if (isSubset(Ub, Ua)) {
      smallClue = clueB;
      largeClue = clueA;
    } else {
      return { kind: "fallback", title: hint.title, body: hint.body };
    }
    const mSmall = effectiveMineCount(state, smallClue.row, smallClue.col);
    const mLarge = effectiveMineCount(state, largeClue.row, largeClue.col);
    const dSmall = getCell(state, smallClue.row, smallClue.col).adjacent;
    const dLarge = getCell(state, largeClue.row, largeClue.col).adjacent;
    const need = mSmall !== null && mLarge !== null ? mLarge - mSmall : Number.NaN;
    const isAllMines = Number.isFinite(need) && need === focus.length && focus.length > 0;
    const isAllSafe = Number.isFinite(need) && need === 0 && focus.length > 0;
    const nFocus = focus.length;
    const oneTwoOne = hint.patternId === "one-two-one";

    if (isAllMines) {
      return {
        kind: "subset-mines",
        title: oneTwoOne ? "1–2–1 line (overlap trick)" : "Subtract regions — all mines",
        dSmall,
        mSmall: mSmall ?? 0,
        dLarge,
        mLarge: mLarge ?? 0,
        need,
        nFocus,
        oneTwoOne,
      };
    }
    if (isAllSafe) {
      return {
        kind: "subset-safe",
        title: oneTwoOne ? "1–2–1 line (overlap trick)" : "Subtract regions — all safe",
        dSmall,
        mSmall: mSmall ?? 0,
        dLarge,
        mLarge: mLarge ?? 0,
        need,
        nFocus,
        oneTwoOne,
      };
    }
    return { kind: "fallback", title: hint.title, body: hint.body };
  }

  if (hint.patternId === "multi-clue-mines" || hint.patternId === "multi-clue-safe") {
    return {
      kind: "multi-clue",
      title:
        hint.patternId === "multi-clue-mines"
          ? "Multiple clues — this cell must be a mine"
          : "Multiple clues — this cell must be safe",
      mustMine: hint.patternId === "multi-clue-mines",
    };
  }

  return { kind: "fallback", title: hint.title, body: hint.body };
}
