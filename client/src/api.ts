import axios from 'axios';
import type { Cotizacion, Stats } from './types';

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

export const getStats = async (): Promise<Stats> => {
  const { data } = await api.get('/stats');
  return data;
};
