import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Cotizaciones from './pages/Cotizaciones';
import Eventos from './pages/Eventos';
import Layout from './components/Layout';

type Page = 'dashboard' | 'cotizaciones' | 'eventos';

function AppContent() {
  const { user } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');

  if (!user) return <Login />;

  const currentPage = page === 'cotizaciones' && user.role === 'finanzas' ? 'dashboard' : page;

  return (
    <Layout page={currentPage} setPage={setPage}>
      {currentPage === 'dashboard' && <Dashboard />}
      {currentPage === 'cotizaciones' && <Cotizaciones />}
      {currentPage === 'eventos' && <Eventos />}
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
