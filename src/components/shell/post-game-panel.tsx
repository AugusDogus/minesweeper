import { Button } from "@/components/ui/button.tsx";
import { DifficultySwipeSelector } from "@/components/shell/difficulty-swipe-selector.tsx";
import type { Difficulty, GameStatus } from "@/game.ts";

export function PostGamePanel({
  status,
  difficulty,
  difficulties,
  onDifficultyChange,
  onNewGame,
}: {
  status: GameStatus;
  difficulty: Difficulty;
  difficulties: readonly Difficulty[];
  onDifficultyChange: (difficulty: Difficulty) => void;
  onNewGame: () => void;
}) {
  return (
    <div className="post-game-panel">
      <p className="post-game-panel__eyebrow">{status === "won" ? "Field Cleared" : "Mine Hit"}</p>
      <Button size="lg" className="post-game-panel__button" onClick={onNewGame}>
        Start New Game
      </Button>
      <DifficultySwipeSelector
        value={difficulty.id}
        onChange={onDifficultyChange}
        options={difficulties}
      />
    </div>
  );
}
