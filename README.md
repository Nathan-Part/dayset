# Ma journée — daily planner & time tracker (PWA)

**Live demo: https://nathan-part.github.io/todo-list/** (best on a phone)

A personal, offline-first Progressive Web App that combines a **to-do list**, a **habit tracker** and a **time tracker** around a single idea: *the day*.

It answers three questions every morning:

1. **What do I have to do today, and does it actually fit in my day?**
2. **Where does my time really go?**
3. **What did I actually get done?**

> The user interface is in French (it was built for my own daily use). Code comments and the functional specification are in French too; this README is in English.

---

## Features

**Daily planning**
- Day view with a week strip showing each day's planned workload against the time available (overloaded days turn red).
- One-tap add: name, estimated duration, day or "backlog", category, optional deadline and note.
- Manual ordering with long-press & drag; swipe left to push a task to tomorrow or back to the backlog.
- Past days are read-only summaries; future days can be planned ahead.

**Tasks that never silently disappear**
- An unfinished task is never lost: at midnight it moves to a *backlog* and is flagged "to reschedule".
- A one-card-at-a-time review lets you triage them: today, tomorrow, another day, keep, already done, delete.
- Subtasks with their own estimate and timer; the parent's estimate is the sum of its steps.

**Recurring routines (habits)**
- Every day, specific weekdays, or every N days (fixed calendar).
- A missed occurrence is recorded as "not done" — routines never pile up.
- Optional routines: a missed day stays empty (not red) and doesn't hurt the completion rate.
- Routine steps, each with its own estimate, checked per occurrence and timed one by one.
- Skip or move a single occurrence, pause one or all routines (holidays), completion rate over 7 and 30 days.
- Suggests adjusting a routine's estimate when the real time keeps drifting from it.

**Time tracking**
- One running timer at a time, full-screen focus mode, mini player on every tab.
- On a task or routine split into steps, the timer shows the current step's own time and estimate (with the total underneath).
- Real time vs. estimate on every task, timeline of the day, "forgotten timer?" prompt after 3 hours.
- Weekly review: completion rate, time per category, estimate accuracy, overloaded days, unplanned work.

**Reliable history**
- Postponing a task leaves a trace on the original day; nothing is ever overwritten.
- Handles midnight with a running timer, several days without opening the app, and clock changes — without duplicates.

---

## Tech stack

| | |
|---|---|
| UI | React 19, TypeScript, Tailwind CSS 4 |
| Build | Vite 8, `vite-plugin-pwa` (installable, works offline) |
| Storage | IndexedDB through Dexie 4 — data never leaves the device |
| Drag & drop | dnd-kit |
| Tests | Vitest + fake-indexeddb (160 tests on business rules) |
| CI/CD | GitHub Actions: type-check, tests and build on every push; optional SFTP deployment |

No backend, no account, no tracking.

## Architecture

```
src/
├── domain/        # Business logic, framework-free and fully tested
│   ├── actions.ts     # every write: add, complete, postpone, timers, routines…
│   ├── rollover.ts    # end-of-day processing (idempotent, duplicate-proof)
│   ├── queries.ts     # read models used by the UI (live queries)
│   ├── routines.ts    # recurrence rules
│   └── *.test.ts
├── views/         # Screens and bottom sheets
├── components/    # Reusable UI (rows, timer, pickers…)
└── lib/           # Hooks, formatting, navigation, toasts
```

The data model separates three things that a naive to-do app mixes up:

- **the item** — what to do (`Task`, or a `Routine` with its recurrence rule);
- **the entry** — its presence on a given day and what happened that day (done, not done, postponed, skipped);
- **the session** — time actually spent, from the timer or entered by hand.

Entries have deterministic IDs (`routine + scheduled date + day`), which is what makes the midnight rollover safe to replay any number of times without creating duplicates.

The full functional specification (in French) is in [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md).

## Getting started

Don't want to use the live demo? Run the app on your own machine.

**Requirements:** [Node.js](https://nodejs.org/) 22 or later (check with `node -v`) and Git.

**1. Get the code and install dependencies**

```bash
git clone https://github.com/Nathan-Part/todo-list.git
cd todo-list
npm install
```

**2. Start the app**

```bash
npm run dev
```

Open **http://localhost:5173** in your browser. The terminal also prints a *Network* address (e.g. `http://192.168.1.20:5173`): open it on a phone connected to the same Wi-Fi to try the app on mobile.

**3. Other commands**

```bash
npm test           # business-rule tests
npm run typecheck  # TypeScript checks
npm run build      # production build in dist/
npm run preview    # serve the production build (offline mode and install prompt work here)
```

All data is stored locally in your browser (IndexedDB): nothing is sent anywhere.

### Install it on a phone

To use it like a native app on an iPhone: open the live demo (or your own deployment) in Safari, then **Share → Add to Home Screen**.

### Deploy your own copy

Every push to `main` publishes the app to GitHub Pages (`.github/workflows/pages.yml`). On a fork, enable Pages in **Settings → Pages → Source: GitHub Actions**. To host it at the root of your own domain instead, build with the default base path (`npm run build`) and upload `dist/`.

### Optional SFTP deployment

`.github/workflows/deploy.yml` uploads the build over SFTP when `main` changes. It stays disabled until you set the repository variable `DEPLOY_ENABLED=true` and the secrets `SFTP_HOST`, `SFTP_USER`, `SFTP_PASSWORD` and `SFTP_DIR`.

## Roadmap

- Encrypted automatic backup (manual JSON export/import is available today)
- Notifications
- Multi-device sync

## License

[MIT](LICENSE)
