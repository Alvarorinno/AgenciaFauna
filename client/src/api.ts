import axios from 'axios';
import type { Cotizacion, CotizacionGrupo, CotizacionItem, Stats } from './types';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const login = async (username: string, password: string) => {
  const { data } = await api.post('/auth/login', { username, password });
  return data;
};

export const getCotizaciones = async (): Promise<Cotizacion[]> => {
  const { data } = await api.get('/cotizaciones');
  return data;
};

export const createCotizacion = async (payload: Partial<Cotizacion>): Promise<Cotizacion> => {
  const { data } = await api.post('/cotizaciones', payload);
  return data;
};

export const updateCotizacion = async (id: number, payload: Partial<Cotizacion>): Promise<Cotizacion> => {
  const { data } = await api.put(`/cotizaciones/${id}`, payload);
  return data;
};

export const deleteCotizacion = async (id: number): Promise<void> => {
  await api.delete(`/cotizaciones/${id}`);
};

export const getStats = async (linea?: string): Promise<Stats> => {
  const { data } = await api.get('/stats', { params: linea ? { linea } : undefined });
  return data;
};

// ---------- Detalle de proveedores (grupos + ítems) ----------

export const createGrupo = async (cotizacionId: number, payload: Partial<CotizacionGrupo>): Promise<CotizacionGrupo> => {
  const { data } = await api.post('/detalle/grupos', { cotizacion_id: cotizacionId, ...payload });
  return data;
};

export const updateGrupo = async (id: number, payload: Partial<CotizacionGrupo>): Promise<CotizacionGrupo> => {
  const { data } = await api.put(`/detalle/grupos/${id}`, payload);
  return data;
};

export const deleteGrupo = async (id: number): Promise<void> => {
  await api.delete(`/detalle/grupos/${id}`);
};

export const createItem = async (grupoId: number, payload: Partial<CotizacionItem>): Promise<CotizacionItem> => {
  const { data } = await api.post(`/detalle/grupos/${grupoId}/items`, payload);
  return data;
};

export const updateItem = async (id: number, payload: Partial<CotizacionItem>): Promise<CotizacionItem> => {
  const { data } = await api.put(`/detalle/items/${id}`, payload);
  return data;
};

export const deleteItem = async (id: number): Promise<void> => {
  await api.delete(`/detalle/items/${id}`);
};

export const updateComision = async (cotizacionId: number, comisionPct: number): Promise<Cotizacion> => {
  const { data } = await api.put(`/detalle/cotizaciones/${cotizacionId}/comision`, { comision_pct: comisionPct });
  return data;
};

async function downloadPdf(url: string, fallbackName: string) {
  const { data, headers } = await api.get(url, { responseType: 'blob' });
  const disposition: string | undefined = headers['content-disposition'];
  const match = disposition?.match(/filename="([^"]+)"/);
  const filename = match?.[1] || fallbackName;

  const blobUrl = window.URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);
}

export const downloadCotizacionClientePdf = (cotizacionId: number) =>
  downloadPdf(`/detalle/cotizaciones/${cotizacionId}/pdf-cliente`, `cotizacion-${cotizacionId}.pdf`);

export const downloadGrupoOcPdf = (grupoId: number) =>
  downloadPdf(`/detalle/grupos/${grupoId}/pdf-oc`, `oc-${grupoId}.pdf`);
