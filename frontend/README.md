# Sovereign: Age of Nations

> Build your nation. Shape your world. Define history.

A real-time grand strategy and geopolitical simulation that runs entirely in the browser. Pick one of 20 nations on a procedurally generated planet and govern it for twenty years against 19 AI governments.

## Features

- **A living world.** A continuous, fixed-step simulation clock with pause and 1x to 10x speeds, running in a Web Worker. Autosave and offline progression use IndexedDB.
- **A deep economy.** Taxes, spending, central-bank rates, debt, inflation, unemployment, approval and stability, all simulated monthly for every nation.
- **Politics.** Elections every four years, crises that demand decisions, and collapse conditions.
- **Diplomacy.** Relations, trade agreements, non-aggression pacts, alliances and sanctions, with AI nations that make and offer deals.
- **War.** Armies, equipment and logistics driven by defence spending, occupation, alliance call-ups, ceasefires and surrender, shown live on the map.
- **Polish.** Synthesized sound and generative music (no audio files), a guided tour, an intro, and multiple map modes.

## Tech

React, TypeScript, Vite, PixiJS, Zustand, Zod, Vitest. The simulation engine is pure TypeScript in a shared package. The backend is a Cloudflare Worker (Hono). Everything is free to build and host.

## Project structure

- `frontend`: the game client
- `backend`: a Cloudflare Worker (health endpoint now, multiplayer later)
- `shared`: world generation and the deterministic simulation engine, with tests

## Run locally

    npm install
    npm run dev:backend    # terminal 1
    npm run dev:frontend   # terminal 2
    npm run test           # run the simulation tests

## Controls

Space pauses, 1 to 4 set speed, M mutes, Esc deselects. Scroll to zoom the map and drag to pan.

Developed by Sukhad Sharma.
