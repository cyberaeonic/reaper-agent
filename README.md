# REAPER (Agentic AI Security Scanner)

**AI-powered secret-leak detection and Auto-Fix Agent for GitHub, specializing in "Ghost Leaks" (secrets that were deleted but still live in git history).**

**Live Demo:** [https://client-eight-beta-21.vercel.app](https://client-eight-beta-21.vercel.app)

*Built for the **Build to Ship Hackathon**.*
Targeted Themes: **Agentic AI & Intelligent Systems** | **AI Security, Privacy & Trust** | **Enterprise AI**

---

## 🚨 The Problem
Developers frequently leak API keys and passwords into repositories. A common (and dangerous) "fix" is to simply delete the line of code in a later commit. However, the secret remains completely readable in the git history! 

Passive scanners that only check current files miss these "Ghost Leaks," and traditional regex scanners bury security teams in false positives. Even worse, enterprise security tools only *report* the problem, leaving the human to do the tedious work of digging through Git history and opening Pull Requests to fix it.

## 💡 The Solution (REAPER)
REAPER is an **Agentic Developer Tool** that doesn't just alert you—it fixes the problem.

1. **Deep History Scanning:** It scans a repo's current files **and** commit patches to flag secrets that were removed but remain exposed in the Git history.
2. **Privacy-First AI Triage:** Traditional tools send your code to their cloud. REAPER masks the secret locally (e.g., `AKIA******MPLE`) *before* sending the surrounding code context to the **Gemini API**. Gemini analyzes the context to determine if it's a real leak or a fake key in a test file, ensuring your raw secrets never hit an LLM.
3. **Agentic Auto-Fix PR:** If a live leak is found, REAPER acts as an autonomous agent. With one click, it clones the file, strips the secret out of the code, creates a new branch, and opens a Pull Request on your behalf to instantly resolve the vulnerability.

## ✨ Core Features
- **GitHub Deep Scan:** Analyzes live files and commit history via Octokit.
- **Privacy-Preserving AI:** Raw secrets never leave the backend process. Only masked templates and redacted context are sent to Gemini.
- **Agentic Remediation:** 1-Click Auto-Fix Pull Requests.
- **Modern Dashboard:** Security score, severity chart, scan history, and live findings (React + Recharts).
- **Frictionless Access:** Zero-login demo environment for rapid evaluation.

## 🛠 Tech Stack

**Frontend (Client)**
- **Framework:** React 18 + Vite
- **Styling:** Tailwind CSS
- **Data Visualization:** Recharts
- **Routing:** React Router DOM
- **Deployment:** Vercel

**Backend (Server)**
- **Runtime:** Node.js + Express
- **AI Integration:** Google Gemini SDK (`@google/generative-ai`)
- **Version Control Interface:** Octokit (GitHub API)
- **Database:** SQLite (Better-SQLite3)
- **Deployment:** Render

**Core AI Workflow**
- **LLM:** Gemini 1.5 Flash (Optimized for fast, contextual code analysis)
- **Agentic Actions:** Automated git branching, file modification, and PR generation.

## 🚀 Live Deployment
- **Frontend:** Hosted on [Vercel](https://client-eight-beta-21.vercel.app)
- **Backend:** Hosted on [Render](https://reaper-agent.onrender.com)

## 💻 Run Locally
Requires Node 20+.

```bash
# Backend Setup
cd server
cp .env.example .env
# Set GEMINI_API_KEY and GITHUB_TOKEN inside .env
npm install
npm run dev

# Frontend Setup (New Terminal)
cd client
npm install
npm run dev
```

## 🔐 Responsible Use
This project was built defensively for developers to secure their own infrastructure. It represents a full-stack, Agentic AI platform designed specifically to demonstrate the power of AI in Enterprise Security for the Build to Ship Hackathon.
