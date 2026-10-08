import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { api } from '../api';

const SEV = { CRITICAL: 'bg-red-600', HIGH: 'bg-orange-500', MEDIUM: 'bg-yellow-500' };
const VERDICT = {
  likely_real: ['Likely real', 'text-red-400'],
  likely_false_positive: ['Likely false positive', 'text-green-400'],
  test_or_example: ['Test / example', 'text-sky-400'],
  needs_review: ['Needs review', 'text-yellow-400'],
};

export default function ScanDetail() {
  const { id } = useParams();
  const [scan, setScan] = useState(null);
  const [githubToken, setGithubToken] = useState(localStorage.getItem('gh_token') || '');
  const [fixing, setFixing] = useState(null);

  const handleFix = async (finding) => {
    let t = githubToken;
    if (!t) {
      t = prompt('Enter a GitHub Personal Access Token (repo scope) to create the PR:');
      if (!t) return;
      setGithubToken(t);
      localStorage.setItem('gh_token', t);
    }
    setFixing(finding.id);
    try {
      const { data } = await api.post('/fix', { findingId: finding.id, token: t });
      alert(`PR created successfully!\n\nURL: ${data.prUrl}`);
    } catch(e) {
      alert('Failed to create PR: ' + (e.response?.data?.error || e.message));
    } finally {
      setFixing(null);
    }
  };

  useEffect(() => {
    let timer;
    const tick = async () => {
      const { data } = await api.get(`/scans/${id}`);
      setScan(data);
      if (data.status === 'running') timer = setTimeout(tick, 1500);
    };
    tick();
    return () => clearTimeout(timer);
  }, [id]);

  if (!scan) return <p className="p-8 text-zinc-400">Loading...</p>;

  const s = scan.summary;
  const chart = s && [
    { name: 'Critical', value: s.critical, c: '#dc2626' },
    { name: 'High', value: s.high, c: '#f97316' },
    { name: 'Other', value: Math.max(0, s.total - s.critical - s.high), c: '#eab308' },
  ].filter((d) => d.value > 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Link to="/" className="text-sm text-zinc-400 hover:text-white">&larr; Back</Link>
      <h1 className="text-xl font-bold">{scan.target}</h1>

      {scan.status === 'running' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 animate-pulse">Scanning... {scan.progress}</div>
      )}
      {scan.status === 'error' && <div className="bg-red-950 border border-red-800 rounded-xl p-5">Scan failed: {scan.error}</div>}

      {s && (
        <div className="grid sm:grid-cols-4 gap-3">
          <Stat label="Security score" value={s.score} accent={s.score >= 80 ? 'text-green-400' : s.score >= 50 ? 'text-yellow-400' : 'text-red-400'} />
          <Stat label="Findings" value={s.total} />
          <Stat label="Deleted but exposed" value={s.deletedButExposed} accent="text-red-400" />
          <Stat label="Scanned" value={`${s.filesScanned} files · ${s.commitsScanned} commits`} small />
          {chart.length > 0 && (
            <div className="sm:col-span-4 h-40 bg-zinc-900 border border-zinc-800 rounded-xl">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={chart} dataKey="value" nameKey="name" innerRadius={35} outerRadius={60} label>
                    {chart.map((d) => <Cell key={d.name} fill={d.c} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {scan.findings?.map((f) => {
        const [vLabel, vColor] = VERDICT[f.ai?.verdict] || VERDICT.needs_review;
        return (
          <article key={f.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded ${SEV[f.severity] || 'bg-zinc-600'}`}>{f.severity}</span>
              <h3 className="font-semibold">{f.type}</h3>
              {f.status === 'deleted_but_exposed' && <span className="text-xs px-2 py-0.5 rounded bg-purple-700">Deleted but still exposed</span>}
              <span className={`ml-auto text-sm ${vColor}`}>{vLabel}</span>
            </div>
            <p className="text-sm text-zinc-400 font-mono break-all">{f.location}{f.commit_sha && ` @ ${f.commit_sha.slice(0, 7)} by ${f.author}`}</p>
            <p className="font-mono text-sm bg-zinc-950 rounded px-3 py-2 break-all">{f.masked}</p>
            <p className="font-mono text-xs text-zinc-500 break-all">{f.context}</p>
            {f.ai && (
              <div className="border-t border-zinc-800 pt-3 space-y-2 text-sm">
                <p><b>Risk:</b> {f.ai.risk}</p>
                <p><b>Impact:</b> {f.ai.impact}</p>
                <ol className="list-decimal list-inside text-zinc-300 space-y-1">{f.ai.fix?.map((x, i) => <li key={i}>{x}</li>)}</ol>
                <p className="text-xs text-zinc-500">Analysis by {f.ai.source === 'gemini' ? 'Gemini (masked data only)' : 'rule engine'}</p>
              </div>
            )}
            {f.status === 'present' && scan.target !== 'pasted text' && (
              <div className="pt-2">
                <button 
                  disabled={fixing === f.id} 
                  onClick={() => handleFix(f)} 
                  className="text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-1.5 rounded font-medium transition-colors"
                >
                  {fixing === f.id ? 'Creating PR...' : 'Auto-Fix (Create PR)'}
                </button>
              </div>
            )}
          </article>
        );
      })}
      {s && scan.findings.length === 0 && <p className="text-green-400">No exposed secrets found.</p>}
    </div>
  );
}

function Stat({ label, value, accent = '', small }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`${small ? 'text-sm mt-2' : 'text-3xl'} font-bold ${accent}`}>{value}</p>
    </div>
  );
}
