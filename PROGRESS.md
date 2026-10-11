# PROGRESS.md — Velvet 8

> **Update this file in EVERY commit, by every agent, without exception** (see `AGENTS.md`).
> Live build: https://ohfrinzx.github.io/Aiball/

## Phase roadmap

- [ ] **Phase 0: Foundation** — scaffold, tooling, CI/CD, placeholder table, process docs
- [ ] **Phase 1: Physics, table, cue controls** — deterministic physics, full table + balls,
      GamePigeon-style aiming (guide line), power slider, cue-ball spin
- [ ] **Phase 2 (parallel): Rules engine | AI opponent | UI/menus and responsive polish**
- [ ] **Phase 3 (parallel): Audio, animations, PWA install, stats, settings**
- [ ] **Phase 4: Full review, bug fixing, performance on mobile**

Phase gate: a phase is complete only after its work is merged, deployed and the user has
playtested the live site and said "approved".

## Task board

### Todo

| Phase | Task                                        | Module(s)    | Notes                     |
| ----- | ------------------------------------------- | ------------ | ------------------------- |
| 2     | 8-ball rules engine                         | rules        |                           |
| 2     | AI opponent                                 | ai           | Uses physics `simulate()` |
| 2     | Menus, HUD, responsive polish               | ui, render   |                           |
| 3     | Audio                                       | audio        | Original sounds only      |
| 3     | Animations                                  | render       |                           |
| 3     | PWA manifest + service worker (offline)     | state/config |                           |
| 3     | Stats and settings                          | ui, state    |                           |
| 4     | Full review, bug fixing, mobile performance | all          |                           |

(Phase 2+ tasks will be refined into concrete branch-sized tasks when their phase starts.)

### In Progress

| Task                                                                                                                                                              | Agent                  | Branch                        | Started    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------- | ---------- |
| Phase 1 (all four tasks, one branch): physics + `simulate()`/`simulateShot()`; render balls/cue/guide line; aim drag + fine aim + power slider + spin; state loop | Claude (Phase 1 agent) | `claude/upbeat-newton-elmc39` | 2026-10-11 |

### In Review

| Task | Agent | Branch | PR  |
| ---- | ----- | ------ | --- |

### Done

| Task                                                                                                                   | Agent                  | Branch                                         | Merged     |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------- | ---------- |
| Phase 0: Foundation ([Ohfrinzx/Aiball#1](https://github.com/Ohfrinzx/Aiball/pull/1)) — awaiting user playtest approval | Claude (Phase 0 agent) | `claude/mobile-8ball-pool-architecture-psyp8z` | 2026-10-11 |

## Change log

Newest first. Format: `YYYY-MM-DD — who — what — why`.

- 2026-10-11 — Claude (Phase 1 agent) — Physics engine (`src/physics`: fixed 1/240 s step, continuous collision detection, slide→roll friction, top/back/side spin, rail english, pocket jaws with rattle, soft-contact clusters for the break, `simulate()`/`simulateShot()`/`predictAim()`), rack (`src/rules/rack.ts`), 7-ft table geometry with jaws (`src/shared`), unit tests — Phase 1 core mechanics. Shared changes: new types in `shared/types.ts` (BallState, TableState, ShotResult, ShotPlayback, AimPrediction, SceneView, InputHandlers, …), `TableGeometry` gained cushions/jawTips/cushionOutlines/headSpot, `Pocket` gained `mouth`, `ViewTransform` gained `tableRect`; `shared/tableGeometry.ts`, `shared/quat.ts` added. Affects render (table drawing) and every future module.
- 2026-10-11 — Claude (Phase 1 agent) — Claimed Phase 1 (physics, table + balls, cue controls, single-shot game loop) on branch `claude/upbeat-newton-elmc39` — user directed Phase 1 to start; the session's harness mandates this branch name instead of `phase1/...`.
- 2026-10-11 — Claude (Phase 0 agent) — Moved Phase 0 to Done on the task board — `ci` green on Ohfrinzx/Aiball#1; merging to main. Phase 0 checkbox stays open until the user playtests the live site and says "approved".
- 2026-10-11 — Claude (Phase 0 agent) — Linked Phase 0 PR (Ohfrinzx/Aiball#1) on the task board — track review state.
- 2026-10-11 — Claude (Phase 0 agent) — Scaffolded Vite + TS project, ESLint (with module
  boundary + determinism rules), Prettier, Vitest, Playwright; `src/` module folders with
  ownership headers; `src/shared` types/constants/RNG/vec2; responsive placeholder table
  (`render/layout.ts`, `render/tableRenderer.ts`, `state/app.ts`); unit + e2e tests; `ci` and
  `deploy` workflows; AGENTS.md and PROGRESS.md — Phase 0 foundation.
- 2026-10-11 — Claude (Phase 0 agent) — Bootstrap commit on `main` (README, .gitignore) — repo
  was empty; PR needed a base branch (one-time exception approved by the user).

## Known bugs and playtest feedback

### Known bugs

_None yet._

### Playtest feedback

| Date | Build / PR | Feedback | Status |
| ---- | ---------- | -------- | ------ |

## Decisions log

| Date       | Decision                                                                                                                                               | Reason                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| 2026-10-11 | Game name **Velvet 8** (`GAME_NAME` in `src/shared/constants.ts`)                                                                                      | Original name; must not use GamePigeon branding                                   |
| 2026-10-11 | Vite + TypeScript strict, Canvas 2D, no UI framework                                                                                                   | Few screens; plain DOM overlays keep bundle small and fast on phones              |
| 2026-10-11 | Custom deterministic physics, fixed timestep, seeded RNG; ESLint bans `Math.random`/`Date.now`/`performance.now` in physics/rules/ai                   | AI must simulate shots exactly as the game plays them                             |
| 2026-10-11 | Added `src/shared/` for all cross-module types and constants                                                                                           | Single shared place for interfaces avoids edit conflicts between agents           |
| 2026-10-11 | Table space in meters, landscape-oriented; portrait = 90° render transform (foot of table at top of screen)                                            | Physics/rules/AI stay orientation-agnostic; matches phone-portrait vertical table |
| 2026-10-11 | Table: 2.24 m × 1.12 m (2:1) playing surface, regulation 57.15 mm balls                                                                                | Standard 8-ft proportions; tune pocket sizes in Phase 1 to match reference feel   |
| 2026-10-11 | Import boundaries enforced via ESLint `no-restricted-imports`                                                                                          | Keeps module ownership mechanical, not just conventional                          |
| 2026-10-11 | Workflow: CI tests PR merged onto latest main → auto squash-merge when green → deploy → user playtests live site; user "approved" gates the next phase | User's choice; replaces per-PR preview hosting                                    |
| 2026-10-11 | GitHub Pages via official Actions deploy (`actions/deploy-pages`); Vite `base: '/Aiball/'` for build/preview                                           | Standard Pages setup; repo is served under `/Aiball/`                             |
| 2026-10-11 | TypeScript pinned to ~6.0                                                                                                                              | typescript-eslint 8 supports TS < 6.1                                             |
| 2026-10-11 | Original icon `public/icon.svg` drawn by hand in SVG                                                                                                   | Assets must be original                                                           |
