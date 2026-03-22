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
};

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

export function findHint(state: GameState): Hint | null {
  if (state.status !== "playing") return null;

  const single = findSingleClueHint(state);
  if (single) return single;

  return findPairwiseSubsetHint(state);
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

  return { kind: "fallback", title: hint.title, body: hint.body };
}
