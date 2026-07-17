import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Cotizaciones from './pages/Cotizaciones';
import Eventos from './pages/Eventos';
import Layout from './components/Layout';
import type { LineaNegocio } from './types';

type Page = 'dashboard' | 'cotizaciones' | 'eventos';

function AppContent() {
  const { user } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');
  const [linea, setLinea] = useState<LineaNegocio>('fauna_rd');

  // El estado inicial de useState solo corre una vez (antes de que exista `user`,
  // que llega recién tras el login), así que la línea por defecto del usuario se
  // sincroniza acá cuando cambia de sesión.
  useEffect(() => {
    if (user) setLinea(user.linea_negocio ?? 'fauna_rd');
  }, [user?.id]);

  if (!user) return <Login />;

  const currentPage = page === 'cotizaciones' && user.role === 'finanzas' ? 'dashboard' : page;

  return (
    <Layout page={currentPage} setPage={setPage} linea={linea} setLinea={setLinea}>
      {currentPage === 'dashboard' && <Dashboard linea={linea} />}
      {currentPage === 'cotizaciones' && <Cotizaciones linea={linea} />}
      {currentPage === 'eventos' && <Eventos linea={linea} />}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
