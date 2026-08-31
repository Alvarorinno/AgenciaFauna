import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DashboardGeneral from './pages/DashboardGeneral';
import Cotizaciones from './pages/Cotizaciones';
import Eventos from './pages/Eventos';
import GestionProveedores from './pages/GestionProveedores';
import Proveedores from './pages/Proveedores';
import Layout from './components/Layout';
import type { LineaNegocio } from './types';

type Page = 'general' | 'dashboard' | 'cotizaciones' | 'eventos' | 'gestion_proveedores' | 'proveedores';

function AppContent() {
  const { user } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');
  const [linea, setLinea] = useState<LineaNegocio>('fauna_rd');
  const [eventosMesPreset, setEventosMesPreset] = useState<{ mes: string; token: number } | null>(null);
  const [cotizacionFocus, setCotizacionFocus] = useState<{ id: number; token: number } | null>(null);

  // Click en un mes del gráfico "Ventas por Mes" del dashboard -> ir a Eventos
  // con ese mes ya filtrado.
  function handleMonthClick(mes: string) {
    setEventosMesPreset({ mes, token: Date.now() });
    setPage('eventos');
  }

  // Al duplicar un evento/proyecto desde Eventos, la copia siempre queda
  // 'pendiente' (vuelve a pasar por el pipeline de Cotizaciones, no se genera
  // otro evento directo) -> navegamos a Cotizaciones y le avisamos cuál mostrar.
  function handleDuplicatedCotizacion(id: number) {
    setCotizacionFocus({ id, token: Date.now() });
    setPage('cotizaciones');
  }

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
      {currentPage === 'general' && <DashboardGeneral />}
      {currentPage === 'dashboard' && <Dashboard linea={linea} onMonthClick={handleMonthClick} />}
      {currentPage === 'cotizaciones' && (
        <Cotizaciones linea={linea} focusCotizacion={cotizacionFocus} onFocusConsumed={() => setCotizacionFocus(null)} />
      )}
      {currentPage === 'eventos' && (
        <Eventos
          linea={linea}
          presetMes={eventosMesPreset}
          onPresetConsumed={() => setEventosMesPreset(null)}
          onDuplicatedCotizacion={handleDuplicatedCotizacion}
        />
      )}
      {currentPage === 'gestion_proveedores' && <GestionProveedores linea={linea} />}
      {currentPage === 'proveedores' && <Proveedores />}
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
