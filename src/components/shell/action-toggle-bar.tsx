import { Eye, Flag } from "lucide-react";

import type { ActionMode } from "@/lib/game-settings.ts";
import { cn } from "@/lib/utils.ts";

export function ActionToggleBar({
  value,
  onChange,
}: {
  value: ActionMode;
  onChange: (mode: ActionMode) => void;
}) {
  return (
    <div className="action-toggle">
      <button
        type="button"
        className={cn(
          "action-toggle__button",
          value === "reveal" && "action-toggle__button--active",
        )}
        onClick={() => onChange("reveal")}
      >
        <Eye className="size-4" />
        Reveal
      </button>
      <button
        type="button"
        className={cn("action-toggle__button", value === "flag" && "action-toggle__button--active")}
        onClick={() => onChange("flag")}
      >
        <Flag className="size-4" />
        Flag
      </button>
    </div>
  );
}
