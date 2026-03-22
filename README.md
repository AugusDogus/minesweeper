# Minesweeper

![Minesweeper in dark mode (Intermediate difficulty, new game)](docs/screenshot.png)

## Development

This repo uses **Vite+** (`vp`) as the unified toolchain. Use `vp` for install, dev, build, test, and lint — not raw `pnpm`/`npm` for package changes (see `AGENTS.md` in the project).

```bash
vp install          # dependencies
vp dev              # dev server (same options as Vite)
vp check            # format, lint, TypeScript
vp test             # Vitest
vp build            # production build
```

Custom `package.json` scripts named `dev` / `build` exist for compatibility; `vp dev` / `vp build` invoke the toolchain directly.

## Project layout

| Path              | Role                                                            |
| ----------------- | --------------------------------------------------------------- |
| `src/game.ts`     | Core game logic and rules                                       |
| `src/hints.ts`    | Deducible-move hints (basic counting, pairwise overlap / 1–2–1) |
| `src/App.tsx`     | UI, theme, help dialog, and board                               |
| `src/components/` | Hint copy, region preview, shadcn UI pieces                     |
