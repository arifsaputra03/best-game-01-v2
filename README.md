[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/arifsaputra03/best-game-01-v2/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/arifsaputra03/best-game-01-v2/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

# SPIREBOUND — climb the five spires

Entry for [best-game-01](https://make.fun/bounty/best-game-01) on make.fun: *make the best game*. A complete, original 2D platformer that plays offline in a desktop browser from static files.

## The game

A small hooded climber ascends five floating spires, each with its own art, hazards and enemies. Light the shrines, gather every starshard, and face the Storm Warden on the last spire.

- **Five hand-built spires** — Dawn, Verdance, Frost, Ember and Storm, each with its own palette, platforms, pits and foes
- **A campaign, not a loop** — a level select with stars (1–3 per spire), progressive unlocks, and a final victory screen
- **Unlocks that change how you move** — double jump on spire 2, dash on spire 3, an aegis shield on spire 4
- **Enemies with behaviour** — patrolling beetles, sine-wave wisps, thorn-spitters, and a three-phase boss that charges and bursts
- **Hazards** — spikes, crumbling stone, moving platforms over long pits
- **3 lives per spire** · shrine checkpoints · **P** pauses · **M** mutes · **R** restarts · **Enter** confirms

Every sound is synthesized live with the Web Audio API — no audio files. All art is drawn in code on a 2D canvas — no image files. Best stars are kept in `localStorage`.

## Play it

```sh
node serve.ts   # serves the game on http://localhost:8123/game/index.html
```

Or open `game/index.html` from any static server. No build step, no network requests.

## Layout

```
game/
  index.html          the page (canvas + module entry)
  src/
    config.js         constants, physics tuning, the five spires
    levels.js         the five hand-built spire layouts
    random.js         seeded RNG for deterministic scenes
    audio.js          WebAudio synth sound effects
    input.js          keyboard input with edge detection
    physics.js        AABB tile collision + player controller
    entities.js       walkers, flyers, spitters, the boss, particles
    world.js          level state, camera, scoring, stars, checkpoints
    render.js         sky, tiles, entities, HUD and every screen
    shots.js          deterministic screenshot scenes
    selftest.js       headless logic tests (?selftest=1)
    main.js           state machine, save data, game loop
```

## Tests

Open `game/index.html?selftest=1` in a browser: 17 logic tests (physics, unlocks, combat, hazards, shrines, boss, state machine, moving platforms, crumbling tiles) run headlessly and report PASS/FAIL.
