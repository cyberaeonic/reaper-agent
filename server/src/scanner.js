import { Octokit } from '@octokit/rest';
import { detect, maskSecret } from './patterns.js';

const MAX_FILES = Number(process.env.MAX_FILES || 150);
const MAX_COMMITS = Number(process.env.MAX_COMMITS || 40);
const SKIP = /(^|\/)(node_modules|vendor|dist|build|\.git)\/|\.(png|jpe?g|gif|ico|pdf|zip|gz|woff2?|ttf|lock|map|svg|mp4|min\.js)$|package-lock\.json$/i;

export function parseRepo(input) {
  const m = String(input).trim().match(/^(?:https?:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/);
  if (!m) throw new Error('Enter a repo as owner/name or a github.com URL');
  return { owner: m[1], repo: m[2] };
}

// Return findings with the raw secret replaced by [REDACTED] in the context
// and only a masked form kept. `_raw` is used for in-memory comparison only.
function scanText(text, location, extra = {}) {
  return detect(text).map((d) => {
    const lineStart = text.lastIndexOf('\n', d.index) + 1;
    let lineEnd = text.indexOf('\n', d.index);
    if (lineEnd === -1) lineEnd = text.length;
    const context = text.slice(lineStart, lineEnd).split(d.secret).join('[REDACTED]').trim().slice(0, 240);
    return {
      type: d.type, severity: d.severity, masked: maskSecret(d.secret),
      location, status: 'present', context, _raw: d.secret, ...extra,
    };
  });
}

async function pool(items, limit, fn) {
  const results = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }));
  return results;
}

export function scanPastedText(text) {
  return { findings: scanText(text, 'pasted-text'), meta: { filesScanned: 1, commitsScanned: 0 } };
}

export async function scanRepo(input, onProgress = () => {}) {
  const { owner, repo } = parseRepo(input);
  const octo = new Octokit({ auth: process.env.GITHUB_TOKEN || undefined });

  onProgress(`Fetching ${owner}/${repo}`);
  const { data: info } = await octo.repos.get({ owner, repo });
  const branch = info.default_branch;
  const { data: tree } = await octo.git.getTree({ owner, repo, tree_sha: branch, recursive: 'true' });
  const files = tree.tree
    .filter((t) => t.type === 'blob' && (t.size ?? 0) < 200_000 && !SKIP.test(t.path))
    .slice(0, MAX_FILES);

  onProgress(`Scanning ${files.length} current files`);
  const current = [];
  await pool(files, 8, async (f) => {
    try {
      const { data } = await octo.git.getBlob({ owner, repo, file_sha: f.sha });
      const text = Buffer.from(data.content, 'base64').toString('utf8');
      current.push(...scanText(text, f.path));
    } catch { /* skip unreadable blob */ }
  });
  const currentKeys = new Set(current.map((f) => `${f.type}|${f._raw}`));

  onProgress(`Walking last ${MAX_COMMITS} commits for deleted secrets`);
  const { data: commits } = await octo.repos.listCommits({ owner, repo, sha: branch, per_page: MAX_COMMITS });
  const historical = [];
  await pool(commits, 5, async (c) => {
    try {
      const { data } = await octo.repos.getCommit({ owner, repo, ref: c.sha });
      for (const file of data.files || []) {
        if (!file.patch || SKIP.test(file.filename)) continue;
        const added = file.patch.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1)).join('\n');
        for (const f of scanText(added, file.filename, {
          commit_sha: c.sha, author: c.commit.author?.name, committed_at: c.commit.author?.date,
        })) {
          if (!currentKeys.has(`${f.type}|${f._raw}`)) {
            f.status = 'deleted_but_exposed';
            historical.push(f);
          }
        }
      }
    } catch { /* skip commit */ }
  });

  // De-duplicate
  const seen = new Set();
  const findings = [...current, ...historical].filter((f) => {
    const k = `${f.type}|${f._raw}|${f.location}|${f.status}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  findings.forEach((f) => delete f._raw);

  return {
    findings,
    meta: { repo: `${owner}/${repo}`, branch, filesScanned: files.length, commitsScanned: commits.length },
  };
}
