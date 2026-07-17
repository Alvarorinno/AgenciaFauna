import { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

type Page = 'dashboard' | 'cotizaciones' | 'eventos';

interface Props {
  page: Page;
  setPage: (p: Page) => void;
  children: ReactNode;
}

const ROLE_LABELS: Record<string, string> = {
  encargado: 'Encargado de Cuenta',
  finanzas: 'Finanzas',
  todos: 'Dirección'
};

export default function Layout({ page, setPage, children }: Props) {
  const { user, logout } = useAuth();

  const navItems: { id: Page; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '▦' },
    ...(user?.role === 'finanzas' ? [] : [{ id: 'cotizaciones' as Page, label: 'Cotizaciones', icon: '📝' }]),
    { id: 'eventos', label: 'Eventos / Proyectos', icon: '▤' }
  ];

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside
        className="flex flex-col shrink-0"
        style={{ width: 250, background: '#12192b', color: '#e6e2d5' }}
      >
        <div className="p-5">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-2xl shrink-0"
              style={{ width: 40, height: 40, background: '#12192b', border: '1px solid #2a3248', borderRadius: 12 }}
            >
              <svg viewBox="0 0 120 120" style={{ width: 28, height: 28 }}>
                <text x="60" y="78" fontFamily="Newsreader, serif" fontStyle="italic" fontWeight="600" fontSize="78" textAnchor="middle" fill="#c8a24a">T</text>
                <path d="M 30 92 Q 60 104 90 88" stroke="#c8a24a" strokeWidth="5" fill="none" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h1 className="title-serif font-semibold" style={{ fontSize: 17 }}>Agencia Fauna</h1>
              <p style={{ fontSize: 11, color: '#9aa0ad' }}>Cotizaciones BTL 2026</p>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #2a3248' }} />

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              className="w-full flex items-center gap-2.5 transition-colors"
              style={{
                padding: '9px 14px',
                borderRadius: 9,
                fontSize: 14,
                fontWeight: 600,
                background: page === id ? '#c8a24a' : 'transparent',
                color: page === id ? '#12192b' : '#c3c7d1'
              }}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}

          <div
            className="w-full flex items-center gap-2.5 justify-between"
            style={{ padding: '9px 14px', borderRadius: 9, fontSize: 14, fontWeight: 600, color: '#6a7185', cursor: 'not-allowed' }}
          >
            <span className="flex items-center gap-2.5">
              <span>📈</span>
              Presupuesto MO
            </span>
            <span
              style={{ background: '#2a3248', color: '#9aa0ad', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}
            >
              PRONTO
            </span>
          </div>
        </nav>

        <div className="p-4" style={{ borderTop: '1px solid #2a3248' }}>
          <div className="px-1 mb-3">
            <p className="text-white font-semibold" style={{ fontSize: 13 }}>{user?.nombre}</p>
            <p style={{ fontSize: 11.5, color: '#9aa0ad' }}>{ROLE_LABELS[user?.role ?? ''] ?? ''}</p>
          </div>
          <button
            onClick={logout}
            className="w-full text-center transition-colors"
            style={{ padding: '8px 0', borderRadius: 8, fontSize: 13, border: '1px solid #2a3248', color: '#c3c7d1' }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto" style={{ background: '#f7f4ee', padding: '28px 36px' }}>
        {children}
      </main>
    </div>
  );
}
