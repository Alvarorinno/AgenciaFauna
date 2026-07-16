import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Eventos from './pages/Eventos';
import Layout from './components/Layout';

type Page = 'dashboard' | 'eventos';

function AppContent() {
  const { user } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');

  if (!user) return <Login />;

  return (
    <Layout page={page} setPage={setPage}>
      {page === 'dashboard' ? <Dashboard /> : <Eventos />}
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
