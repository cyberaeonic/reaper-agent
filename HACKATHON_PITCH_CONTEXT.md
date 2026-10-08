# REAPER: Agentic AI Security Scanner
**Hackathon Knowledge Base & Context**

This file contains all the technical details, architecture decisions, and "war stories" from building this app. Use this context when opening the project in your IDE (Codex/Cursor/VSCode) or when recording your demo video.

## 🚀 The Core Pitch (Theme: AI Security, Privacy & Trust)
Traditional security scanners like GitGuardian just *alert* you when a leak happens, and they send your raw secrets to their cloud. REAPER is a next-generation **Agentic Developer Tool**:
1. **Ghost Leaks:** It scans the Git history (commit patches), not just the live files. It catches secrets that developers "deleted" in newer commits but left exposed in the history.
2. **Privacy-First AI:** We use Google's Gemini API for contextual analysis, but we **never** send raw secrets to the LLM. The backend masks the secret (e.g., `AKIA******MPLE`) *before* asking Gemini if the context around it implies a real leak or a fake testing key.
3. **Agentic Remediation:** Instead of just sending an alert, the "Auto-Fix PR" button takes a GitHub token and literally writes the code to fix the problem. It clones the file, strips the secret, creates a new branch, and opens a Pull Request on your behalf.

## 🧠 Technical Architecture
- **Frontend (`client/`)**: React, Vite, Tailwind CSS, Recharts. The `VITE_API_URL` environment variable points to the Render backend.
- **Backend (`server/`)**: Node.js, Express, SQLite, Octokit.
  - `scanner.js`: Fetches live files and git patches using Octokit, and runs Regex patterns to find leaks.
  - `ai.js`: Sends the masked code snippet to Gemini for triage.
  - `index.js`: Contains the `/api/fix` route which physically modifies the repo and opens the PR.

## 🐞 War Stories (Great to mention to judges!)
We hit some incredible real-world challenges while building this:
1. **GitHub Push Protection:** While deploying the first version, GitHub's native push protection actually blocked my commit because we had a fake Stripe API key in `Dashboard.jsx` for the demo! I had to modify the dummy key to bypass it. This perfectly proves how aggressive secret scanning can be, and why an Auto-Fix tool is so necessary.
2. **The "Public Tool" Lobotomy:** We originally built a full JWT login system. At the last minute, we stripped it out and routed all scans to a "dummy user" in the SQLite database so the judges could test the tool frictionlessly without creating accounts.
3. **The SQLite Foreign Key Bug:** When deploying to Render, Render's ephemeral disk wiped the SQLite database on startup. Because the dummy user didn't exist yet, the database threw a Foreign Key constraint error (`500 Server error`) when trying to save a scan. We fixed it by forcing the dummy user to be created on app initialization (`db.js`).

## 🎥 How to record your Demo Video
1. Use your **`reaper-demo-leaks`** repository to show off the **Ghost Leak** detection. Point out that the secret was deleted in the second commit, but REAPER still found it in the patch history.
2. Create a new repo with a live leak, scan it, and click the **Auto-Fix PR** button. Show the judges the live PR appearing on GitHub magically! Explain that requiring the token for this is a security feature, proving REAPER respects GitHub's authorization model.

