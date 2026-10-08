import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import db from './db.js';
import { scanRepo, scanPastedText } from './scanner.js';
import { enrich } from './ai.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('JWT_SECRET is required (see .env.example)');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') || true }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 60 }));
const scanLimiter = rateLimit({ windowMs: 60_000, limit: 6 });

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const sign = (u) => jwt.sign({ id: u.id, email: u.email }, JWT_SECRET, { expiresIn: '7d' });

function auth(req, res, next) {
  req.user = { id: 1 };
  next();
}

const creds = z.object({ email: z.string().email(), password: z.string().min(8).max(100) });

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/auth/register', wrap(async (req, res) => {
  const { email, password } = creds.parse(req.body);
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return res.status(409).json({ error: 'Email already registered' });
  const hash = await bcrypt.hash(password, 10);
  const { lastInsertRowid } = db.prepare('INSERT INTO users(email,password_hash) VALUES(?,?)').run(email, hash);
  const user = { id: Number(lastInsertRowid), email };
  res.status(201).json({ token: sign(user), user });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const { email, password } = creds.parse(req.body);
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!u || !(await bcrypt.compare(password, u.password_hash))) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ token: sign(u), user: { id: u.id, email: u.email } });
}));

async function runScan(scanId, work) {
  const setProgress = (p) => db.prepare('UPDATE scans SET progress=? WHERE id=?').run(p, scanId);
  try {
    const { findings, meta } = await work(setProgress);
    setProgress('Analyzing with Gemini');
    const ai = await enrich(findings);
    const ins = db.prepare(`INSERT INTO findings(scan_id,type,severity,masked,location,status,commit_sha,author,committed_at,context,ai)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
    db.transaction(() => findings.forEach((f, i) =>
      ins.run(scanId, f.type, f.severity, f.masked, f.location, f.status, f.commit_sha ?? null, f.author ?? null,
        f.committed_at ?? null, f.context, JSON.stringify(ai[i]))))();
    const count = (s) => findings.filter((f) => f.severity === s).length;
    const summary = {
      ...meta, total: findings.length, critical: count('CRITICAL'), high: count('HIGH'),
      deletedButExposed: findings.filter((f) => f.status === 'deleted_but_exposed').length,
      score: Math.max(0, 100 - findings.reduce((a, f) => a + (f.severity === 'CRITICAL' ? 20 : 8) + (f.status === 'deleted_but_exposed' ? 5 : 0), 0)),
    };
    db.prepare("UPDATE scans SET status='done', summary=?, progress='' WHERE id=?").run(JSON.stringify(summary), scanId);
  } catch (e) {
    db.prepare("UPDATE scans SET status='error', error=?, progress='' WHERE id=?").run(e.message, scanId);
  }
}

const newScan = (userId, target) =>
  Number(db.prepare('INSERT INTO scans(user_id,target) VALUES(?,?)').run(userId, target).lastInsertRowid);

app.post('/api/scans/repo', auth, scanLimiter, wrap(async (req, res) => {
  const { repo } = z.object({ repo: z.string().min(3).max(200) }).parse(req.body);
  const id = newScan(req.user.id, repo);
  runScan(id, (p) => scanRepo(repo, p));
  res.status(202).json({ id });
}));

app.post('/api/scans/text', auth, scanLimiter, wrap(async (req, res) => {
  const { text } = z.object({ text: z.string().min(1).max(200_000) }).parse(req.body);
  const id = newScan(req.user.id, 'pasted text');
  runScan(id, async () => scanPastedText(text));
  res.status(202).json({ id });
}));

app.get('/api/scans', auth, (req, res) => {
  const rows = db.prepare('SELECT id,target,status,summary,created_at FROM scans WHERE user_id=? ORDER BY id DESC LIMIT 50').all(req.user.id);
  res.json(rows.map((r) => ({ ...r, summary: r.summary ? JSON.parse(r.summary) : null })));
});

app.get('/api/scans/:id', auth, (req, res) => {
  const s = db.prepare('SELECT * FROM scans WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  const findings = db.prepare('SELECT * FROM findings WHERE scan_id=? ORDER BY id').all(s.id)
    .map((f) => ({ ...f, ai: f.ai ? JSON.parse(f.ai) : null }));
  res.json({ ...s, summary: s.summary ? JSON.parse(s.summary) : null, findings });
});

app.post('/api/fix', auth, wrap(async (req, res) => {
  const { findingId } = z.object({ findingId: z.number() }).parse(req.body);
  const finding = db.prepare('SELECT f.*, s.target FROM findings f JOIN scans s ON f.scan_id = s.id WHERE f.id = ? AND s.user_id = ?').get(findingId, req.user.id);

  if (!finding) return res.status(404).json({ error: 'Finding not found' });
  if (finding.status !== 'present') return res.status(400).json({ error: 'Can only fix current files' });

  const [owner, repo] = finding.target.split('/');
  const { Octokit } = await import('@octokit/rest');
  const octo = new Octokit({ auth: process.env.GITHUB_TOKEN });

  const { data: repoData } = await octo.repos.get({ owner, repo });
  const branch = repoData.default_branch;

  const { data: fileData } = await octo.repos.getContent({ owner, repo, path: finding.location, ref: branch });
  if (Array.isArray(fileData) || fileData.type !== 'file') return res.status(400).json({ error: 'Not a valid file' });

  const content = Buffer.from(fileData.content, 'base64').toString('utf8');
  const { detect } = await import('./patterns.js');
  const detected = detect(content);
  const match = detected.find(d => d.type === finding.type);
  if (!match) return res.status(400).json({ error: 'Secret no longer found in file' });

  const newContent = content.replace(match.secret, 'REMOVED_BY_REAPER');
  const { data: refData } = await octo.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const newBranchName = `reaper-fix-${Date.now()}`;
  await octo.git.createRef({ owner, repo, ref: `refs/heads/${newBranchName}`, sha: refData.object.sha });

  await octo.repos.createOrUpdateFileContents({
    owner, repo, path: finding.location,
    message: `fix: remove exposed ${finding.type}`,
    content: Buffer.from(newContent).toString('base64'),
    sha: fileData.sha, branch: newBranchName
  });

  const { data: prData } = await octo.pulls.create({
    owner, repo, title: `Security Fix: Remove exposed ${finding.type}`,
    head: newBranchName, base: branch,
    body: `REAPER identified an exposed ${finding.type} in \`${finding.location}\`.\n\nThis PR redacts the secret value. **Note:** You must still revoke and rotate the credential at the provider, as it remains in the git history.`
  });
  res.json({ prUrl: prData.html_url });
}));

app.use((err, _req, res, _next) => {
  if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues.map((i) => i.message).join(', ') });
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`REAPER API on :${port}`));
