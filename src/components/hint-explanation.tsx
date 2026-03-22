import { HINT_CLUE_A_RING, HINT_CLUE_B_RING, HINT_SCOPE_SURFACE } from "@/lib/hint-clue-rings.ts";
import { cn } from "@/lib/utils";

import type { HintNarrative } from "@/hints.ts";

function minesWord(n: number): string {
  return n === 1 ? "mine" : "mines";
}

const CLUE_DIGIT_CLASS: Record<number, string> = {
  1: "text-[var(--n1)]",
  2: "text-[var(--n2)]",
  3: "text-[var(--n3)]",
  4: "text-[var(--n4)]",
  5: "text-[var(--n5)]",
  6: "text-[var(--n6)]",
  7: "text-[var(--n7)]",
  8: "text-[var(--n8)]",
};

export function ClueChip({ n }: { n: number }) {
  return (
    <span
      className={cn(
        "mx-0.5 inline-grid size-[1.15rem] shrink-0 place-items-center rounded-sm border border-foreground/10 bg-background align-middle text-[0.65rem] font-bold leading-none ring-2 ring-inset ring-ring tabular-nums",
        CLUE_DIGIT_CLASS[n] ?? "",
      )}
      aria-hidden
    >
      {n}
    </span>
  );
}

export function ClueMarkChip({ n, mark }: { n: number; mark: "a" | "b" }) {
  const ring = mark === "a" ? HINT_CLUE_A_RING : HINT_CLUE_B_RING;
  return (
    <span
      className={cn(
        "mx-0.5 inline-grid size-[1.15rem] shrink-0 place-items-center rounded-sm border border-foreground/10 bg-background align-middle text-[0.65rem] font-bold leading-none ring-2 ring-inset tabular-nums",
        ring,
        CLUE_DIGIT_CLASS[n] ?? "",
      )}
      aria-hidden
    >
      {n}
    </span>
  );
}

/** Inline hidden tile matching amber (action) highlight */
export function AmberChip() {
  return (
    <span
      className="mx-0.5 inline-block size-[1.15rem] shrink-0 align-middle rounded-sm border-2 border-t-[hsl(220,14%,92%)] border-l-[hsl(220,14%,92%)] border-b-[hsl(220,14%,58%)] border-r-[hsl(220,14%,58%)] bg-[hsl(220,14%,80%)] ring-2 ring-inset ring-amber-500 dark:border-t-[hsl(220,10%,44%)] dark:border-l-[hsl(220,10%,44%)] dark:border-b-[hsl(220,10%,18%)] dark:border-r-[hsl(220,10%,18%)] dark:bg-[hsl(220,10%,32%)] dark:ring-amber-400"
      aria-hidden
    />
  );
}

function ScopeChip() {
  return (
    <span
      className={cn(
        "mx-0.5 inline-block size-[1.15rem] shrink-0 align-middle rounded-sm",
        HINT_SCOPE_SURFACE,
      )}
      aria-hidden
    />
  );
}

export function HintExplanation({ narrative }: { narrative: HintNarrative }) {
  if (narrative.kind === "fallback") {
    return <p className="leading-relaxed text-muted-foreground">{narrative.body}</p>;
  }

  if (narrative.kind === "basic-mines") {
    const { adjacent, eff, n } = narrative;
    return (
      <p className="leading-relaxed text-muted-foreground">
        The ringed clue <ClueChip n={adjacent} /> still needs {eff} {minesWord(eff)} among {n}{" "}
        hidden neighbor{n === 1 ? "" : "s"}. The numbers line up, so each <AmberChip /> must be a
        mine — flag {n === 1 ? "it" : "them"}.
      </p>
    );
  }

  if (narrative.kind === "basic-safe") {
    const { n } = narrative;
    return (
      <p className="leading-relaxed text-muted-foreground">
        Every mine the ringed clue needs is already flagged. The highlighted hidden{" "}
        {n === 1 ? "square " : "squares "}
        <AmberChip /> {n === 1 ? "is" : "are"} safe — {n === 1 ? "reveal it" : "reveal them"}.
      </p>
    );
  }

  if (narrative.kind === "multi-clue") {
    const { mustMine } = narrative;
    return (
      <div className="space-y-3">
        <p className="leading-relaxed text-muted-foreground">
          The <span className="font-medium text-foreground">amber outline</span> marks the hidden
          cell you should play on. The thin{" "}
          <span className="font-medium text-foreground">rings</span> sit on clue numbers to show
          which clues are used—they are not pointing at a mine; they are just highlighting those
          digits.
        </p>
        <p className="leading-relaxed text-muted-foreground">
          Those clues share overlapping hidden neighbors. If you list every way to place mines in
          that region that still satisfies{" "}
          <span className="font-medium text-foreground">all of those clues at once</span>,{" "}
          {mustMine ? (
            <>
              every valid placement puts a mine on the amber <AmberChip /> square—flag it.
            </>
          ) : (
            <>
              none of them can put a mine on the amber <AmberChip /> square—so that square must be
              empty. Reveal it.
            </>
          )}
        </p>
      </div>
    );
  }

  const { dSmall, mSmall, dLarge, mLarge, need, nFocus, oneTwoOne, kind } = narrative;
  const isMines = kind === "subset-mines";

  const intro = (
    <p className="leading-relaxed text-muted-foreground">
      Every hidden square next to <ClueMarkChip n={dSmall} mark="a" /> is also next to{" "}
      <ClueMarkChip n={dLarge} mark="b" />. The overlap is the tinted <ScopeChip /> area in the
      preview.
    </p>
  );

  const smallPara =
    mSmall === 0 ? (
      <p className="leading-relaxed text-muted-foreground">
        <ClueMarkChip n={dSmall} mark="a" /> already has every required mine accounted for next to
        it (nothing left to place among hidden neighbors).
      </p>
    ) : (
      <p className="leading-relaxed text-muted-foreground">
        <ClueMarkChip n={dSmall} mark="a" /> still needs {mSmall} {minesWord(mSmall)} among its
        hidden neighbors, and those neighbors are all shared with{" "}
        <ClueMarkChip n={dLarge} mark="b" />.
      </p>
    );

  const largePara =
    mLarge === 0 ? (
      <p className="leading-relaxed text-muted-foreground">
        <ClueMarkChip n={dLarge} mark="b" /> also has no mines left to place among hidden neighbors.
      </p>
    ) : (
      <p className="leading-relaxed text-muted-foreground">
        <ClueMarkChip n={dLarge} mark="b" /> still needs {mLarge} {minesWord(mLarge)} among its
        hidden neighbors in total (the overlap plus any extra squares only{" "}
        <ClueMarkChip n={dLarge} mark="b" /> touches).
      </p>
    );

  const safeConclusion =
    mSmall === 0 ? (
      <p className="leading-relaxed text-muted-foreground">
        The <AmberChip /> {nFocus === 1 ? "square touches" : "squares touch"}{" "}
        <ClueMarkChip n={dLarge} mark="b" /> but not <ClueMarkChip n={dSmall} mark="a" /> alone, so{" "}
        {nFocus === 1 ? "it" : "they"} cannot be mines—safe to reveal{" "}
        {nFocus === 1 ? "it." : "them."}
      </p>
    ) : (
      <p className="leading-relaxed text-muted-foreground">
        <ClueMarkChip n={dSmall} mark="a" /> and <ClueMarkChip n={dLarge} mark="b" /> each still
        need {mLarge} {minesWord(mLarge)} among their hidden neighbors. Every mine{" "}
        <ClueMarkChip n={dSmall} mark="a" /> needs must sit in the overlap, and that uses{" "}
        <ClueMarkChip n={dLarge} mark="b" />
        {"'s"} full count—so the squares that touch <ClueMarkChip n={dLarge} mark="b" /> but not{" "}
        <ClueMarkChip n={dSmall} mark="a" /> alone—the <AmberChip />{" "}
        {nFocus === 1 ? "square" : "squares"}—must be safe. Reveal {nFocus === 1 ? "it" : "them"}.
      </p>
    );

  const minesConclusion =
    mSmall === 0 ? (
      <p className="leading-relaxed text-muted-foreground">
        The <AmberChip /> {nFocus === 1 ? "square is" : "squares are"} the only hidden{" "}
        {nFocus === 1 ? "neighbor" : "neighbors"} <ClueMarkChip n={dLarge} mark="b" /> still has
        beyond <ClueMarkChip n={dSmall} mark="a" />
        {"'s"} neighborhood—{need === 1 ? "that is" : "those are"} where{" "}
        <ClueMarkChip n={dLarge} mark="b" />
        {"'s"} remaining {need} {minesWord(need)} must go. Flag {nFocus === 1 ? "it" : "them"}.
      </p>
    ) : (
      <p className="leading-relaxed text-muted-foreground">
        After <ClueMarkChip n={dSmall} mark="a" />
        {"'s"} {mSmall} {minesWord(mSmall)} in the overlap, <ClueMarkChip n={dLarge} mark="b" />{" "}
        still needs {need} more {minesWord(need)} in the cells only{" "}
        <ClueMarkChip n={dLarge} mark="b" /> can see—the <AmberChip />{" "}
        {nFocus === 1 ? "square" : "squares"}—so {nFocus === 1 ? "it" : "they"} must be mines. Flag{" "}
        {nFocus === 1 ? "it" : "them"}.
      </p>
    );

  const oneTwo = oneTwoOne ? (
    <p className="leading-relaxed text-muted-foreground/90">
      This is the usual 1–2–1 pattern: past the shared neighbors, those cells are all{" "}
      {isMines ? "mines" : "safe"}.
    </p>
  ) : null;

  return (
    <div className="space-y-3">
      {intro}
      {smallPara}
      {largePara}
      {isMines ? minesConclusion : safeConclusion}
      {oneTwo}
    </div>
  );
}
