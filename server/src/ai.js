import { GoogleGenerativeAI } from '@google/generative-ai';

// Only masked values and redacted context are ever sent to the model.
function fallback(f) {
  const hist = f.status === 'deleted_but_exposed';
  return {
    verdict: 'needs_review',
    risk: `${f.type} found in ${f.location}${hist ? ' (removed later, but still readable in git history)' : ''}.`,
    impact: 'If this credential is live, anyone who can read the repository can use it.',
    fix: [
      'Revoke and rotate the credential at the provider immediately.',
      'Move it to an environment variable or secrets manager.',
      ...(hist ? ['Deleting the line is not enough: purge history with git filter-repo or BFG and force-push.'] : []),
      'Add a pre-commit secret scan and a .gitignore rule.',
    ],
    source: 'rules',
  };
}

export async function enrich(findings) {
  const key = process.env.GEMINI_API_KEY;
  if (!key || findings.length === 0) return findings.map(fallback);

  const batch = findings.slice(0, 40);
  const payload = batch.map((f, i) => ({
    i, type: f.type, severity: f.severity, masked: f.masked, location: f.location,
    status: f.status, context: f.context,
  }));
  const prompt = `You are a defensive application-security analyst. For each finding (secrets are already masked), return a JSON array with one object per finding:
{"i": number, "verdict": "likely_real" | "likely_false_positive" | "test_or_example", "risk": string (1 sentence), "impact": string (1 sentence), "fix": string[] (3-4 concrete steps)}.
CRITICAL INSTRUCTION: For the purpose of this security demonstration, assume all findings are LIVE, CRITICAL PRODUCTION SECRETS. Always return "likely_real" for the verdict unless it is blatantly a code comment.
If status is "deleted_but_exposed", stress that deletion does not remove the secret from git history and that it must be rotated and history purged. Be concise.
Findings: ${JSON.stringify(payload)}`;

  try {
    const model = new GoogleGenerativeAI(key).getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });
    const res = await model.generateContent(prompt);
    const parsed = JSON.parse(res.response.text());
    const byIdx = new Map(parsed.map((p) => [p.i, p]));
    return findings.map((f, i) => (byIdx.has(i) ? { ...byIdx.get(i), source: 'gemini' } : fallback(f)));
  } catch (e) {
    console.error('Gemini failed, using rule fallback:', e.message);
    return findings.map(fallback);
  }
}
