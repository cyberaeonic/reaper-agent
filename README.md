# REAPER

**AI-powered secret-leak detection for GitHub, including secrets that were *deleted* but still live in git history.**

Theme: AI Security, Privacy & Trust.

## Problem
Developers leak API keys and passwords into repositories. A common "fix" is to delete the line in a later commit, but the secret stays readable in git history and may still be live. Scanners that only read current files miss it, and plain regex scanners bury teams in false positives.

## Solution
REAPER scans a repo's current files **and** commit patches, flags secrets that were removed but remain exposed, and uses Gemini to triage each finding (real vs false positive), explain the impact and give concrete fix steps.

**Privacy by design:** raw secrets never leave the server process. The database, UI and AI prompts only ever see a masked value and a redacted code line.

## Features
- GitHub repo scan (files + commit history) and paste-text scan
- "Deleted but still exposed" detection from commit diffs
- Gemini triage with a rule-based fallback if the AI is unavailable
- Security score, severity chart, scan history
- JWT auth, bcrypt, Zod validation, rate limiting, Helmet

## Stack
React + Vite + React Router + Tailwind + Axios + Recharts | Node + Express + JWT + bcrypt + Zod | SQLite | Gemini API (backend only)

## Run locally
Requires Node 20+.

```bash
# backend
cd server
cp .env.example .env      # set JWT_SECRET, GEMINI_API_KEY, optionally GITHUB_TOKEN
npm install
npm run dev               # http://localhost:4000

# frontend (new terminal)
cd client
npm install
npm run dev               # http://localhost:5173
```

`GITHUB_TOKEN` (no scopes needed) raises the GitHub API limit from 60 to 5000 requests/hour. Without it, scanning large repos will hit the limit.

## Deploy
- **Backend → Render:** root `server`, build `npm install`, start `npm start`. Set env vars from `.env.example` and `CLIENT_ORIGIN` to your frontend URL. SQLite is file-based and resets on redeploy on free tiers; attach a disk or move to Postgres for persistence.
- **Frontend → Vercel:** root `client`, set `VITE_API_URL=https://<your-render-app>/api`.

## API
`POST /api/auth/register|login` · `POST /api/scans/repo` · `POST /api/scans/text` · `GET /api/scans` · `GET /api/scans/:id`

## Responsible use
Scan repositories you own or have permission to test. Secret values are masked everywhere.

## Credits
Detectors derived from the author's earlier Go CLI, [Reaper](https://github.com/cyberaeonic/Reaper). Email harvesting and open-ended public-repo discovery were removed for this defensive version.
