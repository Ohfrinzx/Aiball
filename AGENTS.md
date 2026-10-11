# AGENTS.md — rules for every agent working on Velvet 8

> **Read this file and `PROGRESS.md` in full before doing anything.**
> **`PROGRESS.md` must be updated in EVERY commit, by every agent, without exception.**

## 1. Project goal

**Velvet 8** is a mobile-first 8-ball pool web game played against an AI opponent.

**The rule:** the game must match GamePigeon's 8-Ball **1:1 in feel, controls, rules and flow** — table
proportions, aiming with the guide line, the power slider, cue-ball spin selector, ball-in-hand,
turn flow, win/loss screens — while using **only original assets**. Never use GamePigeon's name,
logo, art, sounds, fonts or screenshots anywhere in the repo or the shipped game. Reference the
original only for behaviour; recreate everything visual and audible from scratch.

Targets: phones in portrait (primary), desktop/laptop in landscape/fullscreen; touch and mouse;
installable PWA that works offline (Phase 3). Hosted on GitHub Pages:
`https://ohfrinzx.github.io/Aiball/`.

## 2. Tech stack

| Concern    | Choice                                              |
| ---------- | --------------------------------------------------- |
| Build/dev  | Vite + TypeScript (strict)                          |
| Rendering  | HTML5 Canvas 2D; UI as plain DOM overlays           |
| Physics    | Custom deterministic 2D engine (no physics library) |
| Unit tests | Vitest (`tests/unit/`)                              |
| E2E tests  | Playwright (`tests/e2e/`), phone + desktop projects |
| Lint/style | ESLint (flat config, typescript-eslint) + Prettier  |
| CI/CD      | GitHub Actions: `ci` on PRs, `deploy` on main       |

Commands: `npm install`, `npm run dev`, `npm test` (unit + e2e), `npm run test:unit`,
`npm run test:e2e`, `npm run lint`, `npm run format`, `npm run typecheck`, `npm run build`.
In a sandbox with a pre-installed Chromium, run e2e with `PW_CHROMIUM_PATH=/path/to/chrome`.

## 3. Architecture

### Coordinate system

All game logic works in **table space**: meters, origin at the center of the playing surface,
`+x` along the table's length toward the foot rail, `+y` across. Physics, rules and AI never know
about the screen. `render/layout.ts` produces a `ViewTransform` (from `shared/types.ts`) that maps
table space ↔ screen pixels, including the 90° rotation used in portrait. `input` receives that
transform from `state` to convert touches into table space.

### Determinism

Physics runs on a fixed timestep with no wall-clock time and no `Math.random` (enforced by ESLint
in `physics`, `rules`, `ai`). Randomness comes from `createRng(seed)` in `shared/rng.ts`. The AI
evaluates candidate shots by running the exact same simulation the game uses.

### Module ownership

| Folder              | Owns                                                                      | May import                |
| ------------------- | ------------------------------------------------------------------------- | ------------------------- |
| `src/shared`        | Cross-module types/interfaces, constants (table geometry), RNG, vec2 math | nothing                   |
| `src/physics`       | Ball motion, friction, spin, ball/cushion/pocket collisions, `simulate()` | shared                    |
| `src/rules`         | 8-ball rules: break, groups, fouls, ball-in-hand, turns, win/loss         | shared                    |
| `src/ai`            | AI opponent: shot generation, simulation-based scoring, difficulty        | shared, physics, rules    |
| `src/render`        | Canvas drawing, layout/scaling, orientation transform, animations         | shared                    |
| `src/input`         | Touch/mouse → aim, power, spin, ball-in-hand intents                      | shared                    |
| `src/ui`            | DOM menus, HUD, overlays, settings/stats screens                          | shared                    |
| `src/audio`         | Original sound effects and playback                                       | shared                    |
| `src/state`         | Game state machine, game loop, wiring modules together, persistence       | all modules               |
| `src/main.ts`       | Composition root only (boots `state`)                                     | state, render, ui, shared |
| `tests/`            | `unit/` (Vitest), `e2e/` (Playwright). Test files named after the module. | anything                  |
| `.github/`, configs | CI/CD and tooling. Changes need a PROGRESS.md note.                       | —                         |

Import boundaries are enforced by `eslint.config.js` (`no-restricted-imports`); `npm run lint`
fails on violations. Never weaken those rules to make an import work — move the type to
`src/shared` instead.

### How modules talk

- **All cross-module types and interfaces live in `src/shared/types.ts`** (constants in
  `src/shared/constants.ts`). No module exports types meant for another module from its own folder.
- Modules expose a public API through their `index.ts`. Other modules import from the folder
  (`../physics`), never from deep internal files.
- Modules do not call each other sideways (e.g. `render` never calls `rules`). `state` owns the
  game loop and passes data between them: input intent → `Shot` → physics → rules → render/ui/audio.
- Prefer pure functions taking plain data (`TableGeometry`, ball arrays, `Shot`) over classes with
  hidden state. Pure code is easy to test and lets the AI simulate.

## 4. Coding conventions

- TypeScript strict mode; no `any` (use `unknown` + narrowing). No non-null `!` in `src/` unless
  justified by a comment.
- Files: `camelCase.ts`. Types/interfaces: `PascalCase`. Functions/variables: `camelCase`.
  Constants: `UPPER_SNAKE_CASE`. Booleans read as questions (`isPocketed`, `hasFoul`).
- Units: meters, seconds, radians, in table space. Name pixel values `...Px` when ambiguous.
- Type-only imports use `import type`. Keep files focused (≈300 lines max).
- Comments explain _why_, not _what_. Every module folder starts with a header comment in
  `index.ts` stating ownership and allowed imports.
- Run `npm run format` before committing; CI runs `format:check`.
- No new runtime dependencies without a Decisions-log entry in PROGRESS.md.
- Assets (images, sounds, fonts) must be original or created in code; record their origin in
  the Decisions log.

## 5. Multi-agent workflow

1. **Read `AGENTS.md` and `PROGRESS.md`** before doing anything.
2. **Pull latest main** before starting: `git fetch origin main && git checkout -b phaseN/short-task-name origin/main`.
3. **Claim the task** in PROGRESS.md (move it to _In Progress_ with agent name, branch, start
   date) in your first commit, and push it immediately so other agents see the claim.
4. **One branch per task**, named `phaseN/short-task-name` (e.g. `phase1/cue-controls`).
   **Never commit directly to `main`.**
5. **Only edit files in your owned module** (plus its tests and PROGRESS.md). Changes to
   `src/shared/*` or configs require a note in PROGRESS.md (Change log + "Shared type changes"
   in your task entry) explaining what changed and who is affected.
6. **Update PROGRESS.md in every commit** (Change log entry: date, what, who, why; task status).
7. **All tests must pass before opening a PR** (`npm run lint && npm run typecheck && npm test`).
   **New logic requires new tests.**
8. **Pull latest main again before opening a PR** and merge it into your branch; re-run tests.
9. **Open a PR into `main`.** CI (`ci` check) runs lint, format, typecheck, unit tests, build and
   Playwright against your PR merged onto the latest main. Move your task to _In Review_.
10. **Auto-merge:** when `ci` is green and the branch is up to date with main, the PR is
    squash-merged into `main` (enable auto-merge on the PR; if unavailable, merge once green).
    Never merge a red PR; never skip, disable or weaken a test to get green.
11. **Deploy:** merging to main triggers `deploy`, which re-runs all tests and publishes to
    `https://ohfrinzx.github.io/Aiball/`.
12. **User playtest gate:** after a phase's tasks are merged and deployed, ask the user to
    playtest the live site. **No next phase or new implementation starts until the user says
    "approved".** Record feedback and the approval in PROGRESS.md. Bugs found go to _Known bugs_.

## 6. Definition of done (any task)

- [ ] Behaviour matches the GamePigeon 8-Ball reference for that feature; all assets original.
- [ ] Code lives only in the owned module (+ documented shared changes).
- [ ] New logic has unit tests; user-visible flows covered by a Playwright smoke test when practical.
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all pass locally.
- [ ] Works in portrait phone (≈390×844) and landscape desktop (≈1440×900), touch and mouse.
- [ ] No console errors; no frame drops introduced on mobile (target 60 fps).
- [ ] PROGRESS.md updated (task moved, change log entry, decisions/bugs if any).
- [ ] PR merged into main with green CI, deployed, and listed for the user's playtest.
