import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errMsg } from '../api';

export default function Auth({ mode }) {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isLogin = mode === 'login';

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/auth/${isLogin ? 'login' : 'register'}`, { email, password });
      localStorage.setItem('token', data.token);
      nav('/');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h1 className="text-2xl font-bold text-red-500">REAPER</h1>
        <p className="text-sm text-zinc-400">AI secret-leak detection for GitHub, including secrets deleted from history.</p>
        <input className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2" type="password" placeholder="Password (8+ chars)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={busy} className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded py-2 font-medium">
          {busy ? '...' : isLogin ? 'Log in' : 'Create account'}
        </button>
        <p className="text-sm text-zinc-400">
          {isLogin ? 'No account? ' : 'Have an account? '}
          <Link className="text-red-400 underline" to={isLogin ? '/register' : '/login'}>{isLogin ? 'Register' : 'Log in'}</Link>
        </p>
      </form>
    </div>
  );
}
