import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errMsg } from '../api';

const DEMO = `# DEMO: fake credentials for testing only
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
stripe_key = "fake_stripe_key_12345"
DATABASE_URL=postgres://admin:S3cretPass@db.example.com/prod
password = "hunter2hunter2"
`;

export default function Dashboard() {
  const nav = useNavigate();
  const [repo, setRepo] = useState('');
  const [text, setText] = useState('');
  const [scans, setScans] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.get('/scans').then((r) => setScans(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  async function start(path, body) {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(path, body);
      nav(`/scans/${data.id}`);
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-red-500">REAPER</h1>
        <button className="text-sm text-zinc-400 hover:text-white" onClick={() => { localStorage.removeItem('token'); nav('/login'); }}>Log out</button>
      </header>

      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">Scan a GitHub repository</h2>
        <p className="text-sm text-zinc-400">Checks current files <em>and</em> commit history, so secrets that were deleted later still show up. Only masked values are shown or sent to AI.</p>
        <div className="flex gap-2">
          <input className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2" placeholder="owner/repo or https://github.com/owner/repo" value={repo} onChange={(e) => setRepo(e.target.value)} />
          <button disabled={busy || !repo} onClick={() => start('/scans/repo', { repo })} className="bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded px-4">Scan</button>
        </div>
      </section>

      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Or paste text / config</h2>
          <button className="text-sm text-red-400 underline" onClick={() => setText(DEMO)}>Load demo</button>
        </div>
        <textarea rows={6} className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 font-mono text-sm" value={text} onChange={(e) => setText(e.target.value)} />
        <button disabled={busy || !text} onClick={() => start('/scans/text', { text })} className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 rounded px-4 py-2">Analyze</button>
      </section>

      {error && <p className="text-red-400">{error}</p>}

      <section className="space-y-2">
        <h2 className="font-semibold">History</h2>
        {scans.length === 0 && <p className="text-sm text-zinc-500">No scans yet.</p>}
        {scans.map((s) => (
          <Link key={s.id} to={`/scans/${s.id}`} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-lg px-4 py-3">
            <span>{s.target}</span>
            <span className="text-sm text-zinc-400">
              {s.status === 'done' ? `${s.summary.total} findings · score ${s.summary.score}` : s.status}
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
