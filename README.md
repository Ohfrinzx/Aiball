# Velvet 8

A mobile-first 8-ball pool web game played against an AI opponent. All art and sound are original.

**Play:** https://ohfrinzx.github.io/Aiball/

## How to play (Phase 1: practice mode)

- **Aim:** drag anywhere on the table to rotate the cue around the cue ball, or tap a spot to
  point at it. Use the ribbed **fine-aim wheel** on the right (or the mouse wheel) for small
  adjustments.
- **Shoot:** press the **power slider** on the left, pull down, and release.
- **Spin:** tap the cue-ball button (top right) and tap where the cue should strike the ball.
- **Ball in hand:** before the break (behind the line) and after a scratch, drag the cue ball.
- **↻** re-racks. Add `?seed=123` to the URL for a reproducible rack.

## Development

```bash
npm install
npm run dev        # http://localhost:5173/
npm test           # unit (Vitest) + e2e (Playwright)
npm run build      # production build for GitHub Pages (dist/)
```

First-time Playwright setup: `npx playwright install chromium`.

Contributors and agents: read [`AGENTS.md`](AGENTS.md) and [`PROGRESS.md`](PROGRESS.md) first.
