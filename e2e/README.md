# e2e/

A real-browser Playwright suite covering the app's critical user journeys end to end
(actual FastAPI backend, actual built frontend, actual browser). This is a **manual
pre-release check**, not a CI gate — running it on every PR would mean CI standing up a
real backend + built frontend + seeded scratch database together, which is a lot of
complexity and flake risk for a personal project.

It needs a real backend and a real built frontend running together, against a database you
don't mind these tests writing to. **Never point this at your real collection** — always use
a scratch copy.

## One-time setup, before each run

1. Copy your real database to a scratch location (adjust paths for your OS):
   ```
   cp backend/db/videogametrackarr.db /tmp/vgt-e2e-scratch.db
   ```

2. Create a throwaway admin account on that scratch copy:
   ```
   cd backend
   DATABASE_URL="sqlite:////tmp/vgt-e2e-scratch.db" python -m scripts.create_admin --username e2e-test --password "<pick-something>"
   ```

3. Start the backend against the scratch copy (separate terminal):
   ```
   cd backend
   DATABASE_URL="sqlite:////tmp/vgt-e2e-scratch.db" uvicorn app.main:app --port 8000
   ```

4. Build and preview the frontend (separate terminal, from the repo root):
   ```
   npm run build
   npm run preview
   ```

5. Set the credentials from step 2 as env vars (same terminal you'll run the tests from):
   ```
   export E2E_USERNAME=e2e-test
   export E2E_PASSWORD="<what you picked>"
   ```

## Running

```
npm run test:e2e
```

Add `--headed` (via `npm run test:e2e -- --headed`) to watch it run in a real browser
window instead of headless, or `--debug` to step through interactively.

## Afterward

Stop both servers and delete the scratch database file. There's nothing in this repo to
clean up — these tests don't write inside the working tree.

## What's covered

- `auth.spec.ts` — login (valid and invalid credentials), logout
- `library.spec.ts` — browse, search, open a game's detail page
- `add-game.spec.ts` — add a game manually, find it in the library afterward
- `progress.spec.ts` — change a game's play status, confirm it survives a reload
- `dashboard.spec.ts` — dashboard tabs render; selecting two games and comparing them works

This isn't exhaustive coverage of every feature — that's what the backend's pytest suite
(currently 181 tests) and the frontend's Vitest suite are for. This suite exists to catch
the class of bug neither of those can: something that only breaks when the real frontend
talks to the real backend over a real HTTP connection in a real browser.
