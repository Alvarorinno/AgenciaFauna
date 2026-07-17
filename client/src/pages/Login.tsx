import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { login as apiLogin } from '../api';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await apiLogin(username, password);
      login(user, token);
    } catch {
      setError('Usuario o contraseña incorrectos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(160deg, #12192b, #2a3248)' }}
    >
      <div
        className="bg-white rounded-2xl w-full p-11 pb-10"
        style={{ maxWidth: 380, boxShadow: '0 20px 60px rgba(15,23,60,0.3)' }}
      >
        <div className="flex flex-col items-center mb-7">
          <div
            className="flex items-center justify-center rounded-2xl mb-4"
            style={{ width: 64, height: 64, background: '#12192b' }}
          >
            <svg viewBox="0 0 120 120" style={{ width: 44, height: 44 }}>
              <text x="60" y="78" fontFamily="Newsreader, serif" fontStyle="italic" fontWeight="600" fontSize="78" textAnchor="middle" fill="#c8a24a">T</text>
              <path d="M 30 92 Q 60 104 90 88" stroke="#c8a24a" strokeWidth="5" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="title-serif font-semibold text-ink" style={{ fontSize: 26 }}>Agencia Fauna</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Usuario</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Usuario"
              className="w-full outline-none"
              style={{ padding: '11px 14px', border: '1px solid #dfd8c8', borderRadius: 8, fontSize: 14 }}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full outline-none"
              style={{ padding: '11px 14px', border: '1px solid #dfd8c8', borderRadius: 8, fontSize: 14 }}
              required
            />
          </div>

          {error && (
            <div className="text-sm" style={{ color: '#6d2632' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full font-bold rounded-lg transition-opacity disabled:opacity-50"
            style={{ background: '#c8a24a', color: '#12192b', padding: '11px 0', borderRadius: 8 }}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
